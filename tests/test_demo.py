import json

import pytest
from django.core.management import call_command

from tests.test_project.demo_app.examples import accessibility_examples, example_tables
from tests.test_project.demo_app.models import DemoPage
from tests.test_rendering import TableHTML
from wagtail_table.blocks import TableBlock


def test_all_demo_examples_validate_and_render():
    block = TableBlock()
    for title, value in example_tables():
        assert block.clean(value) == value, title
        assert "<table" in block.render(value), title


@pytest.mark.parametrize(
    "example", accessibility_examples(), ids=lambda item: item["id"]
)
def test_accessibility_fixtures_round_trip_and_render(example):
    value = example["value"]
    block = TableBlock()
    assert block.clean(value) == value
    assert block.field.clean(json.dumps(value)) == value
    parsed = TableHTML(block.render(value))
    assert len(parsed.attrs("table")) == 1
    header_ids = {header["id"] for header in parsed.attrs("th")}
    for cell in parsed.attrs("td"):
        assert set(cell.get("headers", "").split()) <= header_ids
        if not example["limitation"]:
            assert cell.get("headers")
    if value["description"]:
        description_id = parsed.attrs("table")[0]["aria-describedby"]
        assert any(p.get("id") == description_id for p in parsed.attrs("p"))


def test_accessibility_fixtures_associate_spanning_edge_headers():
    examples = {example["id"]: example for example in accessibility_examples()}
    parsed = TableHTML(TableBlock().render(examples["column-spans"]["value"]))
    headers = parsed.attrs("th")
    assert set(parsed.attrs("td")[0]["headers"].split()) == {
        headers[1]["id"],  # East building
        headers[3]["id"],  # Morning
        headers[7]["id"],  # Studio
    }
    assert len(parsed.attrs("thead")) == 1
    assert all(len(cell["headers"].split()) == 3 for cell in parsed.attrs("td"))
    parsed = TableHTML(TableBlock().render(examples["row-spans"]["value"]))
    north_header = parsed.attrs("th")[3]["id"]
    south_header = parsed.attrs("th")[4]["id"]
    assert all(
        north_header in cell["headers"].split() for cell in parsed.attrs("td")[:4]
    )
    assert all(
        south_header in cell["headers"].split() for cell in parsed.attrs("td")[4:]
    )


@pytest.mark.django_db
def test_example_command_keeps_existing_edits():
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-examples")
    revision_id = page.latest_revision_id
    assert len([block for block in page.body if block.block_type == "table"]) == 7
    call_command("create_examples")
    page.refresh_from_db()
    assert page.latest_revision_id == revision_id


@pytest.mark.django_db
def test_accessibility_page_is_created_with_existing_examples_and_keeps_edits(client):
    call_command("create_content")
    root = DemoPage.objects.get(slug="table-demo")
    existing = DemoPage(title="Edited examples", slug="table-examples")
    root.add_child(instance=existing)
    existing.body = [("paragraph", "<p>Keep this existing content.</p>")]
    existing.save_revision().publish()
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-accessibility")
    assert page.live
    assert len([block for block in page.body if block.block_type == "table"]) == 11
    response = client.get("/table-accessibility/")
    assert response.status_code == 200
    html = response.content.decode()
    assert html.count("<table") == 11
    assert "https://www.w3.org/WAI/tutorials/tables/" in html
    assert "Offset row headers: a current limitation" in html
    assert "Limitation: automatic row-header associations" in html
    assert "<pre" not in html
    page.body = [("paragraph", "<p>Keep my accessibility examples.</p>")]
    page.save_revision().publish()
    revision = page.latest_revision_id
    call_command("create_examples")
    page.refresh_from_db()
    existing.refresh_from_db()
    assert page.latest_revision_id == revision
    assert "Keep my accessibility examples." in str(page.body)
    assert "Keep this existing content." in str(existing.body)
