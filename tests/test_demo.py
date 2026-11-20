import pytest
from django.core.management import call_command

from tests.test_project.demo_app.examples import example_tables
from tests.test_project.demo_app.models import DemoPage
from wagtail_table.blocks import TableBlock


def test_all_demo_examples_validate_and_render():
    block = TableBlock()
    for title, value in example_tables():
        assert block.clean(value) == value, title
        assert "<table" in block.render(value), title


@pytest.mark.django_db
def test_example_command_keeps_existing_edits():
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-examples")
    revision_id = page.latest_revision_id
    assert len([block for block in page.body if block.block_type == "table"]) == 6
    call_command("create_examples")
    page.refresh_from_db()
    assert page.latest_revision_id == revision_id
