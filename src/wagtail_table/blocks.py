import json
import logging

from django import forms
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from wagtail.blocks import FieldBlock

from .data import MAX_JSON_LENGTH, validate_value
from .rendering import table_context
from .widgets import TableInput

logger = logging.getLogger(__name__)


class TableJSONField(forms.JSONField):
    def validate(self, value):
        super().validate(value)
        validate_value(value)

    def to_python(self, value):
        if isinstance(value, str) and len(value) > MAX_JSON_LENGTH:
            raise ValidationError(_("The table document is too large."))
        try:
            return super().to_python(value)
        except RecursionError as error:
            raise ValidationError(
                _("The table document is nested too deeply.")
            ) from error


class TableBlock(FieldBlock):
    def __init__(self, required=True, help_text=None, **kwargs):
        self.field_options = {"required": required, "help_text": help_text}
        super().__init__(**kwargs)

    @cached_property
    def field(self):
        return TableJSONField(widget=TableInput(), **self.field_options)

    def get_form_state(self, value):
        # StreamField expects JSON state; the underlying input submits a JSON string.
        # Invalid POST data stays intact so validation can report it without loss.
        if isinstance(value, str):
            try:
                parsed = self.field.to_python(value)
            except ValidationError:
                return value
        else:
            parsed = value
        try:
            validate_value(parsed)
        except ValidationError:
            return value if isinstance(value, str) else json.dumps(value)
        return parsed

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context["rows"] = []
        if value is None:
            return context
        try:
            validate_value(value)
        except ValidationError:
            logger.warning("Refusing to render an invalid wagtail-table document")
            return context
        context.update(table_context(value))
        return context

    def get_searchable_content(self, value):
        try:
            validate_value(value)
        except ValidationError:
            return []
        if value is None:
            return []
        metadata = [value.get("caption", ""), value.get("description", "")]
        return [text for text in metadata if text] + [
            text["text"]
            for row in value["table"]["content"]
            for cell in row.get("content", [])
            for paragraph in cell["content"]
            for text in paragraph.get("content", [])
            if text["type"] == "text"
        ]

    class Meta:
        icon = "table"
        template = "wagtail_table/table.html"
        default = None
