"""Small native documents for exercising the implemented editing features."""

import json
from pathlib import Path

from django.utils.html import format_html


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
    pasted = json.loads(
        (
            Path(__file__).resolve().parents[2] / "fixtures/clipboard/native-large.json"
        ).read_text()
    )
    examples.append(("Larger table pasted from TSV", pasted))
    return examples


def accessibility_examples():
    return json.loads(
        (
            Path(__file__).resolve().parents[2]
            / "fixtures/accessibility/wai-tables.json"
        ).read_text()
    )


def accessibility_example_body():
    body = [
        (
            "paragraph",
            (
                "<p>These original sample tables explore the patterns in the "
                '<a href="https://www.w3.org/WAI/tutorials/tables/">W3C WAI Tables '
                "Tutorial</a>. They use wagtail-table JSON and its normal renderer; "
                "no tutorial HTML is embedded. Each example explains its purpose and "
                "links to the source guidance. Some intentionally demonstrate current "
                "renderer limitations. These examples are not an accessibility "
                "certification; screen-reader and usability checks are still needed.</p>"
            ),
        )
    ]
    for example in accessibility_examples():
        body.append(
            (
                "paragraph",
                str(
                    format_html(
                        '<h2>{}</h2><p>{}</p><p><a href="{}">WAI guidance</a></p>',
                        example["title"],
                        example["motivation"],
                        example["source"],
                    )
                ),
            )
        )
        if example["limitation"]:
            body.append(
                ("paragraph", str(format_html("<p>{}</p>", example["limitation"])))
            )
        body.append(("table", example["value"]))
    return body
