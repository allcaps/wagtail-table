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
                "editor": _("Table contents"),
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
