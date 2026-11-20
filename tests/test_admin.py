import json
from pathlib import Path

import pytest
from wagtail.models import Site

from tests.test_project.demo_app.models import DemoPage
from wagtail_table.blocks import TableBlock


@pytest.fixture
def table_page_data():
    return {
        "title": "Starter table",
        "slug": "starter-table",
        "body-count": "1",
        "body-0-type": "table",
        "body-0-order": "0",
        "body-0-deleted": "",
        "body-0-id": "",
        "body-0-value": "null",
        "comments-TOTAL_FORMS": "0",
        "comments-INITIAL_FORMS": "0",
        "comments-MIN_NUM_FORMS": "0",
        "comments-MAX_NUM_FORMS": "1000",
    }


@pytest.mark.django_db
def test_empty_required_table_can_save_drafts_but_cannot_publish(
    admin_client, table_page_data
):
    add_url = "/admin/pages/add/demo_app/demopage/1/"
    data = table_page_data
    response = admin_client.post(add_url, {**data, "action-publish": "action-publish"})
    assert response.status_code == 200
    assert "body" in response.context["form"].errors
    assert b"This field is required." in response.content
    assert not DemoPage.objects.filter(slug=data["slug"]).exists()

    response = admin_client.post(add_url, {**data, "action-save-draft": ""})
    assert response.status_code == 302
    page = DemoPage.objects.get(slug=data["slug"])
    assert not page.live
    assert page.get_latest_revision_as_object().body[0].value is None
    edit_url = f"/admin/pages/{page.pk}/edit/"
    assert admin_client.get(edit_url).status_code == 200
    response = admin_client.post(edit_url, {**data, "action-save-draft": ""})
    assert response.status_code == 302
    page.refresh_from_db()
    assert page.get_latest_revision_as_object().body[0].value is None
    revision_id = page.latest_revision_id

    response = admin_client.post(edit_url, {**data, "action-publish": "action-publish"})
    assert response.status_code == 200
    assert "body" in response.context["form"].errors
    page.refresh_from_db()
    assert not page.live
    assert page.latest_revision_id == revision_id


@pytest.mark.django_db
def test_blank_starter_table_publishes_without_cell_edits(
    admin_client, table_page_data
):
    value = TableBlock().get_default()
    data = {**table_page_data, "body-0-value": json.dumps(value)}
    response = admin_client.post(
        "/admin/pages/add/demo_app/demopage/1/",
        {**data, "action-publish": "action-publish"},
    )
    assert response.status_code == 302
    page = DemoPage.objects.get(slug=data["slug"])
    assert page.live
    assert page.body[0].value == value
    assert page.get_latest_revision_as_object().body[0].value == value
    response = admin_client.get(f"/admin/pages/{page.pk}/edit/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_empty_draft_cannot_replace_a_published_table(admin_client, table_page_data):
    value = TableBlock().get_default()
    data = {**table_page_data, "body-0-value": json.dumps(value)}
    response = admin_client.post(
        "/admin/pages/add/demo_app/demopage/1/",
        {**data, "action-publish": "action-publish"},
    )
    assert response.status_code == 302
    page = DemoPage.objects.get(slug=data["slug"])
    live_revision_id = page.live_revision_id
    edit_url = f"/admin/pages/{page.pk}/edit/"
    data["body-0-value"] = "null"
    response = admin_client.post(edit_url, {**data, "action-save-draft": ""})
    assert response.status_code == 302
    page.refresh_from_db()
    assert page.get_latest_revision_as_object().body[0].value is None

    response = admin_client.post(edit_url, {**data, "action-publish": "action-publish"})
    assert response.status_code == 200
    assert "body" in response.context["form"].errors
    page.refresh_from_db()
    assert page.live
    assert page.live_revision_id == live_revision_id
    assert page.body[0].value == value


@pytest.mark.django_db
@pytest.mark.parametrize("layout", ["text-only", "before", "after"])
@pytest.mark.parametrize("action", ["action-save-draft", "action-publish"])
def test_outside_text_is_invalid_even_when_saving_a_draft(
    admin_client, table_page_data, layout, action
):
    table = TableBlock().get_default()["table"]
    paragraph = {
        "type": "paragraph",
        "content": [{"type": "text", "text": "Outside text must be retained"}],
    }
    contents = {
        "text-only": [paragraph],
        "before": [paragraph, table],
        "after": [table, paragraph],
    }
    # This is the widget's retained error payload, not a valid table wrapper.
    value = {"version": 1, "document": {"type": "doc", "content": contents[layout]}}
    data = {**table_page_data, "body-0-value": json.dumps(value), action: ""}
    response = admin_client.post("/admin/pages/add/demo_app/demopage/1/", data)
    assert response.status_code == 200
    assert "body" in response.context["form"].errors
    assert b"Outside text must be retained" in response.content
    assert not DemoPage.objects.filter(slug=data["slug"]).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "fixture", ["native.json", "phase2.json", "clipboard/native-html.json"]
)
def test_native_browser_value_through_admin_draft_and_publish(admin_client, fixture):
    value = json.loads((Path(__file__).parent / "fixtures" / fixture).read_text())
    data = {
        "title": "Native table",
        "slug": "native-table",
        "body-count": "1",
        "body-0-type": "table",
        "body-0-order": "0",
        "body-0-deleted": "",
        "body-0-id": "",
        "body-0-value": json.dumps(value),
        "comments-TOTAL_FORMS": "0",
        "comments-INITIAL_FORMS": "0",
        "comments-MIN_NUM_FORMS": "0",
        "comments-MAX_NUM_FORMS": "1000",
        "action-save-draft": "",
    }
    response = admin_client.post("/admin/pages/add/demo_app/demopage/1/", data)
    assert response.status_code == 302
    page = DemoPage.objects.get(slug="native-table")
    assert not page.live
    assert page.get_latest_revision_as_object().body[0].value == value
    edit_url = f"/admin/pages/{page.pk}/edit/"
    response = admin_client.get(edit_url)
    assert response.status_code == 200
    assert b"wagtail_table.TableInput" in response.content
    assert b"wagtail_table/table.js" in response.content
    assert b"Original" in response.content

    data.pop("action-save-draft")
    data["action-publish"] = "action-publish"
    response = admin_client.post(edit_url, data)
    assert response.status_code == 302
    page.refresh_from_db()
    assert page.live
    assert page.body[0].value == value
    Site.objects.update_or_create(
        is_default_site=True, defaults={"hostname": "localhost", "root_page": page}
    )
    response = admin_client.get("/", HTTP_HOST="localhost")
    assert response.status_code == 200
    assert b"Original" in response.content
    assert b"<table" in response.content
    if fixture == "phase2.json":
        assert b"Stock counts" in response.content
        assert b"wagtail-table-valign-bottom" in response.content
        assert b"aria-describedby=" in response.content
    if fixture == "clipboard/native-html.json":
        assert b"<br>" in response.content
        assert b"Fresh &amp; safe" in response.content
        assert b"4 &lt; 5" in response.content
