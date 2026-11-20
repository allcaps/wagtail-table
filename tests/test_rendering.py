import pytest

from wagtail_table.blocks import TableBlock


def test_html_structure_and_escaping(table_value):
    text = '<script>alert("unsafe")</script> & example'
    table_value["table"]["content"][1]["content"][0]["content"][0]["content"][0][
        "text"
    ] = text
    html = TableBlock().render(table_value)
    assert html.count("<th>") == 2
    assert html.count("<td>") == 2
    assert "<tbody>" in html
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "&amp; example" in html


def test_merged_cells_render_spans(table_value):
    rows = table_value["table"]["content"]
    rows[0]["content"] = [rows[0]["content"][0]]
    rows[0]["content"][0]["attrs"] = {"colspan": 2}
    assert 'colspan="2"' in TableBlock().render(table_value)


@pytest.mark.parametrize("value", [None, {}, {"version": 99}, "<script>bad</script>"])
def test_invalid_or_empty_data_renders_no_table(value):
    assert "<table" not in TableBlock().render(value)
