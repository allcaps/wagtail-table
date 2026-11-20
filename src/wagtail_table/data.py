"""Validate the small native node vocabulary supported by the Python renderer."""

import json

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

MAX_JSON_LENGTH = 2_000_000
MAX_ROWS = 1000
MAX_COLUMNS = 100
MAX_CELLS = 10_000

CHILD_TYPES = {
    "table": ("tableRow",),
    "tableRow": ("tableCell", "tableHeader"),
    "tableCell": ("paragraph",),
    "tableHeader": ("paragraph",),
    "paragraph": ("text", "hardBreak"),
}


def validate_value(value):
    """Reject unsupported data rather than silently dropping content on save."""
    if value is None:
        return
    try:
        if len(json.dumps(value)) > MAX_JSON_LENGTH:
            raise ValidationError(_("The table document is too large."))
    except (RecursionError, TypeError, ValueError) as error:
        raise ValidationError(_("Enter a supported table document.")) from error
    validate_metadata(value)
    table = value.get("table")
    validate_node(table, ("table",))
    validate_grid(table["content"])


def validate_metadata(value):
    if not isinstance(value, dict) or set(value) - {
        "version",
        "table",
        "caption",
        "description",
    }:
        raise ValidationError(_("Enter a supported table document."))
    if type(value.get("version")) is not int or value["version"] != 1:
        raise ValidationError(_("This table document version is not supported."))
    if not all(
        isinstance(value.get(key, ""), str) for key in ("caption", "description")
    ):
        raise ValidationError(_("Table caption and description must be text."))


def validate_node(node, allowed_types):
    if not isinstance(node, dict) or node.get("type") not in allowed_types:
        raise ValidationError(_("The table contains an unsupported content type."))
    node_type = node["type"]
    if node_type in {"text", "hardBreak"}:
        validate_inline(node)
        return
    if set(node) - {"type", "content", "attrs"}:
        raise ValidationError(_("The table contains unsupported formatting."))
    validate_attrs(node_type, node.get("attrs", {}))
    for child in validate_children(node):
        validate_node(child, CHILD_TYPES[node_type])


def validate_children(node):
    content = node.get("content", [])
    if not isinstance(content, list) or len(content) > MAX_CELLS:
        raise ValidationError(_("The table contains too much content."))
    if not content and node["type"] not in {"paragraph", "tableRow"}:
        raise ValidationError(_("Table rows and cells cannot be missing."))
    return content


def validate_inline(node):
    if node["type"] == "hardBreak":
        if set(node) != {"type"}:
            raise ValidationError(_("Unsupported line break attributes."))
        return
    if (
        set(node) != {"type", "text"}
        or not isinstance(node["text"], str)
        or not node["text"]
    ):
        raise ValidationError(_("Table text must be plain text."))


def validate_attrs(node_type, attrs):
    if not isinstance(attrs, dict):
        raise ValidationError(_("Invalid table attributes."))
    if node_type not in {"tableCell", "tableHeader"}:
        if attrs:
            raise ValidationError(_("Unsupported table attributes."))
        return
    if set(attrs) - {"rowspan", "colspan", "colwidth", "align", "verticalAlign"}:
        raise ValidationError(_("Unsupported cell attributes."))
    validate_alignment(attrs)
    validate_spans(attrs)
    validate_colwidth(attrs)


def validate_alignment(attrs):
    if attrs.get("align") not in (None, "left", "center", "right"):
        raise ValidationError(_("Unsupported cell alignment."))
    if attrs.get("verticalAlign") not in (None, "top", "middle", "bottom"):
        raise ValidationError(_("Unsupported vertical alignment."))


def validate_spans(attrs):
    for key, limit in (("rowspan", MAX_ROWS), ("colspan", MAX_COLUMNS)):
        span = attrs.get(key, 1)
        if type(span) is not int or not 1 <= span <= limit:
            raise ValidationError(_("Invalid cell span."))


def validate_colwidth(attrs):
    widths = attrs.get("colwidth")
    if widths is None:
        return
    if not isinstance(widths, list) or len(widths) != attrs.get("colspan", 1):
        raise ValidationError(_("Invalid column widths."))
    if any(type(width) is not int or not 0 <= width <= 10_000 for width in widths):
        raise ValidationError(_("Invalid column widths."))


def validate_grid(rows):
    """Inspect geometry only; ProseMirror owns all table manipulation."""
    if len(rows) > MAX_ROWS:
        raise ValidationError(_("The table has too many rows."))
    occupied = set()
    width = 0
    for row_index, row in enumerate(rows):
        column = 0
        for cell in row.get("content", []):
            while (row_index, column) in occupied:
                column += 1
            attrs = cell.get("attrs", {})
            right = column + attrs.get("colspan", 1)
            bottom = row_index + attrs.get("rowspan", 1)
            fill_rectangle(occupied, row_index, column, bottom, right, len(rows))
            column = right
            width = max(width, right)
    if not width or len(occupied) != len(rows) * width:
        raise ValidationError(_("Table rows must form a complete rectangle."))


def fill_rectangle(occupied, top, left, bottom, right, row_count):
    if right > MAX_COLUMNS or bottom > row_count:
        raise ValidationError(_("Cell spans extend outside the table."))
    for row in range(top, bottom):
        for column in range(left, right):
            if (row, column) in occupied:
                raise ValidationError(_("Table cells overlap."))
            occupied.add((row, column))
    if len(occupied) > MAX_CELLS:
        raise ValidationError(_("The table has too many cells."))
