"""Build safe template data and conservative associations for edge headers."""

from dataclasses import dataclass
from uuid import uuid4


@dataclass
class Cell:
    header: bool
    content: list
    row: int
    column: int
    rowspan: int
    colspan: int
    classes: str
    id: str = ""
    scope: str = ""
    headers: str = ""

    @property
    def bottom(self):
        return self.row + self.rowspan

    @property
    def right(self):
        return self.column + self.colspan


def table_context(value):
    """Input has already passed server validation; no saved HTML is rendered."""
    prefix = f"table-{uuid4().hex}"
    rows = layout_rows(value["table"]["content"])
    cells = [cell for row in rows for cell in row]
    leading = leading_header_rows(rows)
    associate_headers(cells, leading, prefix)
    # A row span may not cross HTML row-group boundaries. Keep a single tbody
    # when a header reaches into the body; do not change or split saved cells.
    head_count = leading
    if any(cell.row < leading < cell.bottom for cell in cells):
        head_count = 0
    return {
        "rows": rows,
        "head_rows": rows[:head_count],
        "body_rows": rows[head_count:],
        "caption": value.get("caption", ""),
        "description": value.get("description", ""),
        "description_id": f"{prefix}-description",
    }


def layout_rows(rows):
    """Read cell coordinates for rendering; table edits remain ProseMirror's job."""
    occupied = set()
    result = []
    for row_index, row in enumerate(rows):
        cells = []
        column = 0
        for node in row.get("content", []):
            while (row_index, column) in occupied:
                column += 1
            attrs = node.get("attrs", {})
            cell = Cell(
                header=node["type"] == "tableHeader",
                content=node["content"],
                row=row_index,
                column=column,
                rowspan=attrs.get("rowspan", 1),
                colspan=attrs.get("colspan", 1),
                classes=alignment_classes(attrs),
            )
            cells.append(cell)
            occupied.update(
                (r, c)
                for r in range(cell.row, cell.bottom)
                for c in range(cell.column, cell.right)
            )
            column = cell.right
        result.append(cells)
    return result


def alignment_classes(attrs):
    classes = []
    if attrs.get("align"):
        classes.append(f"wagtail-table-align-{attrs['align']}")
    if attrs.get("verticalAlign"):
        classes.append(f"wagtail-table-valign-{attrs['verticalAlign']}")
    return " ".join(classes)


def leading_header_rows(rows):
    count = 0
    for row in rows:
        if not row or not all(cell.header for cell in row):
            break
        count += 1
    return count


def associate_headers(cells, leading, prefix):
    headers = [cell for cell in cells if cell.header]
    row_headers = [cell for cell in headers if cell.column == 0 and cell.row >= leading]
    column_headers = [
        cell
        for cell in headers
        if cell.row < leading
        and cell.bottom <= leading
        and not (cell.column == 0 and row_headers)
    ]
    for cell in headers:
        cell.id = f"{prefix}-r{cell.row}-c{cell.column}"
    for header in row_headers:
        header.scope = "row" if header.rowspan == 1 else ""
    for header in column_headers:
        header.scope = "col" if header.colspan == 1 else ""
    for cell in cells:
        if cell.header:
            continue
        cell.headers = " ".join(
            header.id
            for header in column_headers
            if header.bottom <= cell.row
            and header.column < cell.right
            and cell.column < header.right
        )
        row_ids = [
            header.id
            for header in row_headers
            if header.right <= cell.column
            and header.row < cell.bottom
            and cell.row < header.bottom
        ]
        cell.headers = " ".join(filter(None, [cell.headers, *row_ids]))
