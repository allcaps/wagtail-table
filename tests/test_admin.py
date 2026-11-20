import json
from pathlib import Path

import pytest
from wagtail.models import Site

from tests.test_project.demo_app.models import DemoPage


@pytest.mark.django_db
def test_native_browser_value_through_admin_draft_and_publish(admin_client):
    value = json.loads((Path(__file__).parent / "fixtures/native.json").read_text())
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
    assert b"<table>" in response.content
