# WAI-inspired table examples

These fixtures use original sample data to explore the accessibility patterns in
the [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
They contain native version-1 table JSON, not WAI HTML snippets. Each record has
a title, source link, short motivation, optional limitation, and table value.
The explanations are project-authored; the linked WAI pages provide the guidance.

Run `create_examples` in the demo application to create `/table-accessibility/`.
It displays these records through ordinary paragraph and TableBlock instances,
so the editor and Python renderer exercise the same documents. Existing pages
are preserved, including an existing `/table-examples/` page.

| Fixtures | Guidance | Purpose |
| --- | --- | --- |
| `header-row`, `header-column` | [One header direction](https://www.w3.org/WAI/tutorials/tables/one-header/) | Give each value a column or row context. |
| `two-directions`, `offset-headers` | [Two header directions](https://www.w3.org/WAI/tutorials/tables/two-headers/) | Compare edge headers with headers in the second column. |
| `column-spans`, `row-spans` | [Irregular headers](https://www.w3.org/WAI/tutorials/tables/irregular/) | Exercise grouped columns, spanning rows, and multiple header associations. |
| `changing-headers`, `split-capacity`, `split-facilities` | [Multi-level headers](https://www.w3.org/WAI/tutorials/tables/multi-level/) | Show changing header bands and a simpler two-table alternative. |
| `caption-summary` | [Caption and summary](https://www.w3.org/WAI/tutorials/tables/caption-summary/) | Name the table separately from describing its arrangement. |
| `separate-data` | [Tips and tricks](https://www.w3.org/WAI/tutorials/tables/tips/) | Keep separate values in separate cells and align numeric columns. |

The renderer generates `headers` references for supported leading column headers
and first-column row headers, including spans. It does not emit `colgroup`,
multiple `tbody` groups, or `scope="rowgroup"`/`scope="colgroup"` to reproduce the
tutorial's markup. Offset headers and header bands inside the body remain
editable but do not have reliable generated associations. Those fixtures carry
visible warnings and are regression/research cases, not recommended patterns
for publication. They require a renderer design change before that status changes.

Python tests cover validation, persistence, rendering, associations, and page
creation without overwriting edits. TypeScript tests restore every fixture in
the native schema and check its grid using ProseMirror's TableMap. These checks
do not replace screen-reader, keyboard, zoom, and narrow-viewport reviews.
