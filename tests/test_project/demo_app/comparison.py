"""Matched research examples in each editor's own storage format."""

from uuid import NAMESPACE_URL, uuid5

from django.utils.html import format_html


def text_document(rows, caption):
    return {
        "version": 1,
        "caption": caption,
        "description": "",
        "table": {
            "type": "table",
            "content": [
                {
                    "type": "tableRow",
                    "content": [
                        {
                            "type": "tableHeader" if row_index == 0 else "tableCell",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": text}],
                                }
                            ],
                        }
                        for text in row
                    ],
                }
                for row_index, row in enumerate(rows)
            ],
        },
    }


def stream_items(key, items):
    return [
        {
            "type": block_type,
            "value": value,
            "id": str(uuid5(NAMESPACE_URL, f"wagtail-table/research/{key}/{index}")),
        }
        for index, (block_type, value) in enumerate(items)
    ]


def comparison_example_body(image_id):
    small = [
        ["Item", "Details", "Status"],
        ["Apples", "Fresh fruit", "Available"],
        [
            "Pears",
            "A longer description to inspect wrapping and text selection",
            "Ordered",
        ],
    ]
    wide = [["Item", *[f"Period {column}" for column in range(1, 12)]]]
    wide.extend(
        [f"Product {row}", *[str(row * column) for column in range(1, 12)]]
        for row in range(1, 9)
    )
    body = [
        (
            "paragraph",
            (
                "<p>Compare the same tasks at the same available width. These are native "
                "editors, without research-specific admin CSS. Text-only examples use "
                "matched values; block-content examples document differences in cell "
                "and column configuration. Use the admin edit link to compare interactions.</p>"
            ),
        )
    ]
    for dataset, rows in [("Small", small), ("Wide: 12 columns × 8 data rows", wide)]:
        body.append(("paragraph", str(format_html("<h2>{}</h2>", dataset))))
        body.extend(text_examples(dataset, rows))
    body.extend(block_content_examples(image_id))
    return body


def text_examples(dataset, rows):
    body = []
    editors = [
        ("legacy_table", "Wagtail TableBlock"),
        ("typed_table", "Wagtail TypedTableBlock"),
        ("table", "wagtail-table text"),
        ("research_hybrid_table", "wagtail-table hybrid"),
    ]
    for block_type, title in editors:
        caption = f"{dataset} — {title}"
        body.append(("paragraph", str(format_html("<h3>{}</h3>", title))))
        if block_type == "legacy_table":
            value = {
                "data": rows,
                "table_header_choice": "row",
                "first_row_is_table_header": True,
                "first_col_is_header": False,
                "table_caption": caption,
            }
        elif block_type == "typed_table":
            value = {
                "columns": [{"type": "text", "heading": text} for text in rows[0]],
                "rows": [{"values": row} for row in rows[1:]],
                "caption": caption,
            }
        else:
            value = text_document(rows, caption)
        body.append((block_type, value))

    return body


def block_content_examples(image_id):
    body = []
    body.append(
        (
            "paragraph",
            (
                "<h2>Block content: fields inside cells</h2>"
                "<p>TypedTableBlock assigns a block type to a whole column. The hybrid "
                "table mixes text and Wagtail content per cell. Inspect the plain input, "
                "rich text, image chooser, emoji select, insertion controls, and nested "
                "block actions. These examples intentionally do not have feature parity.</p>"
            ),
        )
    )
    for variant, title in [
        ("typed_table", "Wagtail TypedTableBlock"),
        ("research_hybrid_table", "wagtail-table hybrid"),
    ]:
        body.append(("paragraph", str(format_html("<h3>{}</h3>", title))))
        image = {
            "image": image_id,
            "decorative": False,
            "alt_text": "Teal comparison sample",
        }
        details = [
            stream_items(
                f"{variant}/details/{row}",
                [
                    ("text", "An ordinary text input"),
                    ("rich_text", "<p>Rich text with <b>bold</b> content.</p>"),
                    ("emoji", "ℹ️"),
                ],
            )
            for row in range(2)
        ]
        if variant == "typed_table":
            value = {
                "columns": [
                    {"type": kind, "heading": heading}
                    for kind, heading in [
                        ("text", "Item"),
                        ("blocks", "Details"),
                        ("emoji", "Status"),
                        ("image", "Picture"),
                    ]
                ],
                "rows": [
                    {"values": [name, details[row], "✅", image]}
                    for row, name in enumerate(["Apples", "Pears"])
                ],
                "caption": "Block content — Wagtail TypedTableBlock",
            }
        else:
            value = text_document(
                [
                    ["Item", "Details", "Status", "Picture"],
                    ["Apples", "Details", "✅", "Picture"],
                    ["Pears", "Details", "✅", "Picture"],
                ],
                "Block content — wagtail-table hybrid",
            )
            value["version"] = 2
            for row in range(2):
                cells = value["table"]["content"][row + 1]["content"]
                contents = [
                    (1, details[row]),
                    (3, stream_items(f"{variant}/image/{row}", [("image", image)])),
                ]
                if row == 1:
                    contents.extend(
                        [
                            (0, stream_items(f"{variant}/item", [("text", "Pears")])),
                            (2, stream_items(f"{variant}/status", [("emoji", "✅")])),
                        ]
                    )
                for column, items in contents:
                    cells[column]["content"] = [
                        {"type": "wagtailBlock", "attrs": {"value": items}}
                    ]
        body.append((variant, value))
    return body


def cell_content_value(kind, text, key):
    """Use matched content while keeping native field/sequence storage distinct."""
    if kind == "text":
        return text
    rich_text = str(format_html("<p>{}</p>", text))
    if kind == "rich_text":
        return rich_text
    items = [("rich_text", rich_text)]
    if kind == "blocks":
        items.append(("emoji", "ℹ️"))
    return stream_items(key, items)


def cell_content_example_body():
    rows = [
        ["Item", "Details", "Status"],
        ["Apples", "Fresh fruit", "Available"],
        ["Pears", "Longer text to compare wrapping and cell width", "Ordered"],
    ]
    body = [
        (
            "paragraph",
            (
                "<p>Compare direct fields with one-item and multi-item StreamBlocks. "
                "The main text is matched. The multi-item variant adds an information "
                "emoji to expose sequence controls. Direct fields fix the block type; "
                "one-item StreamBlocks still offer a block choice.</p>"
            ),
        )
    ]
    for title, kind, hybrid_type in [
        ("Direct CharBlock", "text", "char_cell_table"),
        ("Direct RichTextBlock", "rich_text", "richtext_cell_table"),
        ("StreamBlock: at most one item", "one_block", "single_choice_table"),
        ("StreamBlock: multiple items", "blocks", "research_hybrid_table"),
    ]:
        body.append(("paragraph", str(format_html("<h2>{}</h2>", title))))
        for variant, label in [
            ("typed_table", "Wagtail TypedTableBlock"),
            (hybrid_type, "wagtail-table"),
        ]:
            caption = f"{title} — {label}"
            body.append(("paragraph", str(format_html("<h3>{}</h3>", label))))
            values = [
                [
                    cell_content_value(kind, text, f"{variant}/{kind}/{r}/{c}")
                    for c, text in enumerate(row)
                ]
                for r, row in enumerate(rows[1:])
            ]
            if variant == "typed_table":
                value = {
                    "columns": [{"type": kind, "heading": text} for text in rows[0]],
                    "rows": [{"values": row} for row in values],
                    "caption": caption,
                }
            else:
                value = text_document(rows, caption)
                value["version"] = 2
                for row, fields in zip(
                    value["table"]["content"][1:], values, strict=True
                ):
                    for cell, raw in zip(row["content"], fields, strict=True):
                        cell["content"] = [
                            {"type": "wagtailBlock", "attrs": {"value": raw}}
                        ]
            body.append((variant, value))
    return body
