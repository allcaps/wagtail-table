import json

import pytest
from django.core.exceptions import ValidationError
from django.utils.module_loading import import_string

from wagtail_table.blocks import TableBlock


def test_default_and_required():
    block = TableBlock()
    value = block.get_default()
    assert block.clean(value) == value
    assert value["version"] == 1
    assert value["caption"] == value["description"] == ""
    rows = value["table"]["content"]
    assert len(rows) == 3
    for index, row in enumerate(rows):
        assert len(row["content"]) == 3
        assert {cell["type"] for cell in row["content"]} == {
            "tableHeader" if index == 0 else "tableCell"
        }
        assert all(
            cell["content"] == [{"type": "paragraph"}] for cell in row["content"]
        )
    with pytest.raises(ValidationError):
        block.clean(None)
    assert TableBlock(required=False).clean(None) is None


def test_starter_tables_have_independent_cells_and_values():
    block = TableBlock()
    first = block.get_default()
    first["table"]["content"][1]["content"][0]["content"][0]["content"] = [
        {"type": "text", "text": "Independent"}
    ]
    assert first != block.get_default()
    assert first != TableBlock().get_default()
    assert first["table"]["content"][1]["content"][1]["content"] == [
        {"type": "paragraph"}
    ]


def test_custom_default_and_empty_saved_values_are_preserved(table_value):
    assert TableBlock(default=table_value).get_default() == table_value
    assert TableBlock(default=None).get_default() is None
    assert TableBlock().get_form_state(None) is None
    assert TableBlock().to_python(None) is None


def test_value_and_form_round_trips(table_value):
    block = TableBlock()
    assert block.to_python(block.get_prep_value(table_value)) == table_value
    posted = {"body-0-value": json.dumps(table_value)}
    extracted = block.value_from_datadict(posted, {}, "body-0-value")
    assert block.clean(extracted) == table_value
    assert block.get_form_state(table_value) == table_value


@pytest.mark.parametrize("raw", ["{bad json", '{"version":99}', "[1, 2]", '"text"'])
def test_bad_post_is_preserved_and_reported_during_clean(raw):
    block = TableBlock()
    extracted = block.value_from_datadict({"table": raw}, {}, "table")
    assert extracted == raw
    with pytest.raises(ValidationError):
        block.clean(extracted)
    assert block.get_form_state(extracted) == raw


def test_unknown_saved_version_stays_read_only(table_value):
    table_value["version"] = 99
    state = TableBlock().get_form_state(table_value)
    assert json.loads(state) == table_value


def test_block_migration_import_and_reconstruction():
    block = TableBlock(required=False, help_text="Example", label="Data")
    path, args, kwargs = block.deconstruct()
    reconstructed = import_string(path)(*args, **kwargs)
    assert isinstance(reconstructed, TableBlock)
    assert not reconstructed.required
    assert reconstructed.field.help_text == "Example"
    assert reconstructed.label == "Data"


def test_searchable_content(table_value):
    assert TableBlock().get_searchable_content(table_value) == [
        "Item",
        "Quantity",
        "Apples",
        "4",
    ]
    assert TableBlock().get_searchable_content({"unexpected": True}) == []


@pytest.mark.django_db
def test_revision_save_reload_publish(table_value, client):
    from wagtail.models import Page, Site

    from tests.test_project.demo_app.models import DemoPage

    page = DemoPage(
        title="Example", slug="example", live=False, body=[("table", table_value)]
    )
    Page.get_first_root_node().add_child(instance=page)
    revision = page.save_revision()
    loaded = revision.as_object()
    assert loaded.body[0].value == table_value
    assert not page.live
    revision.publish()
    page.refresh_from_db()
    Site.objects.update_or_create(
        is_default_site=True, defaults={"hostname": "localhost", "root_page": page}
    )
    response = client.get("/", HTTP_HOST="localhost")
    assert response.status_code == 200
    assert b"Apples" in response.content
    assert b"<table>" in response.content
