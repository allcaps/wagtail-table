# wagtail-table

A native Tiptap table editor for Wagtail StreamField. This early alpha provides
native text-table editing, JSON persistence, and safe server-side rendering.

Version `0.1.0a1` is experimental and intended for evaluation. Public APIs and
stored data may change before a stable release; automatic migrations between
alpha versions are not promised. Back up content before upgrading. This checkout
also includes experimental hybrid cells, which are not in the published
`0.1.0a1` release. A full accessibility review and real external-application
clipboard checks remain outstanding.

```python
from wagtail import blocks
from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    paragraph = blocks.RichTextBlock()
    table = TableBlock()
```

## Experimental hybrid cells (unreleased)

Pass a native Wagtail block definition as `cell_block`. Use a direct block when
converted cells should always contain that field type, without StreamBlock
insertion, reorder, and item-choice controls:

```python
from wagtail import blocks
from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    text_table = TableBlock(cell_block=blocks.CharBlock())
    rich_table = TableBlock(
        cell_block=blocks.RichTextBlock(features=["bold", "italic", "link"])
    )
```

A StreamBlock adds a choice of content and allows multiple items per cell, using
Wagtail's own inline controls. Any limits configured on that StreamBlock apply.

```python
from wagtail import blocks
from wagtail.images.blocks import ImageBlock
from wagtail_table.blocks import TableBlock


cell_content = blocks.StreamBlock([
    ("rich_text", blocks.RichTextBlock(features=["bold", "italic", "link"])),
    ("image", ImageBlock()),
    ("emoji", blocks.ChoiceBlock(choices=[("✅", "✅ Yes"), ("⭐", "⭐ Star")])),
])


class ContentBlock(blocks.StreamBlock):
    table = TableBlock(cell_block=cell_content)
```

For a choice of block types with at most one item, configure the native limit:

```python
single_item_content = blocks.StreamBlock(
    [("rich_text", blocks.RichTextBlock()), ("image", ImageBlock())],
    max_num=1,
)
single_item_table = TableBlock(cell_block=single_item_content)
```

A one-item StreamBlock still has sequence and choice controls; it is not the same
interface as a direct block. No one-item limit is imposed on other configurations.

Cells start as native text cells. Select one or more cells and choose **Cell → Use
Wagtail block**. A direct block displays its configured field immediately; a
StreamBlock offers its configured choices and insertion controls. Choose
**Use text** to switch back. Changing a populated cell asks for confirmation
before clearing its contents. Cells already of the requested type retain their
contents. `TableBlock()` continues to provide text-only tables.

This first hybrid version has deliberate limits:

- Merging a selection containing block cells is disabled. Splitting keeps the
  content in the original cell; new cells are ordinary text cells.
- Tabular paste is blocked while a table contains block cells. Ordinary text
  paste into individual text cells still works. Table selections containing block
  cells cannot be copied, cut, or dragged; copying inside Wagtail's own editors
  follows their normal behavior. Table drops are blocked in hybrid tables.
- Tiptap history handles table/text edits; Wagtail rich text uses its own history.
  This is not a shared undo stack across both editors.
- Cell-specific comment anchoring is disabled until cells have stable comment paths.
- Inline block controls can make tables large. Keyboard/focus and browser
  integration coverage must be reviewed locally before production use.

Existing text tables retain version-1 JSON. Tables with block cells use version 2
and store native Wagtail prepared values in a `wagtailBlock` node. Form prefixes,
chooser previews, and Draftail editor state are not stored. There are no new
persistent cell IDs. Wagtail validates and renders configured blocks, including
image alt text and reference tracking; unsupported block types are rejected.
Required block fields may be incomplete in drafts but must validate on publish.

Run the demo migrations and `create_examples` to add `/table-hybrid/`. This page
contains editable rich text and emoji; empty cells let you try the image chooser.

Install the alpha once published:

```sh
pip install wagtail-table==0.1.0a1
```

Add `"wagtail_table"` to
`INSTALLED_APPS`. Use `ContentBlock()` in a normal StreamField and FieldPanel.
Render with Wagtail's `{% include_block page.body %}`. No frontend JavaScript
or Node.js is required by the installed Python package.

## Development

Local checks currently pass on Python 3.13, Wagtail 8.1, and Django 6.1.
Use Node 22.15+ for frontend development. CI will target the current verified
stack, with newer versions evaluated as development moves forward. A broader
compatibility matrix is deferred; other versions allowed by the package's
dependency bounds have not yet been verified.

```sh
make install
make build
make test
npx playwright install chromium
make test-browser
make check-distribution
```

The original eight Playwright tests passed in a local run outside the development sandbox,
including real browser Clipboard API paste, native editing, and save/publish
journeys. Backend draft/publish round trips are covered by pytest. The sandbox
itself blocks the local server and browser process.

Start the SQLite demo with `make demo`. Create a local admin account separately:

```sh
.venv/bin/python tests/test_project/manage.py createsuperuser
```

Visit `/admin/` to edit the example page and `/` to inspect published HTML.
`make demo` also creates `/table-examples/`, showing the four header configurations,
merged cells, alignment, captions, descriptions, and a larger TSV-pasted table.
It also creates `/table-accessibility/` with 11 original JSON examples inspired by
the [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/). Each includes
its motivation and a source link. Offset headers and changing header bands carry
visible warnings about current rendering limitations. Fixture details are in
[the accessibility fixture guide](tests/fixtures/accessibility/README.md).
The `/table-editor-comparison/` page places native Wagtail TableBlock,
TypedTableBlock, and our text/hybrid editors in the same admin form, with matched
small and wide examples and mixed block content. The
[hybrid interaction study](docs/research/table-editor-ux/hybrid-interactions.md)
records the baseline, screenshots, and proposed experiments.
The `/table-cell-content-comparison/` page focuses on direct CharBlock and
RichTextBlock cells versus one-item and multi-item StreamBlocks, paired with
TypedTableBlock examples. Existing comparison pages do not need to be reset.
Existing content is preserved; existing example pages are not rewritten.
For an already running demo, add the examples with:

```sh
.venv/bin/python tests/test_project/manage.py create_examples
```

The browser tests use their own temporary database and local test credentials.

Authored TypeScript/CSS lives in `frontend/`; generated assets are committed
under `src/wagtail_table/static/wagtail_table/`. Run `make build` after frontend
changes. `npm run check:assets` rebuilds and compares their contents.
`uv build` creates a wheel and sdist containing prebuilt assets, with no npm build
step during Python installation.

## Current scope

The editor uses native table nodes and stores one table per block in versioned
JSON. Current features include:

- New blocks start with a blank 3×3 table and a header row. Insert table appears
  only when the editor contains no table, including after selecting and deleting
  the table. Saved empty drafts stay empty when reopened. Typing into an empty
  editor can create a native 1×1 table; Insert table creates the usual 3×3 table.
- Labelled Row, Column, and Cell action menus use Wagtail's dropdowns.
  Row and Column contain insertion/deletion commands; Cell contains merge,
  split, header-cell, and selected-cell alignment controls. Opening a menu closes
  the previous one. Empty editors show only an Insert table button in the toolbar.
- Independent First row headers and First column headers toggles: turn both off
  for no edge headers, or both on for row and column headers. Header cell toggles
  the selected cells individually. The actual native cells determine the control
  states; there is no separately stored header mode. Find these edge toggles in
  the Row and Column menus respectively.
- Horizontal left/center/right and vertical top/middle/bottom alignment, with
  compact icon buttons grouped under horizontal and vertical labels in Cell.
  Each group ends with Clear to restore default alignment. Buttons have
  accessible names and hover/focus tooltips. Mixed selections have no active option.
- An optional Caption and a separate, visible Summary linked to the published
  table with `aria-describedby`. Both fields remain visible below the table.
  Summary is stored in the existing `description` property.

Use Tab and Shift+Tab for native cell navigation, Shift+click to select a range,
and Escape to move from the editor to Row, or Insert table when empty. Escape inside a menu
closes it and returns focus to its button. Native Tab at the last cell adds a row.
Use the native undo/redo keyboard shortcuts for table edits. Metadata text inputs
use ordinary browser undo.

Merging retains the top-left cell's type and alignment and combines native cell
content. Splitting retains the content in the first cell. Header types inherited
after structural edits are native Tiptap/ProseMirror behavior. The UI reports a
custom layout when individual or merged cells no longer match the edge settings;
each edge button still highlights when its entire first row or column contains
headers. Changing an edge toggle does not reset unrelated individual headers.

Phase 3 clipboard implementation and automated verification are complete;
see [paste behavior, coverage, and manual checks](https://github.com/allcaps/wagtail-table/blob/main/docs/clipboard.md).
HTML tables and tab-separated ranges use native ProseMirror insertion and table
manipulation. At a text cursor, a range can grow the table; a selected rectangle
clips or repeats the source. Visible help and notices explain this distinction
and merged-cell changes. Unsupported table structures are rejected without
clearing existing cells. The schema prevents nested or unrelated root content.
Unsupported document content must be corrected before saving; it is never
silently discarded. Text-only documents, multiple tables, and any paragraphs
before or after the table are invalid, even when saving a draft.

TableBlock is required by default: Wagtail permits a missing table in an
incomplete draft but prevents publishing until a table is present. A table with
blank cells is valid. Use `TableBlock(required=False)` to permit an absent table
on publication. This uses Wagtail's existing required-field validation.
External application clipboard compatibility has not yet been verified.
Malformed or unsupported saved values are retained read only; a repair UI is
not implemented.

## Published tables

Published tables use semantic HTML with escaped text. Leading header rows use
`thead` when no cell span crosses into the body. Simple edge headers receive
`scope`; merged edge headers use explicit `id`/`headers` associations without
inventing row or column groups. Accessibility IDs are unique per render and are
not stored cell IDs.

Automatic relationships cover identifiable leading header rows and first-column
headers. Interior headers, corner headers with two possible directions, and
headers spanning from the header band into data do not receive guessed scopes
or outgoing associations. Individual `th` cells are preserved in place. Such
layouts require review and may need simplification; this package does not yet
provide a manual header-association editor or guarantee arbitrary complex tables
are accessible.

Include the supplied alignment classes in your public base template:

```django
{% load static %}
<link rel="stylesheet" href="{% static 'wagtail_table/table-public.css' %}">
```

Site layout, borders, and typography remain under the integrator's control.
No public JavaScript is needed.

## Releases

See the [release checklist](https://github.com/allcaps/wagtail-table/blob/main/docs/releases.md)
and [changelog](https://github.com/allcaps/wagtail-table/blob/main/CHANGELOG.md).
Version numbers live in `pyproject.toml`; matching `v*` tags trigger verification
and PyPI Trusted Publishing through the GitHub `pypi` environment.
`make check-distribution` checks wheel/sdist contents, rebuilds from the sdist,
and installs and renders the package in an isolated environment with Node/npm
unavailable. It requires uv and the installed test dependencies and replaces
old wheel/sdist files in `dist/` only after all checks pass.

The project uses BSD-3-Clause; bundled dependency license texts ship alongside
the generated admin assets.
