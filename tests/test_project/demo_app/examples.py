"""Small native documents for exercising the implemented editing features."""


def example_table(headers="row"):
    rows = []
    for r, values in enumerate(
        [("Product", "2025", "2026"), ("Apples", "4", "7"), ("Pears", "3", "9")]
    ):
        cells = []
        for c, text in enumerate(values):
            header = (r == 0 and headers in {"row", "both"}) or (
                c == 0 and headers in {"column", "both"}
            )
            cells.append(
                {
                    "type": "tableHeader" if header else "tableCell",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": text}],
                        }
                    ],
                }
            )
        rows.append({"type": "tableRow", "content": cells})
    return {
        "version": 1,
        "table": {"type": "table", "content": rows},
        "caption": "",
        "description": "",
    }


def example_tables():
    examples = [
        ("Plain text", example_table("none")),
        ("First row headers", example_table("row")),
        ("First column headers", example_table("column")),
        ("Both header directions", example_table("both")),
    ]
    merged = example_table()
    cells = merged["table"]["content"][0]["content"]
    cells[1]["attrs"] = {"colspan": 2}
    cells[1]["content"][0]["content"][0]["text"] = "Stock counts"
    cells.pop()
    examples.append(("Merged header cells", merged))
    aligned = example_table()
    cells = aligned["table"]["content"][1]["content"]
    cells[1]["attrs"] = {"align": "center", "verticalAlign": "middle"}
    cells[2]["attrs"] = {"align": "right", "verticalAlign": "bottom"}
    cells[0]["content"].append(
        {"type": "paragraph", "content": [{"type": "text", "text": "In stock"}]}
    )
    aligned["caption"] = "Fruit in stock"
    aligned["description"] = "Each product has a count for each year."
    examples.append(("Alignment, caption, and description", aligned))
    return examples
