# Local development

The repository uses uv, Ruff, pytest, TypeScript, Vite, Vitest, and Playwright.
Node/npm build editor assets during development; Python package installation
uses the prebuilt files.

```sh
make install
make test
```

`make test` checks Django configuration and migrations, Python formatting/linting,
templates, Python/TypeScript tests, types, and frontend asset reproducibility.

```sh
npx playwright install chromium
make test-browser
```

Browser tests use a disposable database and test credentials. A successful unit
test run does not establish that browser interactions work. Server/browser launch
can be restricted in sandbox environments; report those checks explicitly.

## Demo pages

```sh
.venv/bin/python tests/test_project/manage.py migrate
.venv/bin/python tests/test_project/manage.py createsuperuser
make demo
```

Open `/admin/` for editing or use these public pages and their **Edit this page**
links:

| Page | Purpose |
| --- | --- |
| `/table-examples/` | Text tables, headers, spans, alignment, and metadata |
| `/table-accessibility/` | WAI-inspired tables and documented semantic limitations |
| `/table-hybrid/` | Experimental rich text, images, and emoji inside native block cells |
| `/table-editor-comparison/` | Native Wagtail TableBlock/TypedTableBlock versus our editors |
| `/table-cell-content-comparison/` | Direct fields versus one-item and multi-item StreamBlocks |

Seeding preserves existing edits. After updating demo block definitions, run
migrations before `create_examples`. Use a separate database/media directory for
disposable research rather than deleting edited pages.

## Frontend assets

```sh
make build
npm run check:assets
```

Commit authored TypeScript/CSS and generated package static assets together.
No editor framework, extra build command, or npm dependency is required by an
integrator installing the Python distribution.

## Build this documentation

Use **mdBook 0.5.4**, matching CI. On macOS, install with `brew install mdbook`
and check `mdbook --version`. For an exact version, download the
[official release](https://github.com/rust-lang/mdBook/releases/tag/v0.5.4), or
compile the same version with Rust:

```sh
cargo install mdbook --locked --version 0.5.4
make docs
make docs-serve
```

`make docs-serve` serves the book at `http://127.0.0.1:3000`. `make docs` builds
static HTML under `book/` and checks local output links, anchors, and assets.
Generated output is ignored by Git. mdBook is a
documentation-only build tool, not a Python or frontend runtime dependency.
Its [MPL-2.0 license](https://github.com/rust-lang/mdBook/blob/v0.5.4/LICENSE)
applies to the upstream tool; this project retains its BSD-3-Clause license.

Edit Markdown under `docs/` and update `SUMMARY.md` when adding a chapter. Images
and the historical PDF are copied as static assets. Repository-source links use
GitHub URLs so they remain usable outside a checkout. The documentation workflow
builds the site as a downloadable artifact; public deployment is a separate step.
When upgrading mdBook, update the CI version and its official release checksum
together, then rebuild and inspect the research tables and navigation.

See the [release process](releases.md) for package distribution checks and PyPI.
