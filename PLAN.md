# wagtail-table implementation plan

Status: Phases 0–2 complete. Phase 3 implementation and automated verification
complete; external-source manual checks pending. The user reports the Phase 4
alpha publication succeeded; broader Phase 4 work remains. Phase 5 historical
review and a first current-product comparison are complete; Wagtail baseline
capture and UX prototypes remain pending. Phase 6 has not started.
Investigation date: 20 November 2026.

## Development approach

Start with stock Tiptap table behavior and a small Wagtail integration. Establish
what works in the real editor before changing it. Each later phase should record
the behavior observed, the requirement it does not meet, and the smallest change
needed. Custom Tiptap extensions are deferred until there is evidence for them.

The package should bring together existing concepts through their existing APIs.
Treat Wagtail StreamField, Tiptap, and ProseMirror as the implementation, and this
package as the small amount of glue between them. Prefer less custom code because
every behavior we own also brings edge cases, tests, and maintenance obligations.
This is a lasting design principle, not just a shortcut for the first milestone.

- Reuse supported upstream code and APIs before writing equivalent logic.
- Prefer configuration and direct native commands over wrappers and abstractions.
- Accept reasonable upstream behavior, even if a custom alternative might seem
  more polished. Observe it before deciding it needs changing.
- Keep native data structures and editing operations. Do not build a second
  table model, manipulation engine, clipboard engine, or block editing system.
- Add custom code only for a demonstrated requirement that existing APIs cannot
  meet. Explain the gap and keep the addition local and small.
- Keep necessary integration, server validation, and safe Python rendering
  explicit; minimize their scope rather than duplicating upstream internals.
- Test our integration and additions instead of recreating upstream test suites.

The first deliverable is a native text table that survives a Wagtail save/load
round trip. The eventual text-table release also needs the editing, clipboard,
semantics, accessibility, and packaging requirements below. Hybrid Wagtail block
cells remain a separate future investigation.

## Reference project findings

Studied `/Users/coen/Projects/wagtail-show-hidden-characters`, including its
package metadata, Makefile, Python and JavaScript tests, admin registration,
demo settings/models/content command, README, license, and CI/publishing workflows.
The reference project was read only and was not modified.

Reuse these conventions:

- Hatchling with a `src/` package layout, templates/static assets inside the app.
- BSD-3-Clause licensing, `uv`, pytest/pytest-django, Ruff, and djlint.
- Ruff's 88-character lines, import sorting, Django/security checks, and small
  functions with explicit control flow.
- `make install`, `make test`, and `make fix-codestyle` entry points.
- A SQLite Wagtail demo under `tests/test_project`, with migrations and a
  management command to create example content.
- GitHub Actions checks and tag-triggered PyPI publishing through `uv publish`.

Adapt rather than copy:

- The reference uses `uv venv` and `uv pip install -e '.[test]'`; it does not
  currently contain a committed `uv.lock`. Keep that library workflow initially.
  Use explicit Wagtail constraints if compatibility jobs are added later.
- It has npm/Vitest tests but no frontend build pipeline. Add TypeScript, Vite,
  a committed npm lockfile, and browser tests here.
- Its CI tests one Python environment. Keep CI focused on the current verified
  stack and add built-distribution checks. Broader compatibility jobs are deferred.
- Do not copy its Draftail integration, placeholder metadata, or unrelated demo
  names. Use an early-development package classifier until release readiness is
  established.

The reference's installed environment contains Wagtail 7.4.2 and Django 6.0.7.
Its installed `FieldBlock`, `WidgetAdapter`, built-in TableBlock, and bundled
StreamField JavaScript were inspected to compare documentation with real APIs.

## Proposed architecture

### Public block and Python responsibilities

Expose `wagtail_table.blocks.TableBlock` as a `wagtail.blocks.FieldBlock`
subclass backed by a Django JSON form field and a custom widget. This fits a
single JSON value and keeps ordinary StreamField behavior for duplication,
reordering, revisions, and publishing. A StructBlock with a custom block editing
framework is unnecessary.

The intended integrator setup is:

```python
from wagtail import blocks
from wagtail.fields import StreamField
from wagtail.models import Page

from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    paragraph = blocks.RichTextBlock()
    table = TableBlock()


class ContentPage(Page):
    body = StreamField(ContentBlock(), blank=True)
```

The application also adds `wagtail_table` to `INSTALLED_APPS` and exposes `body`
with a normal FieldPanel. No integrator JavaScript configuration is required.
Keep constructor options modest: standard block options, `required`, and
`help_text`. Add table-specific configuration only when a demonstrated need
justifies a public API.

Keep the public import path stable because custom FieldBlock classes are
referenced by application migrations. Test deconstruction/reconstruction.
Provide searchable plain text from cells and, when implemented, metadata.

Wagtail documents FieldBlock for custom form-field-backed blocks and requires a
widget client adapter for complex editing behavior. [Custom StreamField blocks](https://docs.wagtail.org/en/stable/advanced_topics/customization/streamfield_blocks.html)

### Wagtail widget lifecycle

Register a Python WidgetAdapter using `wagtail.admin.telepath`, with a matching
namespaced JavaScript constructor. Supply assets through widget/adapter media;
avoid a page-wide hook that initializes editors using global selectors.

The adapter creates one bound widget and one Tiptap Editor per rendered block.
Keep Wagtail-specific code separate from the vanilla TypeScript editor setup.
Support `render`, `getByName`, `getValue`, `getState`, `setState`, and `focus`,
with an appropriate focus target/label relationship. Preserve supported Wagtail
error and help-text attributes on the visible editing surface.

Synchronize the hidden JSON form control immediately on editor changes.
`getState()` must return an independent JSON snapshot suitable for duplication;
`getValue()` must return the submittable form value. Do not rely on blur or a
debounced update before saving. Initializing/restoring a value must not mark an
unchanged page as edited. [Widget client-side API](https://docs.wagtail.org/en/stable/reference/streamfield/widget_api.html)

Cleanup is an early integration risk. The documented widget API does not promise
a `destroy()` callback. In the inspected Wagtail 7.4 runtime, deletion marks a
block deleted and hides its wrapper instead of immediately removing its DOM.
A disconnected-element check alone would miss this.

In Phase 1, inspect each supported runtime and choose the smallest reliable
cleanup mechanism. Prefer an available lifecycle hook; otherwise keep a narrowly
scoped DOM observer in the adapter for actual deletion/removal. It must distinguish
deletion from collapse, reordering, and temporary detachment, handle removal of
ancestor blocks, and disconnect itself after cleanup. Call `editor.destroy()`
and remove package-owned listeners. Do not patch Wagtail prototypes or invent an
undocumented event. Verify this behavior in the real StreamField early.

### Tiptap foundation: defaults first

Use vanilla TypeScript and the official free Tiptap packages. Begin with Document,
Paragraph, Text, the standard table nodes, and UndoRedo. Use their default schemas
and table commands. Do not add StarterKit's unrelated rich-text features or any
React/Vue dependency.

The first editor uses stock Table/TableRow/TableCell/TableHeader behavior.
Expose an insert-table action and enough native controls to exercise persistence.
Do not initially customize document constraints, cell attributes, clipboard
plugins, header normalization, or table commands.

Tiptap supplies insertion, row/column changes, merge/split, individual header
toggling, cell selection, and navigation. Those commands form the basis of Phase
2. [Table documentation](https://tiptap.dev/docs/editor/extensions/nodes/table)

Evaluate these questions in later phases, without prescribing extensions now:

- Does the default document permit unwanted text outside the one intended table?
- Can table-level header presets use existing commands with adequate semantics?
- What happens to header cells after insertion, deletion, merging, and splitting?
- Does existing horizontal alignment meet the requirement unchanged?
- What is the smallest addition needed for vertical alignment?
- Which clipboard cases already work, and which need an adapter?

Stock editor HTML may use inline styles. Published HTML has its own safe Python
renderer, so changing Tiptap's HTML output is not automatically necessary.

## Data representation and validation

Use an application-owned versioned wrapper containing one native table node:

```json
{
  "version": 1,
  "table": {
    "type": "table",
    "content": [
      {
        "type": "tableRow",
        "content": [
          {
            "type": "tableCell",
            "content": [
              {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Example"}]
              }
            ]
          }
        ]
      }
    ]
  },
  "caption": "",
  "description": ""
}
```

Caption and description are reserved wrapper fields; their UI arrives in Phase
2. Store neither generated HTML nor a duplicate row/cell matrix. Wrap the table
in a normal Tiptap `doc` when loading the editor and extract it when saving.
Retain native span and supported alignment attributes as those features become
available. Normalization may omit redundant default attributes consistently.

An empty block is `null`; a required block must contain a table for publication.
Wagtail's standard required-field deferral permits empty drafts. Blank cells are
valid, as in ordinary table editors. New blocks receive a fresh 3×3 table with a
header row through Wagtail's default mechanism. Existing empty values stay empty;
the insertion control is available only while no table exists.

The stock document schema can contain other top-level blocks. The integration
must not silently extract one table and discard additional content. Phase 1
detects unsupported documents and presents an error while retaining their editor
state; it does not implement a custom schema to solve this in advance. Phase 3
will test paste/drop/keyboard paths and decide how best to prevent such states.
The final release must prevent arbitrary content outside the table.

Server validation is required from the first persistence milestone:

- Check wrapper type/version and metadata types; reject unknown schema versions.
- Accept only implemented node types: table, tableRow, tableCell, tableHeader,
  paragraph, and text initially. Add hardBreak only when supported end to end.
- Permit only supported attributes and marks; no arbitrary HTML, styles, URLs,
  event handlers, or arbitrary attribute serialization.
- Validate positive integer spans, consistent logical table width, absence of
  overlaps/holes, and rowspans ending within the table. Reject booleans as spans.
- Bound input size, node count, grid dimensions, and nesting before expensive
  processing. Select documented limits using realistic larger-table fixtures.
- Keep geometry inspection for validation/rendering small and read only; table
  manipulation remains ProseMirror's responsibility.

Do not let malformed JSON raise during form extraction before Wagtail can show
a field error. Preserve invalid submitted data for correction. Distinguish an
empty value from malformed or unsupported saved data: never quietly replace the
latter with a new blank table. Public rendering of invalid data must be safe and
produce no table, with a diagnostic for developers. Loading an invalid revision
must expose the problem and avoid automatic destructive rewriting.

Use explicit version dispatch rather than speculative migrations. Shared JSON
fixtures should test agreement between Python and TypeScript without requiring
a second generic schema framework.

**Stable cell IDs are deferred.** Native paste, split, merge, and duplication
would require reliable identity rules. They provide no immediate text-table
benefit. Render-time accessibility IDs are separate from persisted cell identity.

## Published HTML

Render through Django templates from an explicitly validated Python view of the
table. Templates receive known cells, spans, escaped text, and allowlisted
classes/attributes. Never trust saved HTML or spread arbitrary JSON attributes.
The public site requires no JavaScript runtime.

Phase 1 renders table/tbody/tr/td/th and paragraphs with normal Django escaping.
Later semantic work uses these rules as acceptance goals:

- Caption becomes `<caption>`; description remains distinct explanatory text,
  visibly rendered and associated using `aria-describedby` with a unique ID.
- Use `<thead>` only for an identifiable leading header band with no rowspan
  crossing the thead/tbody boundary. Otherwise preserve valid rows in tbody.
- Individual header cells may appear in tbody. Do not move them just because
  they are header nodes.
- Derive `scope` only where direction is clear. A header at the intersection of
  row and column headers must not receive a guessed direction.
- For merged edge headers where relationships are clear, generate unique header
  IDs and explicit `headers` associations from logical cell coordinates.
- Do not infer arbitrary interior/multilevel relationships from position alone.
  Preserve th semantics, report the limitation in the editor/docs, and recommend
  simpler tables when reliable associations cannot be determined.
- Never emit `rowgroup`/`colgroup` scope without the corresponding real groups.
- Map supported alignment values to documented CSS classes. Ship a small
  opt-in public stylesheet and load it in the demo; document its inclusion.

Header direction and association details are a Phase 2 design/test task, based
on actual native editing results. The block must not advertise arbitrary complex
tables as fully accessible. W3C explains the requirements for [irregular headers](https://www.w3.org/WAI/tutorials/tables/irregular/)
and [explicit multilevel associations](https://www.w3.org/WAI/tutorials/tables/multi-level/).

## Header, alignment, and metadata investigation in Phase 2

Start by exposing native table commands and test them before adding policy.
Offer the familiar no-header/first-row/first-column/both conveniences if they can
be implemented clearly with native commands. Also evaluate individual header
cell toggling. Treat actual tableHeader/tableCell nodes as the source of truth;
avoid storing a second contradictory header-mode flag.

A control may display a derived Custom/mixed state when the table no longer
matches a preset. Test preset changes on spans and mixed headers, including
whether a change would misleadingly classify a merged data/header region.
Define and document that behavior before introducing corrective transactions.

Source inspection of Tiptap 3.34.0 confirms that cells and header cells already
have an `align` attribute accepting left/center/right. Try it unchanged first.
Vertical alignment is not present in those definitions; evaluate a small cell
attribute extension only when implementing that requirement.
[Cell source](https://github.com/ueberdosis/tiptap/blob/v3.34.0/packages/extension-table/src/cell/table-cell.ts),
[alignment source](https://github.com/ueberdosis/tiptap/blob/v3.34.0/packages/extension-table/src/utils/parseAlign.ts).

Caption and description can use ordinary labeled inputs within the widget and
the existing wrapper fields. They do not need custom Tiptap nodes. Native table
undo/redo uses the official UndoRedo extension; metadata inputs retain ordinary
text-input undo behavior unless testing demonstrates a need for a shared history.

## Clipboard investigation in Phase 3

First test stock HTML and plain-text paste in the demo. Retain native behavior
where it is usable. Do not write a new table-paste engine.

ProseMirror's current table paste implementation handles rectangular HTML cell
slices. Pasting at a text cursor can enlarge the table; pasting into a cell range
fits the source to that selected rectangle, including clipping/repetition.
The implementation also adjusts intersecting spans. These are behaviors to test
and document before deciding whether they need restrictions.
[Paste handler](https://github.com/ProseMirror/prosemirror-tables/blob/v1.8.5/src/input.ts),
[cell paste implementation](https://github.com/ProseMirror/prosemirror-tables/blob/master/src/copypaste.ts).

Build a fixture matrix covering:

| Source/selection | Cases to observe |
| --- | --- |
| HTML table | Cursor in a cell; selected range; headers; spans; empty cells |
| Plain text | A word; multiline text; tabs; CRLF; trailing empty cells |
| Size mismatch | Source larger/smaller than destination; growth at edges |
| Merged cells | Merged source; merged destination; selection crossing spans |
| Incompatible content | Nested/multiple tables; surrounding prose; unsupported nodes |
| External formats | Excel, Sheets, Word, and website table clipboard payloads |

Only after that baseline, decide whether TSV needs a small `clipboardTextParser`
or paste adapter that produces native table slices for the existing pipeline.
Ordinary prose should retain normal cell editing. Use schema-constrained parsing;
unsupported formatting must not introduce arbitrary nodes or attributes.

Before Phase 3 is accepted, explicitly document the chosen behavior for growth,
range clipping/repetition, and merged destinations, and make it visible enough
to avoid unexpected data loss. If defaults prove unsuitable, propose the smallest
guard or adapter with regression tests. Do not commit now to rejecting ranges,
automatically unmerging cells, or overriding default paste.

Synthetic ClipboardEvents exercise the browser paste pipeline but do not prove
OS/application clipboard interoperability. Add a real clipboard read/write test
where browser permissions allow it and maintain separate manual instructions
for external applications, with application/browser versions and observed results.
Do not claim Excel/Sheets/Word compatibility based only on generic HTML fixtures.

## Dependencies and compatibility

Proposed package license: BSD-3-Clause, matching the reference. Registry metadata
was checked before adding anything; no dependencies have been added in Phase 0.

| Dependency | Investigated version | License / purpose |
| --- | --- | --- |
| Wagtail | Installed 7.4.2; stable docs 8.1 | BSD-3-Clause; block/admin integration |
| Django | Installed 6.0.7 | BSD-3-Clause; supplied through Wagtail dependency resolution |
| `@tiptap/core`, `@tiptap/pm` | 3.34.0 | MIT; editor and official ProseMirror entry points |
| `@tiptap/extension-table` | 3.34.0 | MIT; exports standard table node components |
| `@tiptap/extension-document`, `-paragraph`, `-text` | 3.34.0 | MIT; minimal native content schema |
| `@tiptap/extensions` | 3.34.0 | MIT; import UndoRedo only |
| `@tiptap/extension-hard-break` | 3.34.0 | MIT; optional later, if needed |
| `prosemirror-tables` | 1.8.5 in inspected Tiptap dependency range | MIT; use through `@tiptap/pm/tables` |
| Vite | 8.3.8 | MIT; frontend build |
| TypeScript | 7.0.2 | Apache-2.0; type checking |
| Vitest | 5.1.1 | MIT; package behavior tests |
| `@playwright/test` | 1.65.1 | Apache-2.0; browser integration tests |

MIT, BSD, and Apache-2.0 dependencies are compatible with this distribution when
their notice/license obligations are retained. Before Phase 1 installation,
verify the selected tools together, inspect package license files and the resolved
transitive dependency licenses, and record notices for bundled JavaScript.
Recheck metadata when implementation begins; these are investigation candidates,
not an installed or tested dependency set. Check Hatchling, uv, Ruff, pytest,
pytest-django, djlint, and any added test DOM environment in that same audit.

Keep all Tiptap packages on the same exact version and commit `package-lock.json`.
Do not add a separate direct ProseMirror dependency, framework wrapper, commercial
extension, static-renderer dependency, or general HTML sanitizer by default.

Use Node 22 with a pinned compatible patch in CI initially. Local Node 22.15.0
meets the investigated Vite/Vitest engine ranges. Node is development-only.

Propose initial Python support `>=3.11` and Wagtail 7.4 LTS, 8.0, and 8.1, with
an initial dependency range `>=7.4,<8.2` once verified. Django 5.2 is the common
baseline; test 6.0 and 6.1 only with compatible Wagtail/Python combinations.
This deliberately starts above the reference's Python 3.10 floor to keep the
new package's baseline current. Final supported versions and classifiers must
match passing CI, not this proposal. [Wagtail compatibility table](https://docs.wagtail.org/en/stable/releases/upgrading.html#compatible-django-python-versions)

Updated scope after Phase 3: defer the multi-version Python/Django/Wagtail CI
matrix. Phase 4 targets the locally verified Python 3.13, Wagtail 8.1, and Django
6.1 stack. Evaluate newer versions as development moves forward; testing older
combinations is not an initial release gate. Existing dependency bounds describe
allowed installations, not verified compatibility across every combination.

## Frontend build and Python distribution

Use Vite library mode to produce one self-contained classic/IIFE admin bundle
and CSS at stable names under `static/wagtail_table/`. Bundle Tiptap rather than
expecting browser globals or a CDN. Avoid code splitting and runtime manifest
lookups initially. Django staticfiles handles discovery and deployment hashing.

**Commit generated JS/CSS.** This makes a source checkout and PyPI source install
usable without Node. Keep authored TypeScript/CSS separately under `frontend/`.
CI must run `npm ci`, rebuild with pinned tooling, and fail if generated assets
or bundled notices differ. Do not put timestamps or machine paths in output.

Configure Hatchling explicitly so wheels contain Python, templates, static assets,
and license notices; sdists also contain frontend source, lockfile, build config,
tests, and docs. Python builds must never invoke npm. Build from an sdist in a
clean environment, install the wheel outside the checkout without Node, and
verify imports, template loading, static discovery, and collectstatic.

## Proposed structure

```text
pyproject.toml
package.json / package-lock.json
vite.config.ts / tsconfig.json / playwright.config.ts
Makefile / LICENSE / README.md / PLAN.md
frontend/
  editor.ts                 # native Tiptap setup and controls
  wagtail.ts                # Telepath adapter and lifecycle integration
  editor.css
src/wagtail_table/
  __init__.py
  blocks.py
  widgets.py
  data.py                   # version handling and server validation
  rendering.py              # validated template context and semantics
  templates/wagtail_table/  # widget and published table templates
  static/wagtail_table/     # committed generated admin assets, public CSS, notices
tests/
  test_blocks.py / test_data.py / test_rendering.py / test_widgets.py
  fixtures/                 # shared document and clipboard examples
  js/                       # focused Vitest tests
  browser/                  # actual Wagtail/Playwright journeys
  test_project/             # small SQLite demo, migrations, content command
.github/workflows/
  test.yml / publish.yml
```

This is a guide, not a requirement to create every file immediately. Split
modules only when their responsibility warrants it.

## Milestones and acceptance gates

### Phase 0 — Investigation and review

- [x] Inspect reference tooling, packaging, tests, demo, and release workflow.
- [x] Inspect official Wagtail docs and installed integration APIs.
- [x] Inspect native table commands, alignment, and upstream clipboard handling.
- [x] Check candidate frontend versions/licenses and identify remaining audits.
- [x] Propose architecture, data representation, packaging, risks, and milestones.
- [x] User review before Phase 1; approved to proceed.

At the Phase 0 checkpoint, no tests, builds, or browser interactions had been run
and no implementation existed. Direct Python network access failed in this
environment; npm registry queries and web documentation/source inspection worked.
No frontend packages were installed, so installed-package API and transitive
license verification was recorded as a Phase 1 prerequisite. See the Phase 1
record below for subsequent results.

### Phase 1 — Working technical foundation

1. Verify selected dependency versions/licenses; establish package metadata,
   test tooling, npm lockfile, Vite build, and generated asset checks.
2. Implement the versioned JSON field, basic validation, safe rendering, and
   Python round-trip tests.
3. Integrate stock Tiptap tables through the widget adapter and a minimal demo.
4. Verify dynamic insertion, independent instances, duplication, reordering,
   deletion cleanup, and immediate-save synchronization in Wagtail.
5. Automate the first edit/save/reload/publish browser journey.

Acceptance: add a table, edit cell text, save a draft, reload unchanged content,
publish, and see an escaped HTML table. Multiple blocks remain independent.
Keep Tiptap behavior unchanged except for the integration needed to persist it.

### Phase 2 — Native editing controls and semantics

1. Expose native row/column operations, merge/split, undo/redo, and navigation.
2. Test header operations, then add convenient presets and safe published semantics.
3. Try native horizontal alignment; add vertical alignment only after confirming
   the gap. Implement metadata inputs and corresponding rendering.
4. Test merged geometry, header changes, escaping, alignment, and descriptions.
5. Add representative demo tables and browser coverage for these operations.

Acceptance: maintain ordinary and moderately complex tables through accessible
controls, preserving content and supported metadata after save/load. Document
semantic limits; record any extension added and why defaults were insufficient.

### Phase 3 — Clipboard and usability

1. Record results for the stock clipboard fixture matrix and document constraints.
2. Add only the adapters/guards required by demonstrated gaps, including TSV if
   necessary. Preserve native table insertion/manipulation underneath.
3. Test HTML/TSV ranges, merged cells, size mismatches, unsupported structures,
   and undo after paste. Finalize and document behavior before acceptance.
4. Refine compact controls, visible selection, focus handling, and error feedback.
5. Perform keyboard and screen-reader review and external-application manual tests.

Acceptance: tested rectangular pastes remain editable and survive save/render;
unsupported content cannot escape the table or silently erase unrelated content.
State exactly which external sources were tested and what remains unverified.

### Phase 4 — Quality and publishing

1. Complete browser journeys: create, edit, row/column operations, save/reload,
   merge/split, headers, range paste, multiple blocks, duplication, deletion,
   draft/publish, and published HTML assertions.
2. Complete Python validation/rendering tests, shared fixtures, TypeScript checks,
   accessibility review, and CI for the current verified stack. Defer the broader
   Python/Django/Wagtail compatibility matrix; evaluate newer versions as needed.
3. Verify reproducible assets, license notices, wheel/sdist contents, and an
   independent installation with no Node requirement.
4. Write the README for actual features: requirements, installation, realistic
   StreamField usage, public CSS, development/demo commands, tests, clipboard
   rules, accessibility limits, and release process.
5. Adapt tag/version verification and trusted PyPI publishing. Release only
   after all acceptance gates pass.

At each implementation checkpoint run pytest, Ruff check/format, TypeScript
checks, Vitest, the frontend build, and relevant demo/browser checks. Report
unavailable checks explicitly and update this plan with evidence and open issues.

### Phase 5 — UX research and refinement

Refine the text-table editing experience before investigating hybrid cells.
This is a dedicated follow-up phase; it does not start hybrid-cell work or make
every deferred refinement a requirement for the initial release. Fix obvious
layout defects during Phase 4 if they obstruct normal use.

1. Review the original PDF report and write a short prelude covering the original
   motivation, needs that remain relevant, and how ProseMirror and Tiptap inform
   today's approach. Treat the report as historical context, not a specification,
   and verify any chronology claims. Store the research overview, findings, visual
   comparisons, and decisions in `docs/research/table-editor-ux/` under version
   control. Include curated screenshots with attribution, source links, and capture
   dates; exclude raw captures, recordings, and temporary experiments. Include the
   PDF only if suitable for public redistribution; otherwise link to it.
2. Review the current editor in Wagtail with realistic small, wide, and merged
   tables. Record layout problems, including misaligned buttons, and friction
   during insertion, selection, row/column changes, alignment, and metadata editing.
3. Research table-editing interactions in other products using their current
   interfaces or documentation. Compare the same tasks and record useful patterns,
   accessibility tradeoffs, and evidence. Borrow interaction ideas that fit Wagtail
   and native Tiptap behavior; do not copy an entire interface.
4. Propose a small set of changes for review. Explore controls nearer the table,
   such as contextual toolbars or menus, without committing to a particular design.
   Essential actions must remain discoverable and usable without right-click or
   hover. Check selection preservation, keyboard access, and viewport boundaries.
5. Prototype the chosen interactions in the existing demo using native Tiptap
   commands and Wagtail styling. Review screenshots and browser interactions
   before committing to a wider redesign. Prefer small, reversible changes.
6. Implement the agreed refinements and verify keyboard and mouse workflows,
   focus behavior, large-table handling, independent StreamField instances,
   save/reload, and published output. Add browser coverage for changed behavior.

Acceptance: consistent control alignment and grouping, clear available actions,
and reviewed editing workflows for small and large tables. Context menus are an
option to evaluate, not an acceptance requirement. Record remaining limitations
and run the usual checks before closing this phase.

### Phase 6 — Future hybrid cells; excluded from this implementation

Revisit `cell_block` configuration and native Wagtail block definitions only after
the text editor is stable. Investigate existing StreamField/Telepath conventions
for a single block, a one-choice StreamBlock, and unrestricted StreamBlock cells.
Define text/block conversion, identity, merge behavior, and paste behavior then.
Use the wrapper version for a future migration; do not add cell IDs, sidecar block
stores, placeholder nodes, or a parallel block editing system in advance.

## Deferred refinements from editor feedback

Recorded after Phase 2. These are candidates for Phase 5's UX review, alongside
the later feedback about button alignment and contextual controls. Recording
them does not commit us to implementing every item. Prefer native APIs and small
changes; required-value validation remains a correctness concern for Phase 4.

| Refinement | Current behavior | Follow-up |
| --- | --- | --- |
| Alignment scope | Horizontal and vertical alignment apply to the current cell or native cell selection. | Add convenient Current cell / Current row / Current column actions. Investigate native row/column cell selections and apply the existing attribute commands, including sensible behavior around merged cells. |
| Initial table size | New blocks start with a 3×3 table and a header row. Recovery insertion also uses Tiptap's default 3×3 size. | Allow choosing rows and columns before insertion. Evaluate simple numeric inputs or an accessible size picker; no particular widget design is chosen yet. Use the existing insertTable options. |
| Insert control after insertion | Insert table is hidden whenever a table exists, including on load, and restored when the editor becomes empty. | Implemented as a small refinement; keep this behavior during future insertion UX changes. |
| Empty required block | Verified through admin POST tests: empty drafts save, publication requires a table, and an empty draft cannot replace a published table. required=False permits an empty block. Blank cells are valid. | Keep the native Wagtail validation behavior; run the added browser recovery/draft/publish journey locally or in CI. |
| Actions/settings design | Native Wagtail Row, Column, and Cell dropdowns group commands; empty editors show a direct Insert table button. Caption and Summary remain visible below the table. | Review the menu layout with real editing tasks, including narrow screens, keyboard use, and large tables. |
| Large tables in the editor | The editor container has overflow-x: auto, but the table uses width: 100% and fixed layout inside Wagtail's content column. Existing scrolling alone does not establish that wide tables are comfortable to edit. | Test realistic wide/large tables and long cell content. Evaluate using more available width, preserving a readable minimum cell width with horizontal scrolling, or an expanded editing view. Verify keyboard navigation, focus visibility, multi-cell selection, and StreamField lifecycle behavior in the chosen approach. |

Acceptance for a future refinement pass: retain native persistence and editing
behavior, avoid duplicate editor instances or lost selections, and verify the
chosen controls with mouse, keyboard, and large-table examples. No refinements
in this section have been implemented as part of recording this feedback.

## Risks to resolve with evidence

| Risk | Resolution point |
| --- | --- |
| Widget removal lacks a documented disposal contract | Phase 1 real-runtime cleanup tests, including hidden deleted ancestors |
| Default document permits content outside the table | Detect without discarding in Phase 1; test and constrain in Phase 3 |
| Native headers and merged cells do not express all semantic intent | Phase 2 fixtures, conservative associations, documented limits |
| Default paste clips/repeats or changes spans unexpectedly | Phase 3 baseline tests before considering overrides |
| External application clipboard formats differ | Real payload fixtures plus explicitly separate manual interoperability tests |
| Python and frontend accept different document shapes | Shared fixtures and browser-to-server round trips |
| Dependency/tool versions or licenses differ after resolution | Audit installed packages/lockfile before use; recheck on upgrades |
| Assets missing or stale in distributions | Rebuild comparison and isolated wheel/sdist installation checks |

## Phase 1 implementation and verification record

Implemented on 20 November 2026:

- Hatchling package, uv/pytest/Ruff/djlint tooling, npm lockfile, TypeScript/Vite,
  committed static assets, bundled dependency notices, and an initial CI workflow.
- A FieldBlock with a JSON form field and Telepath widget adapter. Editor setup
  uses unmodified Document, Paragraph, Text, TableKit, and UndoRedo extensions.
  Only an Insert table control is exposed at this checkpoint.
- Version 1 persistence, bounded server validation, escaped Django template
  rendering, searchable text, and safe handling of unsupported saved values.
- A minimal SQLite demo with a native header table, content creation command,
  edit/add-page links, and no automatic creation of demo login credentials.
- Cleanup isolated in the widget adapter: observe removal and Wagtail's hidden
  deleted-block wrappers. Do not dispose editors when blocks are reordered or
  ordinary panels collapse.

Decisions confirmed during implementation:

- Use Tiptap's default 3×3 insertion with its default header row.
- Empty top-level paragraphs created by native editing carry no persisted
  content. Nonempty outside content or additional tables produce a visible
  error and remain in the submitted value; nothing is silently discarded.
- Unknown/malformed saved or rejected submitted values are retained read only.
  A repair interface is outside Phase 1; live unsupported content can be corrected
  before submitting. Further document constraints remain a Phase 3 investigation.
- Native rowspan geometry can leave a row with no originating cells. Server
  validation accepts such rows when earlier rowspans cover them completely.
- Dependency license audit: bundled runtime JavaScript packages use MIT licenses;
  build/test dependencies also include Apache-2.0, BSD, ISC, 0BSD, and MPL-2.0.
  The GPL-3.0-or-later djlint executable is development-only and is not bundled.
  Hatchling is MIT; its build dependencies include MPL-2.0 and Apache-2.0.
  Bundled MIT license texts are generated from the installed runtime packages.

Verification completed locally with Python 3.13.2, Wagtail 8.1, Django 6.1.3,
Node 22.15.0, and the frontend versions recorded above:

- `make test`: 46 Python tests and 5 TypeScript tests, Django system/migration
  checks, Ruff lint/format, djlint, TypeScript checks, and deterministic asset
  rebuilding passed.
- Python tests include submitting native browser-generated JSON through the
  actual Wagtail admin views: create a draft, retrieve it, reload its editor
  response, publish, and verify the public HTML through Django's test client.
- Connected-browser checks passed for native insertion/editing, immediate hidden
  input synchronization, duplication independence, reordering, disposal, and
  preservation of unsupported outside text.
- An additional connected-browser check loaded the installed Wagtail 8.1
  StreamBlock/FieldBlock/Telepath JavaScript and the actual Python-packed block
  definition. Dynamic insertion, native edits, Wagtail duplication with separate
  editor instances, and Wagtail deletion/disposal passed. The unused Draftail
  widget was stubbed; table and StreamField implementations were real.
- Wheel and sdist builds passed using locally cached Hatchling build dependencies.
  Both archives contain compiled JS/CSS, templates, and license notices; the
  sdist also contains TypeScript source and npm build inputs.
- Demo migrations, Django checks, and example-content creation passed.
- The user ran `make test-browser` outside the sandbox after the locator and
  action-menu fixes: both Playwright tests passed in 5.1 seconds. The admin
  journey verifies creating, duplicating, saving, reloading, and publishing
  independent native tables; the widget test verifies synchronization and disposal.
  This completes the Phase 1 acceptance gate.

Outstanding verification and limitations at the Phase 1 checkpoint:

- The initial CI workflow has not run on GitHub. Compatibility outside the
  installed Wagtail 8.1/Django 6.1 combination is still unverified.
- Header scopes/associations, metadata UI/rendering, alignment UI/rendering,
  row/column and merge/split controls, and clipboard policies remain later phases.
  Basic th/td and spans render now; complex accessible tables are not yet supported.
- No release or publication was performed at this checkpoint.

## Phase 2 implementation and verification record

Completed on 20 November 2026 after user approval:

- Compact Table actions and Table settings controls use the existing Tiptap
  commands for rows, columns, merge/split, individual headers, first-row/column
  headers, and undo/redo. No custom table commands or manipulation engine were
  introduced. No dependencies were added or upgraded.
- Two native edge-header toggles provide the four ordinary configurations.
  Their state is derived from the native cells using ProseMirror TableMap,
  including merged geometry. Custom layouts remain custom; changing one edge
  does not normalize unrelated cells or add a persistent mode flag.
- Horizontal alignment uses the native `align` attribute. Vertical alignment
  adds a single small global-attribute extension for both native cell types.
  This was the confirmed gap in the installed native schema. Both alignments
  survive save/load and render through allowlisted CSS classes.
- Caption and description use ordinary labeled inputs and the reserved wrapper
  fields. Inputs synchronize immediately and duplicate independently. Caption
  renders as caption; description is visible text associated by aria-describedby.
- Native table history remains separate from ordinary metadata-input undo.
  Tab/Shift+Tab retain native navigation, including row creation at the end.
  Escape provides a keyboard exit from the table to its controls. Mouse toolbar
  activation preserves native multi-cell selections.
- Python templates render thead only where spans permit a valid row-group split.
  Header scopes and explicit associations cover identifiable leading header rows
  and left-edge row headers. Render-time IDs are unique and are never persisted.
  Interior/crossing/corner relationships are left unguessed and documented.
- Merging and splitting keep native behavior, including the top-left cell's type
  and alignment and the first split cell retaining the merged content.
- Six representative tables are available at /table-examples/ through the demo's
  create_examples command. It preserves an existing example page and other edits.
- The public alignment stylesheet is shipped and checked with generated assets.
  Editor controls and lifecycle remain separate from Wagtail initialization.

Verification:

- `make test` passed: 70 Python tests, 9 TypeScript tests, Django checks and
  migration checks, Ruff, djlint, TypeScript checks, and reproducible asset builds.
- Python tests cover alignment combinations, escaped metadata, scopes and explicit
  merged/multilevel edge-header associations, crossing rowspans, unique IDs,
  demo seeding, and native browser JSON through Wagtail draft/publish views.
- Connected-browser checks passed for the editing commands, header controls,
  selection-preserving merge/split, metadata synchronization/restoration, and
  Escape. Final computed-style checks confirmed top/middle/bottom alignment.
- The user's full `make test-browser` run passed all three tests in 7.8 seconds,
  including editing controls, save/reload, headers, metadata, alignment,
  merge/split, and published HTML. The agent's own server launch was blocked by
  the sandbox; the successful user-run result is recorded separately.
- Frontend, wheel, and source-distribution builds passed. Demo example creation
  passed without overwriting existing table content.

Remaining work is in later phases: clipboard policies/interoperability,
further usability and accessibility review, and publishing preparation. Broader
compatibility matrix validation is now deferred. Complex header intent cannot always be recovered
from geometry; there is no manual association UI. Stable cell IDs and hybrid
Wagtail block cells remain deferred. Phase 3 was subsequently approved.

## Phase 3 investigation and implementation record

In progress after user approval. Deferred editor refinements do not block this
phase and have not been promoted into it.

Native browser baseline established before code changes:

- HTML rectangles paste correctly, grow at a cursor, and clip/repeat within a
  native CellSelection. Source spans are preserved; intersecting destination
  spans can be split. These behaviors are retained.
- TSV remains text in one cell without an adapter.
- The stock cell schema permits nested tables. HTML br becomes whitespace
  without the official line-break extension.

Implementation prepared:

- A small TSV parser emits native table slices, including quoted fields,
  CRLF/LF, empty cells, trailing columns, ragged row padding, and multiline values.
  Ordinary prose uses native paragraph nodes and ProseMirror open-slice fitting.
- Standard editor paste props reject multiple/nested tables, surrounding prose,
  malformed quoting/spans, and excessive dimensions before native insertion.
  Rejected empty slices are intercepted so a selected range cannot be cleared.
- Existing Document/TableCell/TableHeader schemas are narrowed to one optional
  root table and paragraph cell content. This is a demonstrated constraint gap,
  not a separate editing or table-manipulation system.
- Existing native clipping/repetition and merged-cell behavior is explained with
  visible help and accessible status notices. Captions/descriptions remain widget
  metadata; pasted column-width formatting is discarded.
- Vertical alignment recognizes package-generated classes during clipboard import.
  Official HardBreak rendering/validation/search support is implemented end to end.
- Added TSV unit cases, synthetic format examples, browser paste tests, a real
  browser Clipboard API admin journey, and a larger native-paste demo fixture.
- Detailed policy and manual interoperability steps are in docs/clipboard.md.

Verification so far:

- `make test` passed: 73 Python tests and 17 TypeScript tests, Django system and
  migration checks, Ruff, djlint, TypeScript checks, and reproducible builds.
- Native HTML-pasted JSON captured from the rebuilt editor passes Wagtail admin
  draft/save/publish tests, preserving line breaks, text escaping, and alignment.
- Connected-browser DOM paste checks passed for TSV dimensions/empty columns,
  growth, clipping/repetition, merged destination splitting, non-destructive
  rejection while cells are selected, alignment import, and constrained HTML.
- Final connected-browser checks also passed for the representative Office-like
  and Sheets-like fixtures, HTML br preservation, and native paste undo/redo.
  These are format examples, not real external-application compatibility claims.
- The user's full `make test-browser` run passed all eight tests in 10.4 seconds,
  including synthetic paste cases and actual Clipboard API text/plain and
  text/html journeys through draft reload and publication. The agent sandbox
  itself still prevents the test server from starting.

Dependency/build verification:

- The user installed @tiptap/extension-hard-break 3.34.0. Its MIT license, installed
  version, peer requirements, and npm lock entry were checked. No other dependency
  versions changed. Assets and bundled license notices were rebuilt successfully.
- Generated dependency code includes intentional Markdown whitespace in string
  literals. A scoped .gitattributes entry marks the bundle generated and excludes
  it from whitespace checking; the native code and string semantics are preserved.
- Frontend, wheel, and source-distribution builds passed with prebuilt assets.

Outstanding verification:

- Perform and record external-application manual checks separately. Excel,
  Sheets, Word, and a specific website's clipboard output remain unverified.
- The deferred refinements remain deferred. Phase 4 has not started.

## Phase 4 — Focused alpha release checkpoint

Scope: prepare `0.1.0a1` for evaluation without completing the full Phase 4
review. UX research/refinement and hybrid cells remain in Phases 5 and 6.

Prepared:

- Added repository, issue-tracker, and changelog metadata for
  `allcaps/wagtail-table`. Kept the alpha version, dependency bounds, and Alpha
  classifier; no runtime dependencies or editor behavior changed.
- Added alpha notes and explicit warnings about API/storage changes, migration
  expectations, unverified clipboard sources, and incomplete accessibility and
  compatibility review. Documented alpha installation and release steps.
- Added `make check-distribution`: wheel/sdist content and metadata checks,
  sdist-to-wheel rebuild, and fresh installed-package import/staticfile/rendering
  checks outside the checkout with Node/npm unavailable. CI now runs this check.
- Added tag-triggered publishing with version matching, full tests and browser
  checks, verified artifact transfer, and a separate Trusted Publishing job in
  the `pypi` environment. Only the publishing job receives OIDC permission.
- Documented the exact pending PyPI publisher fields, GitHub environment setup,
  and the review/tag/publish sequence in `docs/releases.md`.

Verification on 20 November 2026:

- `make test` passed: 73 Python tests, 17 TypeScript tests, Django checks,
  Ruff (including release scripts), template lint/format, TypeScript type checks,
  and reproducible frontend assets.
- `make test-browser` could not start its server because of the sandbox's local
  server restriction. The earlier user-run eight-test result is recorded above;
  this release's CI must run the suite again.
- The default `make check-distribution` path is blocked by PyPI network access.
  An offline attempt confirms that the writable cache lacks build requirements
  and Wagtail wheels; a complete fresh installation has not been verified here.
- Using the installed build backend, wheel/sdist builds, artifact contents and
  metadata checks, and rebuilding the wheel from the sdist passed with Node/npm
  unavailable. An incorrect release version was rejected by the metadata check.
- A supplementary installed-wheel check passed outside the checkout with
  Node/npm unavailable: package imports, static assets, validation, and escaped
  template rendering. It reused existing dependencies, so it does not replace
  the fresh dependency installation gate.
- Both workflow YAML files parsed successfully. The GitHub publishing workflow
  has not run; no tag or upload has been made.

Remaining before publication: review and commit the changes, configure the
GitHub `pypi` environment and pending PyPI publisher, obtain green CI including
browser and full distribution checks, date the release notes, and review the
release artifacts. Publication remains a separate final action. Broader Phase 4
quality work and the compatibility matrix remain outside this alpha checkpoint.

Subsequent update: the user reported successful PyPI publication and requested
moving to UX discovery. This records publication success without claiming that
the remaining Phase 4 review has been completed.

## Phase 5 — Historical review started

- Reviewed all 11 pages of the supplied original report, including its screenshots.
  The PDF export metadata is dated 17 July 2024; authorship and the research date
  are not established by that metadata.
- Added the research overview and historical summary under
  `docs/research/table-editor-ux/`, with three curated PDF page renders illustrating
  per-cell configuration, nearby menus, and a properties dialog. The original PDF
  is unchanged. Attribution and public redistribution details await clarification.
- Preserved the report's historical TinyMCE recommendation separately from the
  project's current Tiptap/ProseMirror implementation. No claim is made that those
  frameworks first appeared after the report or that historical product findings
  still describe today's software.
- Recorded shared tasks and questions for the next research pass. Current-demo
  captures, current-product comparisons, and UX prototypes have not started.
- This step changes documentation only; it introduces no editor behavior changes
  and makes no new browser-interaction claims.

### Small refinement: persistent panel buttons

At the user's request, replaced expandable headings with persistent Table actions
and Table settings toolbar buttons and separate panels below them. A second click
closes a panel; open buttons use the header buttons' inset highlight. Disclosure
state uses `aria-expanded` and `aria-controls`. Both panels can remain open.
Escape from the editor now focuses the Table actions button. No table data or
Tiptap commands changed; bundled JS/CSS were rebuilt.

`make test` passed (73 Python tests, 17 TypeScript tests, lint/format, type checks,
and reproducible assets). A targeted connected-browser check passed for stable
toolbar placement, visibility, highlights, second-click closing, Enter/Space
activation, Escape focus, independent instances, and unchanged stored table data.
Added a Playwright regression and updated the existing Escape assertion. The
full Playwright suite could not start its server inside the sandbox and must be
rerun locally or in CI; its new regression is not claimed as executed here.

Follow-up refinements: first-row/column highlights now inspect their own logical
edge cells independently of the overall header preset. Previously, any custom
header layout cleared both highlights, even after enabling a complete header
row or column. This was reproduced in the browser before the fix. The read-only
state check uses native TableMap cells; native header commands remain unchanged.
Merge cells, Split cell, and Header cell now share a dedicated flex row below the
column selector, with horizontal overflow rather than wrapping on narrow screens.

Extended unit coverage for edge state in ordinary, custom, and merged layouts.
A connected-browser check passed at 320px editor width for the three buttons'
shared line below Columns, custom header highlights, toggling, undo/redo, and
restoring saved header state in another instance. `make test` passed after the
header-state change; the subsequent layout change passed type checks, Vitest,
and the frontend build. Playwright's widget-only run was also blocked by the
sandbox's Chromium process restriction, before test bodies could execute.

Compact form controls are the default for table editor panels. Inspection of the
installed Wagtail CSS confirmed that its density setting does not resize these
native fields. A scoped sizing override retains Wagtail's field colors, borders,
focus and disabled styling while using 14px text, smaller padding, and a 32px
minimum height. Selects fit their options rather than filling the panel; caption
and description retain wider inputs. Select arrows remain vertically centered.
No JavaScript widgets or dependencies were added.

With the installed Wagtail core CSS loaded, a connected-browser check confirmed
single-line fields decreased from about 44px to 32px, the two-row description
from 99px to 52px, and selects fit within a 320px editor. Checked both directions
and default/snug density; fields outside the editor kept their original size.
Frontend build, type checking, asset reproducibility, and whitespace checks passed.

Insert table now appears only while the editor is empty. It is hidden after
insertion and when restoring an existing table, and returns if insertion is
undone. A connected-browser check passed for empty, inserted, undo, redo, and
saved-table initialization states. Build, type, asset, and whitespace checks passed.

### Starter tables, strict persistence, and exclusive panels

New TableBlocks now use a callable Wagtail block default that returns a fresh
3×3 table with a header row. Explicit developer defaults remain supported, and
saved empty or malformed values are not replaced with a starter table. Loading
the default or an empty draft does not dispatch change events. Connected-browser
checks confirmed independent instances and that the starter JSON normalizes to
the same document as native Tiptap insertion.

Required-field validation stays entirely with Wagtail. Admin POST tests verify
empty draft creation, repeated draft saves, rejected empty publication, preserved
published content, and publication of a blank starter table. Native select-all
and Backspace removes the table; undo/redo and recovery insertion were checked
in the connected browser. Ordinary typing into an empty editor creates a native
1×1 table, which is valid; no custom typing interception has been added.

The frontend persistence boundary no longer ignores empty outside paragraphs.
Only a genuinely empty document becomes null; nonempty documents must contain
exactly one table. The existing server wrapper validation already rejects
outside nodes and document payloads. Additional tests cover text-only content,
text before/after a table, multiple tables, and rejected malformed draft/publish
POSTs while retaining the original invalid value.

Table actions and Table settings are now mutually exclusive. Opening either
closes the other and updates both highlights and aria-expanded states. Clicking
the active control closes it. Browser tests were adjusted to switch panels
before using their controls; a connected-browser mouse check passed for both
switch directions, active highlights, second-click closing, independent table
instances, and unchanged table data.

Final `make test` passed: 88 Python tests, 17 TypeScript tests, Django system and
migration checks, Ruff, template checks, TypeScript type checking, and reproducible
frontend assets. The frontend was rebuilt. The full Playwright rerun remains
blocked by the sandbox's server restriction; the updated journeys have not been
claimed as executed here. The connected browser restarted before the latest
keyboard switching check completed, so only its mouse result is recorded above.

### First live-demo comparison

On 20 November 2026, reviewed TinyMCE 8.10.2's Non-Premium Plugins demo and
CKEditor 5 49.1.0's Tables overview demo. Added a visual comparison and capture
index under `docs/research/table-editor-ux/`, with 17 current viewport screenshots.
Versions were read from runtime values; source URLs, fixture setup, capture date,
dimensions, and attribution are recorded. Historical PDF renders remain separate.

Exercised insertion grids, row/column commands, pointer multi-cell selection,
merge/split, individual header type/scope and alignment, Tab/Shift+Tab, and focus
shortcuts. CKEditor's caption entry was verified. TinyMCE's caption control was
captured but activation was inconclusive. CKEditor's keyboard return to a cell
was observed; TinyMCE's Escape focus return requires manual reproduction despite
its documented support. Current CKEditor individual header controls update the
historical report's limitation; the old conclusion is preserved as history.

The report proposes reviewing labelled action groups first, investigating native
Tiptap menu support for nearby controls, and clarifying cell versus table
properties. None is an approved implementation change. Real Wagtail baseline
screenshots, wide/narrow layouts, screen-reader checks, right-click menus, and
external-app clipboard checks remain outstanding. No package code or dependencies
were changed in this research pass.

### Labelled action menus

Implemented the approved first UX refinement using Wagtail's dropdown template
component and its existing controller, positioning, and dismissal behavior.
Table contains insertion and edge-header settings; Row and Column contain
structural commands; Cell contains merge, split, individual header, and selected
cell alignment commands. Only one menu opens at a time. Escape returns focus to
the menu button; Escape from the editor focuses Table. Removed visible Undo and
Redo controls at the user's request, retaining native history keyboard shortcuts.

Caption and description remain visible below the editor. Paste guidance sits
directly after the table, before those fields. Metadata retains separate help
explaining the distinction between caption and description. Menus preserve
native selections, report mixed alignment without an active value, and offer
horizontal and vertical default resets. Removed blocks destroy their popovers,
including when Wagtail retains hidden block elements in the form.

Native setCellAttribute can skip a mixed selection when its first cell already
has the requested value. Compose Tiptap's core updateAttributes commands for data
and header cells to cover the complete selection instead. No new dependencies,
custom table transactions, or storage changes were introduced.

Validation: make test passed with 88 Python and 19 TypeScript tests, including
type, template, formatting, and reproducible-asset checks. Targeted checks using
real Wagtail controllers in an isolated widget harness passed for keyboard menu
opening/dismissal, menu switching, selection alignment and resets, merged cells,
native keyboard history, independent instances, and deleted-block cleanup. These
checks do not establish that the complete StreamField journeys pass. The updated
Playwright suite collects 12 tests; its full run remains blocked by the sandbox's
local-server restriction. Run make test-browser locally or in CI, including the
new menu, lifecycle, and paste-help placement assertions.


### Simplified menus and empty-state insertion

Removed Table after moving First row headers into Row and First column headers
into Column, separated from structural actions. Their native commands and active
state indicators remain unchanged. With a table, show Row, Column, and Cell;
without one, close and hide all menus and show a direct Insert table button.
Insertion still uses the existing native 3×3 command. Invalid saved values retain
an error and disabled insertion rather than silently replacing content. Caption
and description remain visible and disabled while empty.

Escape from the editor now focuses Row when a table exists, or Insert table when
empty. Updated browser scenarios cover header locations and highlights, menu
switching, empty-state focus, deletion, undo/redo, draft reload, recovery insertion,
and protected malformed values. No public API or storage changes.

Validation: make test passed (88 Python tests, 19 TypeScript tests, Django checks,
Ruff, template checks, TypeScript checking, and reproducible assets). Rebuilt the
distributed frontend. make test-browser was attempted but its server could not
start: Operation not permitted. The updated browser journeys require a local or
CI run; no full browser pass is claimed for this refinement.

### Metadata field presentation

Caption and Summary now use Wagtail's rawformattedfield template tag rather than
custom label/input markup. Each field has its own nearby help text and unique
label/help IDs assigned per widget, including aria-describedby on its input.
Caption identifies the table topic; Summary provides orientation or navigation
hints for complex tables. Summary is a UI label change only: the description
JSON property and accessible published rendering are retained. Browser assertions
check each field's accessible description; full browser execution still requires
the local/CI server environment.


Removed permanent paste guidance at the user's request. Clipboard feedback and
error announcements remain available when needed; removed the unused help string,
styles, and editor aria-describedby reference.
