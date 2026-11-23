from collections import Counter
from contextlib import ExitStack

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from wagtail.contrib.table_block.blocks import TableBlock as WagtailTableBlock
from wagtail.contrib.typed_table_block.blocks import TypedTableBlock
from wagtail.images import get_image_model

from tests.test_project.demo_app.models import DemoPage
from wagtail_table.blocks import TableBlock


@pytest.fixture(autouse=True)
def close_generated_rendition_files(monkeypatch):
    image_model = get_image_model()
    generate = image_model.generate_rendition_file
    with ExitStack() as files:

        def generate_rendition(image, image_filter, *, source=None):
            # Wagtail 8.1 can leave its spooled output file open after saving a
            # rendition. Retain and close actual generated files at test teardown.
            output = generate(image, image_filter, source=source)
            files.enter_context(output)
            return output

        monkeypatch.setattr(image_model, "generate_rendition_file", generate_rendition)
        yield


@pytest.mark.django_db
def test_comparison_examples_validate_render_and_preserve_edits(client):
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-editor-comparison")
    counts = Counter(block.block_type for block in page.body)
    assert counts["legacy_table"] == counts["table"] == 2
    assert counts["typed_table"] == counts["research_hybrid_table"] == 3
    for block in page.body:
        block.block.clean(block.value)
    definitions = page.body.stream_block.child_blocks
    assert isinstance(definitions["legacy_table"], WagtailTableBlock)
    assert isinstance(definitions["typed_table"], TypedTableBlock)
    assert isinstance(definitions["research_hybrid_table"], TableBlock)
    wide = [block for block in page.body if block.block_type == "typed_table"][1]
    assert len(wide.value.columns) == 12
    assert len(wide.value.row_data) == 8
    mixed = [block for block in page.body if block.block_type == "typed_table"][-1]
    assert [column["block"].name for column in mixed.value.columns] == [
        "text",
        "blocks",
        "emoji",
        "image",
    ]
    assert len(mixed.value.row_data[0]["values"][1]) == 3
    response = client.get("/table-editor-comparison/")
    assert response.status_code == 200
    assert response.content.count(b"<table") == 10
    assert b"Teal comparison sample" in response.content
    assert b"An ordinary text input" in response.content
    assert b"table-editor-comparison" in client.get("/").content
    image_count = get_image_model().objects.count()
    page.body = [("paragraph", "<p>Keep these research edits.</p>")]
    page.save_revision().publish()
    revision = page.latest_revision_id
    call_command("create_examples")
    page.refresh_from_db()
    assert page.latest_revision_id == revision
    assert "Keep these research edits." in str(page.body)
    assert get_image_model().objects.count() == image_count


@pytest.mark.django_db
def test_comparison_admin_restores_all_native_editors_and_round_trips(client):
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-editor-comparison")
    user = get_user_model().objects.create_superuser("research", "research@example.com")
    client.force_login(user)
    response = client.get(f"/admin/pages/{page.pk}/edit/")
    assert response.status_code == 200
    assert b"wagtail_table.TableInput" in response.content
    assert (
        b"wagtail.contrib.typed_table_block.blocks.TypedTableBlock" in response.content
    )
    assert b"handsontable" in response.content
    before = page.body.get_prep_value()
    restored = page.body.stream_block.to_python(before)
    assert page.body.stream_block.get_prep_value(restored) == before
    page.body = restored
    page.save_revision().publish()
    page.refresh_from_db()
    assert page.body.get_prep_value() == before


@pytest.mark.django_db
def test_direct_and_stream_cell_examples_are_matched_and_preserved(client):
    call_command("create_content")
    call_command("create_examples")
    page = DemoPage.objects.get(slug="table-cell-content-comparison")
    tables = [block for block in page.body if block.block_type != "paragraph"]
    assert [block.block_type for block in tables] == [
        "typed_table",
        "char_cell_table",
        "typed_table",
        "richtext_cell_table",
        "typed_table",
        "single_choice_table",
        "typed_table",
        "research_hybrid_table",
    ]
    for block in page.body:
        block.block.clean(block.value)
    native_cells = [
        block.value["table"]["content"][1]["content"][0]["content"][0]["attrs"]["value"]
        for block in tables[1::2]
    ]
    assert native_cells[0] == "Apples"
    assert native_cells[1] == "<p>Apples</p>"
    assert len(native_cells[2]) == 1
    assert len(native_cells[3]) == 2
    assert tables[5].block.cell_block.meta.max_num == 1
    assert tables[7].block.cell_block.meta.max_num is None
    response = client.get("/table-cell-content-comparison/")
    assert response.status_code == 200
    assert response.content.count(b"<table") == 8
    assert b"Direct CharBlock" in response.content
    assert b"table-cell-content-comparison" in client.get("/").content
    before = page.body.get_prep_value()
    assert (
        page.body.stream_block.get_prep_value(page.body.stream_block.to_python(before))
        == before
    )
    page.body = [("paragraph", "<p>Keep the focused comparison.</p>")]
    page.save_revision().publish()
    revision_id = page.latest_revision_id
    call_command("create_examples")
    page.refresh_from_db()
    assert page.latest_revision_id == revision_id
