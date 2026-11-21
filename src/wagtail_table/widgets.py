import json

from django import forms
from django.utils.functional import cached_property
from django.utils.translation import gettext as _
from wagtail.admin.telepath import register
from wagtail.admin.telepath.widgets import WidgetAdapter
from wagtail.blocks.base import BlockWidget

from .data import MAX_JSON_LENGTH
from .hybrid import block_cells


class TableInput(forms.HiddenInput):
    template_name = "wagtail_table/widgets/table.html"
    show_add_comment_button = False

    def __init__(self, attrs=None, cell_block=None):
        self.cell_block = cell_block
        super().__init__(attrs)

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        context["hybrid"] = self.cell_block is not None
        return context

    def value_from_datadict(self, data, files, name):
        raw = super().value_from_datadict(data, files, name)
        if (
            self.cell_block is None
            or not isinstance(raw, str)
            or len(raw) > MAX_JSON_LENGTH
        ):
            return raw
        try:
            value = json.loads(raw)
            for _row, _column, node in block_cells(value):
                attrs = node["attrs"]
                if "prefix" not in attrs:
                    continue
                prefix = attrs.pop("prefix")
                if not isinstance(prefix, str) or not prefix.startswith(
                    f"{name}-cell-"
                ):
                    return raw
                # Native widgets (notably Draftail) have their own form encoding.
                # Let Wagtail decode POST fields rather than inventing a JSON codec.
                native = self.cell_block.value_from_datadict(data, files, prefix)
                attrs["value"] = self.cell_block.get_prep_value(native)
            return json.dumps(value)
        except (TypeError, ValueError, KeyError, AttributeError):
            return raw

    @cached_property
    def media(self):
        media = forms.Media(
            js=["wagtail_table/table.js"],
            css={"all": ["wagtail_table/table.css"]},
        )
        if self.cell_block is not None:
            media += BlockWidget(self.cell_block).media
        return media


class TableInputAdapter(WidgetAdapter):
    js_constructor = "wagtail_table.TableInput"

    def js_args(self, widget):
        return [
            widget.render("__NAME__", None, attrs={"id": "__ID__"}),
            {
                "editor": _("Table contents"),
                "selectCell": _("Select cell, row %(row)s, column %(column)s"),
                "selectCellHelp": _(
                    "Click to select this cell. Shift-click to extend the selection, "
                    "or drag to select cells."
                ),
                "pasteBlocks": _(
                    "Table paste, copy, and cut are unavailable for block cells. "
                    "You can still paste ordinary text into individual text cells."
                ),
                "pasteUnsupported": _(
                    "This paste contains multiple or nested tables, surrounding text, "
                    "or an unsupported table structure. The table was not changed."
                ),
                "pasteLimit": _(
                    "This paste would exceed the table size limit. "
                    "The table was not changed."
                ),
                "pasteFirst": _(
                    "Insert a table before pasting ordinary text, or paste a complete "
                    "HTML table or tab-separated range."
                ),
                "pasteFit": _(
                    "The pasted cells were fitted to the selected range: larger ranges "
                    "are clipped and smaller ranges repeat. "
                    "Undo restores the previous cells."
                ),
                "pasteMerged": _(
                    "Native table paste may split intersecting merged cells and "
                    "replace their contents. Undo restores the previous cells."
                ),
                "unsupported": _(
                    "Only one table with supported cell content can be saved. "
                    "Remove content outside the table before saving."
                ),
                "invalid": _(
                    "This saved table could not be loaded. "
                    "Its original value has been retained."
                ),
            },
            self.block_options(widget),
        ]

    def block_options(self, widget):
        if widget.cell_block is None:
            return None
        value = widget.cell_block.get_default()
        return {
            "definition": widget.cell_block,
            "defaultValue": widget.cell_block.get_prep_value(value),
            "defaultState": widget.cell_block.get_form_state(value),
            "errorMessage": _(
                "This block editor could not be loaded. Its content has been retained."
            ),
        }


register(TableInputAdapter(), TableInput)
