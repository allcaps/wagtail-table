import json

import pytest
from django.middleware.csrf import get_token
from django.test import Client
from django.urls import reverse
from wagtail import blocks

from wagtail_table.blocks import TableBlock
from wagtail_table.quiet import QuietWhitelister, quiet_definition, quiet_html


def test_quiet_html_is_passive_and_preserves_readable_content():
    html = QuietWhitelister().clean(
        '<div id="duplicate" class="site" onclick="evil()"><dl><dt>Title</dt>'
        '<dd><a href="/other/">Details</a><strong>Important</strong></dd></dl>'
        '<img src="/photo.png" alt="Photo" onerror="evil()">'
        '<img src="javascript:evil()"><script>evil()</script>'
        '<iframe src="/other/"></iframe><form><input value="secret"></form>'
        "<select><option>Choice</option></select><button>Edit</button>"
        '<style>body{display:none}</style><svg onload="evil()"></svg></div>'
    )
    assert "<dl><dt>Title</dt><dd>Details<strong>Important</strong>" in html
    assert 'alt="Photo"' in html and 'src="/photo.png"' in html
    for forbidden in (
        "id=",
        "class=",
        "onclick",
        "onerror",
        "javascript:",
        "<script",
        "<iframe",
        "<form",
        "<input",
        "<select",
        "<button",
        "<svg",
        "evil()",
        "secret",
    ):
        assert forbidden not in html


def test_context_dependent_renderer_fails_without_losing_value(caplog):
    class PageDependent(blocks.CharBlock):
        def render(self, value, context=None):
            raise KeyError("page")

    assert quiet_html(PageDependent(), "Retained") is None
    assert "Unable to render a quiet table cell" in caplog.text


def test_empty_direct_cell_does_not_display_python_none():
    assert quiet_html(blocks.CharBlock(), None) == ""


@pytest.mark.django_db
@pytest.mark.parametrize("limit,count", [(1, 1), (None, 2)])
def test_quiet_endpoint_uses_native_stream_decoding(admin_client, limit, count):
    block = blocks.StreamBlock([("text", blocks.CharBlock())], max_num=limit)
    data = {
        "definition": quiet_definition(block),
        "prefix": "cell",
        "cell-count": count,
    }
    for index in range(count):
        data.update(
            {
                f"cell-{index}-type": "text",
                f"cell-{index}-order": index,
                f"cell-{index}-deleted": "",
                f"cell-{index}-value": f"Item {index}",
            }
        )
    response = admin_client.post(reverse("wagtail_table_quiet_cell"), data)
    assert response.status_code == 200
    for index in range(count):
        assert f"Item {index}" in response.json()["html"]


@pytest.mark.django_db
@pytest.mark.parametrize("native", [blocks.CharBlock(), blocks.RichTextBlock()])
def test_quiet_endpoint_decodes_native_fields_without_required_validation(
    admin_client, native
):
    url = reverse("wagtail_table_quiet_cell")
    token = quiet_definition(native)
    # Missing required content is a valid editing state, even if not publishable.
    response = admin_client.post(url, {"definition": token, "prefix": "cell"})
    assert response.status_code == 200
    assert response.json()["html"] is not None
    state = native.get_form_state(native.to_python("Updated"))
    response = admin_client.post(
        url, {"definition": token, "prefix": "cell", "cell": state}
    )
    assert response.status_code == 200
    assert "Updated" in response.json()["html"]
    assert "no-cache" in response.headers["Cache-Control"]


@pytest.mark.django_db
def test_quiet_endpoint_checks_access_csrf_method_and_definition(
    admin_client, admin_user
):
    url = reverse("wagtail_table_quiet_cell")
    assert Client().post(url).status_code == 302
    assert admin_client.get(url).status_code == 405
    assert (
        admin_client.post(url, {"definition": "forged", "prefix": "cell"}).status_code
        == 400
    )
    assert (
        admin_client.post(
            url, {"definition": quiet_definition(blocks.CharBlock())}
        ).status_code
        == 400
    )
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(admin_user)
    assert csrf_client.post(url).status_code == 403


@pytest.mark.django_db
def test_multipart_rendering_after_csrf_has_read_the_post(admin_user, rf):
    client = Client(enforce_csrf_checks=True)
    client.force_login(admin_user)
    token = get_token(rf.get("/"))
    client.cookies["csrftoken"] = token
    response = client.post(
        reverse("wagtail_table_quiet_cell"),
        {
            "definition": quiet_definition(blocks.CharBlock()),
            "prefix": "cell",
            "cell": "Current",
        },
        HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 200
    assert response.json()["html"] == "Current"


def test_quiet_form_state_is_transient_and_does_not_change_published_content(
    table_value,
):
    block = TableBlock(cell_block=blocks.CharBlock())
    table_value["version"] = 2
    cell = table_value["table"]["content"][1]["content"][0]
    cell["content"] = [{"type": "wagtailBlock", "attrs": {"value": "Current value"}}]
    original = block.render(table_value)
    state = block.get_form_state(table_value)
    attrs = state["table"]["content"][1]["content"][0]["content"][0]["attrs"]
    assert "Current value" in attrs.pop("quiet")
    attrs.pop("state")
    assert state == table_value
    attrs["quiet"] = '<input value="untrusted">'
    attrs["prefix"] = "table-cell-0"
    submitted = block.field.widget.value_from_datadict(
        {"table": json.dumps(state), "table-cell-0": "Current value"}, {}, "table"
    )
    clean = block.clean(json.loads(submitted))
    assert "quiet" not in submitted
    # Generated header IDs vary per render, so compare the relevant cell content.
    assert "Current value" in block.render(clean)
    assert "<input" not in original
