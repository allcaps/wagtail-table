from copy import deepcopy
from html.parser import HTMLParser

import pytest

from wagtail_table.blocks import TableBlock


class TableHTML(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def attrs(self, tag):
        return [attrs for name, attrs in self.elements if name == tag]


def test_html_structure_and_escaping(table_value):
    text = '<script>alert("unsafe")</script> & example'
    table_value["table"]["content"][1]["content"][0]["content"][0]["content"][0][
        "text"
    ] = text
    html = TableBlock().render(table_value)
    assert html.count("<th ") == 2
    assert html.count("<td ") == 2
    assert "<tbody>" in html
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "&amp; example" in html


def test_merged_cells_render_spans(table_value):
    rows = table_value["table"]["content"]
    rows[0]["content"] = [rows[0]["content"][0]]
    rows[0]["content"][0]["attrs"] = {"colspan": 2}
    assert 'colspan="2"' in TableBlock().render(table_value)


def test_native_line_break_round_trip_rendering_and_search(table_value):
    cell = table_value["table"]["content"][1]["content"][0]
    cell["content"][0]["content"] = [
        {"type": "text", "text": "First <safe>"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Second"},
    ]
    block = TableBlock()
    assert block.clean(table_value) == table_value
    html = block.render(table_value)
    assert "First &lt;safe&gt;" in html
    assert "<br>" in html
    assert "Second" in html
    assert "First <safe>" in block.get_searchable_content(table_value)
    assert "Second" in block.get_searchable_content(table_value)


@pytest.mark.parametrize("value", [None, {}, {"version": 99}, "<script>bad</script>"])
def test_invalid_or_empty_data_renders_no_table(value):
    assert "<table" not in TableBlock().render(value)


def test_caption_description_are_escaped_and_accessibly_associated(table_value):
    table_value["caption"] = '<img src=x onerror="bad">'
    table_value["description"] = "Counts <script>bad</script>"
    html = TableBlock().render(table_value)
    parsed = TableHTML(html)
    description_id = parsed.attrs("table")[0]["aria-describedby"]
    assert any(attrs.get("id") == description_id for attrs in parsed.attrs("p"))
    assert "<caption>&lt;img" in html
    assert "Counts &lt;script&gt;" in html
    assert not parsed.attrs("img")
    assert not parsed.attrs("script")


def test_header_row_scope_and_explicit_associations(table_value):
    parsed = TableHTML(TableBlock().render(table_value))
    assert len(parsed.attrs("thead")) == 1
    headers = parsed.attrs("th")
    assert [h["scope"] for h in headers] == ["col", "col"]
    assert [c["headers"] for c in parsed.attrs("td")] == [h["id"] for h in headers]


def test_both_headers_and_ambiguous_corner(table_value):
    table_value["table"]["content"][1]["content"][0]["type"] = "tableHeader"
    parsed = TableHTML(TableBlock().render(table_value))
    corner, column_header, row_header = parsed.attrs("th")
    assert "scope" not in corner
    assert column_header["scope"] == "col"
    assert row_header["scope"] == "row"
    assert parsed.attrs("td")[0]["headers"].split() == [
        column_header["id"],
        row_header["id"],
    ]


def test_first_column_headers_stay_in_tbody(table_value):
    for row in table_value["table"]["content"]:
        row["content"][0]["type"] = "tableHeader"
        row["content"][1]["type"] = "tableCell"
    parsed = TableHTML(TableBlock().render(table_value))
    assert not parsed.attrs("thead")
    assert all(h["scope"] == "row" for h in parsed.attrs("th"))
    assert [c["headers"] for c in parsed.attrs("td")] == [
        h["id"] for h in parsed.attrs("th")
    ]


def test_spanning_column_header_uses_headers_without_false_group_scope(table_value):
    rows = table_value["table"]["content"]
    rows[0]["content"] = [rows[0]["content"][0]]
    rows[0]["content"][0]["attrs"] = {"colspan": 2}
    parsed = TableHTML(TableBlock().render(table_value))
    header = parsed.attrs("th")[0]
    assert "scope" not in header
    assert all(cell["headers"] == header["id"] for cell in parsed.attrs("td"))


def test_multiple_leading_header_levels_have_explicit_associations(table_value):
    rows = table_value["table"]["content"]
    group = deepcopy(rows[0])
    group["content"] = [group["content"][0]]
    group["content"][0]["attrs"] = {"colspan": 2}
    rows.insert(0, group)
    parsed = TableHTML(TableBlock().render(table_value))
    group_header, left, right = parsed.attrs("th")
    assert [c["headers"].split() for c in parsed.attrs("td")] == [
        [group_header["id"], left["id"]],
        [group_header["id"], right["id"]],
    ]


def test_crossing_rowspan_never_crosses_thead_tbody_boundary(table_value):
    rows = table_value["table"]["content"]
    rows[0]["content"][0]["attrs"] = {"rowspan": 2}
    rows[1]["content"].pop(0)
    parsed = TableHTML(TableBlock().render(table_value))
    assert not parsed.attrs("thead")
    assert len(parsed.attrs("tbody")) == 1
    crossing, column_header = parsed.attrs("th")
    assert "scope" not in crossing
    assert parsed.attrs("td")[0]["headers"] == column_header["id"]


def test_spanning_row_header_association(table_value):
    rows = table_value["table"]["content"]
    for row in rows:
        for cell in row["content"]:
            cell["type"] = "tableCell"
    rows[0]["content"][0]["type"] = "tableHeader"
    rows[0]["content"][0]["attrs"] = {"rowspan": 2}
    rows[1]["content"].pop(0)
    parsed = TableHTML(TableBlock().render(table_value))
    header = parsed.attrs("th")[0]
    assert "scope" not in header
    assert all(cell["headers"] == header["id"] for cell in parsed.attrs("td"))


def test_interior_header_does_not_gain_a_guessed_scope(table_value):
    rows = table_value["table"]["content"]
    rows.append(deepcopy(rows[1]))
    rows[1]["content"][1]["type"] = "tableHeader"
    parsed = TableHTML(TableBlock().render(table_value))
    interior = parsed.attrs("th")[-1]
    assert "scope" not in interior
    assert all(
        interior["id"] not in cell.get("headers", "").split()
        for cell in parsed.attrs("td")
    )


def test_each_render_has_unique_accessibility_ids(table_value):
    table_value["description"] = "Counts"
    first = TableHTML(TableBlock().render(table_value))
    second = TableHTML(TableBlock().render(table_value))
    first_ids = {attrs["id"] for _, attrs in first.elements if "id" in attrs}
    second_ids = {attrs["id"] for _, attrs in second.elements if "id" in attrs}
    assert first_ids.isdisjoint(second_ids)


@pytest.mark.parametrize("horizontal", ["left", "center", "right"])
@pytest.mark.parametrize("vertical", ["top", "middle", "bottom"])
def test_alignment_round_trip_and_class_rendering(table_value, horizontal, vertical):
    cell = table_value["table"]["content"][1]["content"][1]
    cell["attrs"] = {"align": horizontal, "verticalAlign": vertical}
    block = TableBlock()
    assert block.clean(block.get_prep_value(table_value)) == table_value
    html = block.render(table_value)
    assert f"wagtail-table-align-{horizontal}" in html
    assert f"wagtail-table-valign-{vertical}" in html
    assert "style=" not in html
