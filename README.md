# wagtail-table

A native Tiptap table editor for Wagtail StreamField. This early alpha provides
native text-table editing, JSON persistence, and safe server-side rendering.

Version `0.1.0a1` is experimental and intended for evaluation. Public APIs and
stored data may change before a stable release; automatic migrations between
alpha versions are not promised. Back up content before upgrading. Hybrid
Wagtail block cells are planned, not implemented. A full accessibility review
and real external-application clipboard checks remain outstanding.

```python
from wagtail import blocks
from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    paragraph = blocks.RichTextBlock()
    table = TableBlock()
```

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

All eight Playwright tests passed in a local run outside the development sandbox,
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

- Native row/column insertion and deletion, rectangular cell selection, merge,
  split, undo, and redo, exposed through compact controls.
- Independent First row headers and First column headers toggles: turn both off
  for no edge headers, or both on for row and column headers. Header cell toggles
  the selected cells individually. The actual native cells determine the control
  states; there is no separately stored header mode.
- Horizontal left/center/right and vertical top/middle/bottom alignment.
- An optional caption and a separate, visible description linked to the published
  table with `aria-describedby`.

Use Tab and Shift+Tab for native cell navigation, Shift+click to select a range,
and Escape to move from the editor to Table actions. Native Tab at the last cell
adds a row. Metadata text inputs use ordinary browser undo; the toolbar Undo and
Redo operate on the native table document.

Merging retains the top-left cell's type and alignment and combines native cell
content. Splitting retains the content in the first cell. Header types inherited
after structural edits are native Tiptap/ProseMirror behavior. The UI reports a
custom layout when individual or merged cells no longer match the edge settings;
changing an edge toggle does not reset unrelated individual headers.

Phase 3 clipboard implementation and automated verification are complete;
see [paste behavior, coverage, and manual checks](https://github.com/allcaps/wagtail-table/blob/main/docs/clipboard.md).
HTML tables and tab-separated ranges use native ProseMirror insertion and table
manipulation. At a text cursor, a range can grow the table; a selected rectangle
clips or repeats the source. Visible help and notices explain this distinction
and merged-cell changes. Unsupported table structures are rejected without
clearing existing cells. The schema prevents nested or unrelated root content.
Unsupported document content must be corrected before saving; it is never
silently discarded. External application clipboard compatibility has not yet
been verified.
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
