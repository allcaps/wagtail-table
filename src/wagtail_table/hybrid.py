"""Bridge native table cells to developer-configured Wagtail blocks."""

from collections.abc import Mapping
from copy import deepcopy
from uuid import UUID

from django.core.exceptions import ValidationError
from wagtail.blocks import ListBlock, RichTextBlock, StreamBlock, StructBlock

from .quiet import quiet_html


def block_cells(value):
    if value is not None:
        for row_number, row in enumerate(value["table"]["content"], 1):
            for cell_number, cell in enumerate(row["content"], 1):
                for node in cell["content"]:
                    if node["type"] == "wagtailBlock":
                        yield row_number, cell_number, node


def block_value(block, raw):
    if isinstance(block, StreamBlock):
        return stream_cell_value(block, raw)
    native = block.to_python(raw)
    if isinstance(block, RichTextBlock):
        return rich_text_value(block, raw, native)
    if isinstance(block, StructBlock):
        return struct_cell_value(block, raw, native)
    if isinstance(block, ListBlock):
        for child in native.bound_blocks:
            child.value = block_value(
                block.child_block, block.child_block.get_prep_value(child.value)
            )
    return native


def stream_cell_value(block, raw):
    validate_stream_cell(block, raw)
    native = block.to_python(raw)
    for child in native:
        child.value = block_value(child.block, child.block.get_prep_value(child.value))
    return native


def struct_cell_value(block, raw, native):
    # Some native StructBlock subclasses (ImageBlock) return model instances.
    if not isinstance(native, Mapping):
        return native
    if isinstance(raw, dict) and set(raw) - block.child_blocks.keys():
        raise ValidationError("The cell contains unsupported fields.")
    for name, child in block.child_blocks.items():
        native[name] = block_value(child, child.get_prep_value(native[name]))
    return native


def rich_text_value(block, raw, native):
    if not isinstance(raw, str):
        raise ValidationError("Rich-text cell content must be text.")
    if not raw:
        return native
    # Reuse the configured editor's feature allowlist for programmatic JSON too.
    state = block.get_form_state(native)
    return block.value_from_datadict({"cell": state}, {}, "cell")


def validate_stream_cell(block, raw):
    # Native StreamBlock.to_python drops unknown types; reject instead of losing data.
    if not isinstance(raw, list):
        raise ValidationError("StreamBlock cell content must be a list.")
    for item in raw:
        if (
            not isinstance(item, dict)
            or set(item) - {"type", "value", "id"}
            or item.get("type") not in block.child_blocks
            or "value" not in item
        ):
            raise ValidationError("The cell contains an unsupported block type.")
        if item.get("id") not in (None, ""):
            try:
                UUID(item["id"])
            except (ValueError, TypeError, AttributeError) as error:
                raise ValidationError(
                    "The cell contains an invalid block identifier."
                ) from error


def clean_cells(value, block):
    result = deepcopy(value)
    for row, column, node in block_cells(result):
        try:
            native = block_value(block, node["attrs"]["value"])
            node["attrs"]["value"] = block.get_prep_value(block.clean(native))
        except (
            ValidationError,
            TypeError,
            ValueError,
            KeyError,
            AssertionError,
        ) as error:
            raise ValidationError(
                "Block cell %(row)s, %(column)s: %(error)s",
                params={"row": row, "column": column, "error": str(error)},
            ) from error
    return result


def form_state(value, block):
    result = deepcopy(value)
    for _row, _column, node in block_cells(result):
        native = block_value(block, node["attrs"]["value"])
        node["attrs"]["value"] = block.get_prep_value(native)
        # This is editor state only. The widget strips it from its submitted JSON.
        node["attrs"]["state"] = block.get_form_state(native)
        node["attrs"]["quiet"] = quiet_html(block, native)
    return result
