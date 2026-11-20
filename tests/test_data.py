import pytest
from django.core.exceptions import ValidationError

from wagtail_table.blocks import TableBlock
from wagtail_table.data import MAX_JSON_LENGTH, validate_value


@pytest.mark.parametrize("value", [True, [], {}, 5, {"version": True}, {"version": 2}])
def test_invalid_wrappers(value):
    with pytest.raises(ValidationError):
        validate_value(value)


@pytest.mark.parametrize("node_type", ["script", "image", "table", [], None])
def test_unsupported_cell_content(table_value, node_type):
    table_value["table"]["content"][0]["content"][0]["content"][0]["type"] = node_type
    with pytest.raises(ValidationError):
        validate_value(table_value)


@pytest.mark.parametrize(
    "attrs",
    [
        {"rowspan": True},
        {"rowspan": 0},
        {"colspan": -1},
        {"colspan": 101},
        {"rowspan": 10},
        {"align": "justify"},
        {"verticalAlign": "baseline"},
        {"verticalAlign": 'top" onclick="bad'},
        {"style": "color:red"},
        {"onclick": "alert(1)"},
        {"colwidth": ["100"]},
        {"colwidth": [100, 100]},
    ],
)
def test_invalid_cell_attrs(table_value, attrs):
    table_value["table"]["content"][0]["content"][0]["attrs"] = attrs
    with pytest.raises(ValidationError):
        validate_value(table_value)


def test_ragged_table(table_value):
    table_value["table"]["content"][1]["content"].pop()
    with pytest.raises(ValidationError, match="rectangle"):
        validate_value(table_value)


def test_merged_rows_allow_a_row_covered_by_rowspans(table_value):
    for cell in table_value["table"]["content"][0]["content"]:
        cell["attrs"] = {"rowspan": 2}
    table_value["table"]["content"][1]["content"] = []
    validate_value(table_value)


def test_overlap_rejected(table_value):
    # A rowspan from column 1 collides with a colspan from column 0 below it.
    rows = table_value["table"]["content"]
    rows[0]["content"][1]["attrs"] = {"rowspan": 2}
    rows[1]["content"] = [rows[1]["content"][0]]
    rows[1]["content"][0]["attrs"] = {"colspan": 2}
    with pytest.raises(ValidationError, match="overlap"):
        validate_value(table_value)


def test_marks_are_rejected(table_value):
    text = table_value["table"]["content"][0]["content"][0]["content"][0]["content"][0]
    text["marks"] = [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]
    with pytest.raises(ValidationError):
        validate_value(table_value)


def test_line_breaks_cannot_carry_arbitrary_attributes(table_value):
    paragraph = table_value["table"]["content"][0]["content"][0]["content"][0]
    paragraph["content"] = [{"type": "hardBreak", "attrs": {"onclick": "bad"}}]
    with pytest.raises(ValidationError):
        validate_value(table_value)


def test_input_size_and_deep_json():
    with pytest.raises(ValidationError, match="large"):
        TableBlock().clean(" " * (MAX_JSON_LENGTH + 1))
    with pytest.raises(ValidationError):
        TableBlock().clean("[" * 2000 + "]" * 2000)
