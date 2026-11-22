import json
from copy import deepcopy
from io import BytesIO
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image
from wagtail import blocks
from wagtail.images import get_image_model

from tests.test_project.demo_app.cell_blocks import HybridCellBlock
from tests.test_project.demo_app.models import DemoPage
from wagtail_table.blocks import TableBlock
from wagtail_table.data import default_table_value


@pytest.fixture
def hybrid_value():
    return json.loads((Path(__file__).parent / "fixtures/hybrid.json").read_text())


@pytest.fixture
def hybrid_block():
    return TableBlock(cell_block=HybridCellBlock())


def test_hybrid_round_trip_rendering_and_form_state(hybrid_value, hybrid_block):
    clean = hybrid_block.clean(hybrid_value)
    assert hybrid_block.clean(clean) == clean
    state = hybrid_block.get_form_state(clean)
    attrs = state["table"]["content"][1]["content"][1]["content"][0]["attrs"]
    assert "state" in attrs
    assert '"blocks"' in attrs["state"][0]["value"]
    assert hybrid_block.get_prep_value(clean) == clean
    html = hybrid_block.render(clean)
    assert "<b>Community</b>" in html
    assert "✅" in html
    assert "Community help and documentation." in " ".join(
        hybrid_block.get_searchable_content(clean)
    )
    assert "Use Wagtail block" in hybrid_block.field.widget.render("hybrid", None)
    assert "Use Wagtail block" not in TableBlock().field.widget.render("plain", None)


def test_stream_cells_allow_multiple_configured_blocks(hybrid_value, hybrid_block):
    cell = hybrid_value["table"]["content"][1]["content"][1]["content"][0]
    cell["attrs"]["value"].append({"type": "emoji", "value": "⭐", "id": None})
    clean = hybrid_block.clean(hybrid_value)
    html = hybrid_block.render(clean)
    assert "Community" in html and "⭐" in html
    assert hybrid_block.cell_block.meta.max_num is None


@pytest.mark.parametrize(
    ("native", "raw"),
    [
        (blocks.CharBlock(), "Direct text <script>alert(1)</script>"),
        (blocks.RichTextBlock(features=["bold"]), "<p>Direct <b>rich text</b></p>"),
    ],
)
def test_direct_block_cells_round_trip_native_form_values(native, raw):
    block = TableBlock(cell_block=native)
    value = default_table_value()
    value["version"] = 2
    cell = value["table"]["content"][1]["content"][1]
    cell["content"] = [{"type": "wagtailBlock", "attrs": {"value": raw}}]
    clean = block.clean(value)
    assert block.clean(json.loads(json.dumps(block.get_prep_value(clean)))) == clean
    state = block.get_form_state(clean)
    attrs = state["table"]["content"][1]["content"][1]["content"][0]["attrs"]
    assert isinstance(attrs["value"], str)
    native_state = attrs.pop("state")
    attrs["prefix"] = "table-cell-0"
    submitted = block.field.widget.value_from_datadict(
        {"table": json.dumps(state), "table-cell-0": native_state}, {}, "table"
    )
    assert block.field.clean(submitted) == clean
    html = block.render(clean)
    assert "Direct" in html
    assert "<script>" not in html
    assert "Direct" in " ".join(block.get_searchable_content(clean))
    assert block.get_block_by_content_path(clean, ["table", "2", "2"]).block is native


@pytest.mark.parametrize(
    ("native", "expected_default"),
    [(blocks.CharBlock(), None), (blocks.RichTextBlock(), "")],
)
def test_direct_block_defaults_and_required_validation(native, expected_default):
    block = TableBlock(cell_block=native)
    value = default_table_value()
    value["version"] = 2
    cell = value["table"]["content"][1]["content"][1]
    cell["content"] = [{"type": "wagtailBlock", "attrs": {"value": ""}}]
    assert native.get_prep_value(native.get_default()) == expected_default
    with pytest.raises(ValidationError):
        block.clean(value)
    block.defer_required_validation()
    assert block.clean(value) == value
    block.restore_deferred_validation()
    with pytest.raises(ValidationError):
        block.clean(value)


def test_native_streamblock_one_item_limit_is_preserved(hybrid_value):
    block = TableBlock(cell_block=HybridCellBlock(max_num=1))
    value = deepcopy(hybrid_value)
    cell = value["table"]["content"][1]["content"][1]["content"][0]
    cell["attrs"]["value"] = cell["attrs"]["value"][:1]
    assert block.clean(value)
    cell["attrs"]["value"].append({"type": "emoji", "value": "⭐", "id": None})
    with pytest.raises(ValidationError):
        block.clean(value)


@pytest.mark.parametrize(
    "case", ["text-only", "old-version", "mixed", "unknown", "state", "unsafe-id"]
)
def test_hybrid_rejects_incompatible_data(hybrid_value, hybrid_block, case):
    value = deepcopy(hybrid_value)
    cell = value["table"]["content"][1]["content"][1]
    if case == "text-only":
        hybrid_block = TableBlock()
    elif case == "old-version":
        value["version"] = 1
    elif case == "mixed":
        cell["content"].append({"type": "paragraph"})
    elif case == "unknown":
        cell["content"][0]["attrs"]["value"][0]["type"] = "not_configured"
    elif case == "unsafe-id":
        cell["content"][0]["attrs"]["value"][0]["id"] = '<img src=x onerror="evil()">'
    else:
        cell["content"][0]["attrs"]["state"] = "must not be persisted"
    with pytest.raises(ValidationError):
        hybrid_block.clean(value)


def test_hybrid_rich_text_uses_native_feature_allowlist(hybrid_value, hybrid_block):
    raw = hybrid_value["table"]["content"][1]["content"][1]["content"][0]["attrs"][
        "value"
    ]
    raw[0]["value"] = (
        '<p><script>alert(1)</script><img src=x onerror="evil()"><b>Safe</b></p>'
    )
    with pytest.raises(ValidationError):
        hybrid_block.clean(hybrid_value)


def test_block_cell_required_validation_can_be_deferred(hybrid_value, hybrid_block):
    cell = hybrid_value["table"]["content"][1]["content"][1]["content"][0]
    cell["attrs"]["value"] = [{"type": "rich_text", "value": "", "id": None}]
    with pytest.raises(ValidationError):
        hybrid_block.clean(hybrid_value)
    hybrid_block.clean_deferred(hybrid_value)
    with pytest.raises(ValidationError):
        hybrid_block.clean(hybrid_value)


def test_widget_decodes_native_post_fields_and_removes_prefix(
    hybrid_value, hybrid_block
):
    value = deepcopy(hybrid_value)
    cell = value["table"]["content"][1]["content"][1]["content"][0]
    cell["attrs"]["prefix"] = "table-cell-0"
    state = hybrid_block.cell_block.child_blocks["rich_text"].get_form_state(
        blocks.RichTextBlock().to_python("<p><b>Posted</b> content</p>")
    )
    data = {
        "table": json.dumps(value),
        "table-cell-0-count": "1",
        "table-cell-0-0-type": "rich_text",
        "table-cell-0-0-order": "0",
        "table-cell-0-0-deleted": "",
        "table-cell-0-0-id": "4498af56-7bbb-44ab-ad63-3dd663f42357",
        "table-cell-0-0-value": state,
    }
    decoded = hybrid_block.field.widget.value_from_datadict(data, {}, "table")
    clean = hybrid_block.field.clean(decoded)
    assert "Posted" in hybrid_block.render(clean)
    assert (
        "prefix"
        not in clean["table"]["content"][1]["content"][1]["content"][0]["attrs"]
    )


@pytest.mark.django_db
def test_image_cell_renders_native_alt_and_tracks_references(
    hybrid_value, hybrid_block
):
    output = BytesIO()
    Image.new("RGB", (8, 8), "green").save(output, format="PNG")
    image = get_image_model().objects.create(
        title="Hybrid image",
        file=SimpleUploadedFile("hybrid.png", output.getvalue(), "image/png"),
    )
    cell = hybrid_value["table"]["content"][1]["content"][1]["content"][0]
    cell["attrs"]["value"] = [
        {
            "type": "image",
            "value": {
                "image": image.pk,
                "alt_text": "Green sample",
                "decorative": False,
            },
            "id": None,
        }
    ]
    clean = hybrid_block.clean(hybrid_value)
    html = hybrid_block.render(clean)
    assert "<img " in html
    assert 'alt="Green sample"' in html
    assert any(
        reference[1] == str(image.pk)
        for reference in hybrid_block.extract_references(clean)
    )
    state = hybrid_block.get_form_state(clean)
    assert state["table"]["content"][1]["content"][1]["content"][0]["attrs"]["state"]


@pytest.mark.django_db
def test_hybrid_admin_draft_reload_publish_and_demo(admin_client, hybrid_value):
    data = {
        "title": "Hybrid page",
        "slug": "hybrid-page",
        "body-count": "1",
        "body-0-type": "hybrid_table",
        "body-0-order": "0",
        "body-0-deleted": "",
        "body-0-id": "",
        "body-0-value": json.dumps(hybrid_value),
        "comments-TOTAL_FORMS": "0",
        "comments-INITIAL_FORMS": "0",
        "comments-MIN_NUM_FORMS": "0",
        "comments-MAX_NUM_FORMS": "1000",
    }
    response = admin_client.post(
        "/admin/pages/add/demo_app/demopage/1/", {**data, "action-save-draft": ""}
    )
    assert response.status_code == 302
    page = DemoPage.objects.get(slug="hybrid-page")
    edit = f"/admin/pages/{page.pk}/edit/"
    assert admin_client.get(edit).status_code == 200
    response = admin_client.post(edit, {**data, "action-publish": "action-publish"})
    assert response.status_code == 302
    page.refresh_from_db()
    assert page.live
    assert page.body[0].value["version"] == 2
    assert "Community" in str(page.body)


@pytest.mark.django_db
def test_hybrid_example_page_is_published_and_preserved(client):
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-hybrid")
    revision = page.latest_revision_id
    response = client.get("/table-hybrid/")
    assert response.status_code == 200
    assert b"<b>Community</b>" in response.content
    call_command("create_examples")
    page.refresh_from_db()
    assert page.latest_revision_id == revision
