import json
import logging

from django import forms
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from wagtail.blocks import Block, FieldBlock

from .data import MAX_JSON_LENGTH, default_table_value, validate_value
from .hybrid import block_cells, block_value, clean_cells, form_state
from .rendering import table_context
from .widgets import TableInput

logger = logging.getLogger(__name__)


class TableJSONField(forms.JSONField):
    def __init__(self, *args, cell_block=None, **kwargs):
        self.cell_block = cell_block
        super().__init__(*args, **kwargs)

    def validate(self, value):
        super().validate(value)
        validate_value(value, allow_blocks=self.cell_block is not None)

    def clean(self, value):
        value = clean_cells(super().clean(value), self.cell_block)
        validate_value(value, allow_blocks=self.cell_block is not None)
        return value

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
    def __init__(self, required=True, help_text=None, cell_block=None, **kwargs):
        if cell_block is not None and not isinstance(cell_block, Block):
            raise TypeError("cell_block must be a Wagtail block instance.")
        self.cell_block = cell_block
        self.field_options = {"required": required, "help_text": help_text}
        super().__init__(**kwargs)

    def defer_required_validation(self):
        super().defer_required_validation()
        if self.cell_block is not None and not self.cell_block.is_deferred_validation:
            self.cell_block.defer_required_validation()

    def restore_deferred_validation(self):
        super().restore_deferred_validation()
        if self.cell_block is not None and self.cell_block.is_deferred_validation:
            self.cell_block.restore_deferred_validation()

    @cached_property
    def field(self):
        return TableJSONField(
            widget=TableInput(cell_block=self.cell_block),
            cell_block=self.cell_block,
            **self.field_options,
        )

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
            validate_value(parsed, allow_blocks=self.cell_block is not None)
            return form_state(parsed, self.cell_block)
        except (ValidationError, TypeError, ValueError, KeyError, AssertionError):
            return value if isinstance(value, str) else json.dumps(value)

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context["rows"] = []
        if value is None:
            return context
        try:
            validate_value(value, allow_blocks=self.cell_block is not None)
            value = clean_cells(value, self.cell_block)
        except ValidationError:
            logger.warning("Refusing to render an invalid wagtail-table document")
            return context
        context.update(table_context(value))
        for row in context["rows"]:
            for cell in row:
                if cell.content[0]["type"] == "wagtailBlock":
                    native = block_value(
                        self.cell_block, cell.content[0]["attrs"]["value"]
                    )
                    cell.block = self.cell_block.bind(native)
        return context

    def get_searchable_content(self, value):
        try:
            validate_value(value, allow_blocks=self.cell_block is not None)
        except ValidationError:
            return []
        if value is None:
            return []
        metadata = [value.get("caption", ""), value.get("description", "")]
        result = [text for text in metadata if text] + [
            text["text"]
            for row in value["table"]["content"]
            for cell in row.get("content", [])
            for paragraph in cell["content"]
            for text in paragraph.get("content", [])
            if text["type"] == "text"
        ]
        for _row, _column, node in block_cells(value):
            native = block_value(self.cell_block, node["attrs"]["value"])
            result.extend(self.cell_block.get_searchable_content(native))
        return result

    def extract_references(self, value):
        validate_value(value, allow_blocks=self.cell_block is not None)
        for row, column, node in block_cells(value):
            native = block_value(self.cell_block, node["attrs"]["value"])
            for (
                model,
                object_id,
                model_path,
                content_path,
            ) in self.cell_block.extract_references(native):
                prefix = f"table.{row}.{column}"
                yield (
                    model,
                    object_id,
                    ".".join(filter(None, [prefix, model_path])),
                    ".".join(filter(None, [prefix, content_path])),
                )

    def get_block_by_content_path(self, value, path_elements):
        if not path_elements:
            return self.bind(value)
        if len(path_elements) < 3 or path_elements[0] != "table":
            return None
        for row, column, node in block_cells(value):
            if path_elements[1:3] == [str(row), str(column)]:
                native = block_value(self.cell_block, node["attrs"]["value"])
                return self.cell_block.get_block_by_content_path(
                    native, path_elements[3:]
                )
        return None

    class Meta:
        icon = "table"
        template = "wagtail_table/table.html"
        default = staticmethod(default_table_value)
