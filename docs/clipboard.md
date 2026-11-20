# Clipboard behavior and verification

Phase 3 implementation, build checks, and automated verification are complete.
The user's full eight-test Playwright run passed in 10.4 seconds, including real
browser clipboard paste and persistence. External-application interoperability
is not yet manually verified.

## Policy

Use a text cursor inside a cell when the pasted range should determine its size.
ProseMirror grows the table to the right and bottom as needed. It replaces cells
in that rectangle and retains cells outside it.

A native cell selection, shown as highlighted cells, is different: the selected
rectangle determines the size. ProseMirror clips a larger source and repeats a
smaller one to fill the selection. The editor displays a notice when sizes differ.
To retain the whole source, undo, place a text cursor in one cell, and paste again.

Merged source cells retain supported rowspans and colspans. Native paste may
split destination spans that intersect the pasted rectangle and replace their
contents. A notice explains this when the source or destination contains spans.
Undo restores the previous document. The package does not implement its own
table insertion, resizing, merging, or clipping algorithm.

TSV creates data cells. HTML supplies its own th/td types. Replaced destination
headers can therefore change type; the header controls derive their state from
the resulting native nodes. Paste does not reapply a separately stored header
preset.

## Accepted content

- One HTML table, with supported cell text, paragraphs, line breaks, header cells,
  spans, and horizontal/vertical alignment. Unsupported fonts, colors, links,
  images, scripts, and arbitrary attributes do not become saved rich content.
- Tab-separated text with CRLF or LF rows, quoted fields, doubled quotes, empty
  fields, and trailing empty columns. Ragged TSV rows are padded with empty cells.
  One final row terminator is ignored. A quoted field may contain tabs/newlines.
- Ordinary text and multiline prose paste into the current cell. A single-column
  plain-text range without tabs is indistinguishable from prose and stays in
  that cell; use an HTML table to preserve a single-column rectangular range.

An empty block accepts an HTML table or TSV range to create its table. Ordinary
text requires an existing table. The native schema permits only one root table
and paragraph content in cells, preventing unrelated root content and nesting.

HTML containing multiple/nested tables or meaningful text around a table is
rejected as a whole. Invalid TSV quoting and unsupported spans are rejected too.
An empty/rejected parsed slice is intercepted before native cell-range paste so
it cannot accidentally clear the selected cells. Existing content stays intact.

Clipboard captions are not imported and do not overwrite widget metadata.
Column widths are discarded as layout formatting. Formula expressions remain
plain text; no calculation or spreadsheet formatting is supported.

Input limits are 2,000,000 characters, 1,000 rows, 100 columns, and 10,000 logical
grid slots. Source and destination growth are checked before table insertion.
The server also validates the saved JSON independently.

## Automated coverage

The new Playwright tests use synthetic ClipboardEvents to exercise the real DOM
paste pipeline. A separate admin journey writes known TSV using the browser
Clipboard API and pastes with the platform keyboard shortcut, then saves,
reloads, publishes, and checks the public HTML. It requires Chromium clipboard
permissions and uses the test server's localhost origin.

Current checks: 73 Python tests and 17 TypeScript tests pass, including native
browser-pasted line breaks through Wagtail draft/save/publish views. Connected
browser checks cover the representative HTML formats, preserved line breaks,
growth, native undo/redo, range fitting, spans, and non-destructive rejection.
Run `make test-browser` locally to execute the complete eight-test browser suite.

`office-like.html` and `sheets-like.html` are handcrafted format examples. They
are not captures from Excel, Sheets, or Word and do not establish compatibility
with those applications. `large.tsv` is a generated 31×8 sample; its native pasted
JSON is included in the demo examples.

Baseline observations before customization:

| Case | Stock behavior observed in a browser | Package change |
| --- | --- | --- |
| HTML rectangle at a cursor | Correct placement and growth | Retained |
| HTML rectangle in a cell selection | Clipping/repetition | Retained with help and notices |
| Merged source/destination | Spans preserved or split by native paste | Retained with a notice |
| TSV | Tabs and lines remained inside one cell | Small TSV-to-native-slice adapter |
| HTML br | Became whitespace | Official free HardBreak extension; preservation verified in a browser |
| Nested HTML table | Nested table accepted inside a cell | Native cell schema restricted to paragraphs, plus rejection guard |
| Empty/general document | General-purpose root block content allowed | Native document schema restricted to one optional table |

## Manual interoperability checks

Run the demo and create a fresh table for each source. Use distinct values such
as A1/B1/A2/B2 so shifted or clipped values are obvious.

1. Copy a 2×2 range containing a blank cell and paste at a text cursor. Check its
   placement, the blank cell, and unchanged content outside the pasted rectangle.
2. Repeat near the bottom/right edge. Check table growth, undo, and redo.
3. Select a smaller native cell range and paste a larger source. Check clipping
   and the notice. Undo, then paste at a text cursor to retain the whole range.
4. Select a larger range and paste a smaller source. Check repetition and the notice.
5. Copy a source with merged cells; also paste an unmerged source into a merged
   destination. Inspect spans, contents, and undo before saving.
6. Include a quoted/multiline value and non-ASCII characters. Check line breaks
   and characters after save/reload and on the published page.
7. For HTML sources, check th/td and supported alignment. Unsupported formatting
   should be dropped without executing code or introducing arbitrary content.

Record the OS, source application/version, browser/version, copy method, actual
observations, and any captured non-sensitive fixture when reporting a result.

| Source | Status |
| --- | --- |
| Excel desktop/web | Not manually verified |
| Google Sheets | Not manually verified |
| Word desktop/web | Not manually verified |
| Website HTML table | Not manually verified against a specific site |
| TSV from a text editor | Browser pipeline tested; external-editor copy path not manually verified |

Do not replace these statuses with broad compatibility claims based solely on
the synthetic fixtures or browser-generated clipboard payloads.
