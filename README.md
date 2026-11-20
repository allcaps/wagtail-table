# wagtail-table

A native Tiptap table editor for Wagtail StreamField. This is an early alpha:
Phase 1 provides basic text tables, persistence, and safe server-side rendering.

```python
from wagtail import blocks
from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    paragraph = blocks.RichTextBlock()
    table = TableBlock()
```

Install with `pip install wagtail-table` and add `"wagtail_table"` to
`INSTALLED_APPS`. Use `ContentBlock()` in a normal StreamField and FieldPanel.
Render with Wagtail's `{% include_block page.body %}`. No frontend JavaScript
or Node.js is required by the installed Python package.

## Development

Python 3.11+, Wagtail 7.4–8.1, and Node 22.15+ are the initial targets.
The compatibility matrix will be expanded and verified before a stable release.
Local checks currently pass on Python 3.13, Wagtail 8.1, and Django 6.1.

```sh
make install
make build
make test
npx playwright install chromium
make test-browser
```

Both Playwright tests passed in a local run outside the development sandbox:
the full admin create/duplicate/save/reload/publish journey and the widget
synchronization/disposal test. Backend draft/publish round trips are also covered
by pytest. The sandbox itself blocks the local server and browser process.

Start the SQLite demo with `make demo`. Create a local admin account separately:

```sh
.venv/bin/python tests/test_project/manage.py createsuperuser
```

Visit `/admin/` to edit the example page and `/` to inspect published HTML.
The browser tests use their own temporary database and local test credentials.

Authored TypeScript/CSS lives in `frontend/`; generated assets are committed
under `src/wagtail_table/static/wagtail_table/`. Run `make build` after frontend
changes. `npm run check:assets` rebuilds and compares their contents.
`uv build` creates a wheel and sdist containing prebuilt assets, with no npm build
step during Python installation.

## Current scope

The editor uses native table nodes and stores one table per block in versioned
JSON. Phase 1 intentionally keeps native Tiptap behavior. Advanced editing UI,
header associations, alignment controls, metadata UI, and clipboard policies are
planned in [PLAN.md](PLAN.md); they are not release-ready features yet.
Unsupported document content must be corrected before saving; it is never
silently discarded. External application clipboard compatibility has not yet
been verified. Do not use this alpha for complex accessible tables.
Malformed or unsupported saved values are retained read only; a repair UI is
not implemented.

Published tables use ordinary semantic HTML. Site styling is owned by the
integrator; the demo supplies a small example stylesheet.

## Releases

Release automation is planned for Phase 4. Until then, run all checks and browser
tests, rebuild assets, and inspect `uv build` artifacts before any manual release.
Version numbers live in `pyproject.toml`. The project uses BSD-3-Clause; bundled
dependency license texts ship alongside the generated admin assets.
