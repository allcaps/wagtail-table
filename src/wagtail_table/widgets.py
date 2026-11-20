from django import forms
from django.utils.functional import cached_property
from django.utils.translation import gettext as _
from wagtail.admin.telepath import register
from wagtail.admin.telepath.widgets import WidgetAdapter


class TableInput(forms.HiddenInput):
    template_name = "wagtail_table/widgets/table.html"
    show_add_comment_button = False

    @cached_property
    def media(self):
        return forms.Media(
            js=["wagtail_table/table.js"],
            css={"all": ["wagtail_table/table.css"]},
        )


class TableInputAdapter(WidgetAdapter):
    js_constructor = "wagtail_table.TableInput"

    def js_args(self, widget):
        return [
            widget.render("__NAME__", None, attrs={"id": "__ID__"}),
            {
                "insert": _("Insert table"),
                "editor": _("Table contents"),
                "pasteHelp": _(
                    "Paste at a text cursor to grow the table. A selected cell range "
                    "clips or repeats pasted cells. Paste can split merged cells. "
                    "Undo restores the previous table."
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
                "undo": _("Undo"),
                "redo": _("Redo"),
                "actions": _("Table actions"),
                "settings": _("Table settings"),
                "rows": _("Rows"),
                "columns": _("Columns"),
                "choose": _("Choose…"),
                "addRowBefore": _("Add row before"),
                "addRowAfter": _("Add row after"),
                "deleteRow": _("Delete row"),
                "addColumnBefore": _("Add column before"),
                "addColumnAfter": _("Add column after"),
                "deleteColumn": _("Delete column"),
                "mergeCells": _("Merge cells"),
                "splitCell": _("Split cell"),
                "toggleHeaderCell": _("Header cell"),
                "toggleHeaderRow": _("First row headers"),
                "toggleHeaderColumn": _("First column headers"),
                "headerHelp": _(
                    "Custom headers: keep headers in the top rows or first column "
                    "for clear relationships."
                ),
                "horizontal": _("Horizontal alignment"),
                "vertical": _("Vertical alignment"),
                "left": _("Left"),
                "center": _("Center"),
                "right": _("Right"),
                "top": _("Top"),
                "middle": _("Middle"),
                "bottom": _("Bottom"),
                "caption": _("Caption"),
                "description": _("Description"),
                "metadataHelp": _(
                    "The caption names the table. The description explains how to read it."
                ),
                "unsupported": _(
                    "Only one table with plain text paragraphs can be saved. "
                    "Remove content outside the table before saving."
                ),
                "invalid": _(
                    "This saved table could not be loaded. "
                    "Its original value has been retained."
                ),
            },
        ]


register(TableInputAdapter(), TableInput)
