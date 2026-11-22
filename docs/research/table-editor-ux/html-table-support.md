# HTML table elements and attributes: support overview

Checked **22 November 2026** against MDN, this package's validator/templates, and
the installed **Wagtail 8.1** table implementations. This is an implementation
inventory, not a new feature specification or browser-compatibility audit.

The element names below link to MDN. “Our table” covers native text, direct
Wagtail fields, one-item choices, and multi-item StreamBlocks: they share the same
table structure and attribute renderer. Configured block content is a separate
rendering responsibility.

## Reading support correctly

- **Editable:** a control/command exists in the current editor.
- **Generated:** Python derives the element/attribute; editors do not author it.
- **Stored only:** JSON accepts/preserves it, but published HTML does not use it.
- **Unsupported:** absent from the default table model/renderer; custom integrator
  templates or arbitrary block output do not count as package support.

The tables describe **published HTML**, not everything visible in the admin DOM.
Native table libraries may create wrappers, column elements, roles, styles, and
focus attributes solely for editing. Browser acceptance of HTML also does not
mean our server accepts equivalent attributes in its JSON model.

## 1. All modern table-family elements

“Global” means HTML global attributes apply; it does not mean our editor exposes
or preserves them. The next sections detail our attribute allowlist.

| Element / MDN | Purpose | Modern element-specific attributes | Our published table | Wagtail TableBlock | Wagtail TypedTableBlock |
| --- | --- | --- | --- | --- | --- |
| [`table`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table) | Table container | None; global attributes | Generated, one per block | Generated | Generated |
| [`caption`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/caption) | Table title | None; global | Optional caption field, first child | Optional caption field | Optional caption field |
| [`colgroup`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/colgroup) | Column grouping | `span` | Unsupported in published output | No default published output | No default published output |
| [`col`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/col) | Column definition | `span` | Unsupported in published output | No default published output | No default published output |
| [`thead`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead) | Header row group | None; global | Generated from leading all-header rows, subject to spans | First row when configured as headers | Column-heading row |
| [`tbody`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody) | Body row group | None; global | One generated body group when body rows exist | One generated body group | One generated body group |
| [`tfoot`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot) | Footer row group | None; global | Unsupported | Unsupported by default | Unsupported by default |
| [`tr`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr) | Row | None; global | Editable rows | Editable rows | Editable rows |
| [`th`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th) | Header cell | `abbr`, `colspan`, `headers`, `rowspan`, `scope` | Individual cells and first-edge conveniences | First-row/first-column header settings | Column-heading cells |
| [`td`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td) | Data cell | `colspan`, `headers`, `rowspan` | Editable cells | Editable cells | Configured block cells |

In HTML, a caption precedes column groups and row groups; a footer is not merely
a last row with bold text. Our JSON stores rows without explicit section nodes.
Python reconstructs header/body grouping. It cannot express authored footer rows
or multiple body groups. A span crossing the proposed header/body boundary keeps
all rows in one body group to avoid splitting that cell across groups.

A `<colgroup>` groups columns; it does not merge cells. Its `span` is used when
it has no child `<col>` definitions. These elements could support future column
styling/width policies, but their presence in an editor is not published support.

## 2. Modern attributes and our implementation

| Attribute and location | MDN meaning | Our storage / authoring | Our published output |
| --- | --- | --- | --- |
| `colspan` on `td`/`th` | Number of columns covered | Stored cell attribute; native merge/split commands | Emitted when greater than one |
| `rowspan` on `td`/`th` | Number of rows covered | Stored cell attribute; native merge/split commands | Emitted when greater than one |
| `headers` on `td` | IDs of applicable header cells | Generated; no manual association editor | Edge-header associations where the renderer can determine them |
| `headers` on `th` | IDs of headers describing this header | No authored hierarchy | Not generated by the current association algorithm |
| `scope` on `th` | `row`, `col`, `rowgroup`, or `colgroup` relationships | No manual scope field | Generated `row`/`col` for identifiable unspanned edge headers; no generated group scopes |
| `abbr` on `th` | Short alternative header label | Unsupported | Not emitted |
| `span` on `col`/`colgroup` | Number of columns represented | No column-group model | Not emitted |

Limits are intentionally narrower than browser handling. Our server accepts
positive integer spans only: `colspan` up to 100 and `rowspan` up to 1000, within
a valid rectangular table of at most 100 columns and 1000 rows. MDN documents
larger browser limits: colspan values above 1000 and rowspan values above 65534
are clipped. HTML's `rowspan="0"` extends through its row group; our validator
rejects that value rather than storing an implicit extent.

Merge/split controls use native Tiptap commands. Merging a selection containing
Wagtail block cells is currently disabled, so renderer support for spans does not
imply every content-type combination can be merged in the editor.

### Header semantics and limitations

Every generated `th` receives an ID. Data cells can reference leading column
headers and first-column row headers, including supported spanning edge headers.
Spanning headers use explicit associations instead of guessed `rowgroup` or
`colgroup` scopes. Those scope values describe groups; they are not synonyms for
“this cell spans several rows/columns”.

Individual interior headers render as `th` but are not automatically assigned
inferred relationships. Header-to-header associations, arbitrary multi-level
hierarchies, changing bands, and offset row-header schemes are not fully modelled.
See the [WAI-inspired fixture limitations](https://github.com/allcaps/wagtail-table/blob/main/tests/fixtures/accessibility/README.md).
This is not a guarantee that arbitrary complex tables are accessible.

## 3. Relevant global and accessibility attributes

MDN's [global attributes reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes)
covers attributes shared by all HTML elements. That larger set includes `id`,
`class`, `style`, `title`, `lang`, `dir`, `data-*`, `hidden`, `tabindex`, and
`contenteditable`. This overview lists table-relevant implementation choices,
not every global attribute or event-handler name.

| Attribute | Our published output / authoring |
| --- | --- |
| `id` | Generated on header cells and the description paragraph. IDs are unique per render, not stable saved cell IDs or permanent URL anchors. |
| `class` | Whitelisted alignment classes on cells; no arbitrary class input. Integrators load the shipped public stylesheet. |
| `aria-describedby` | Generated on the table when a description exists; references the description paragraph. |
| `aria-label` / `aria-labelledby` | No manual authoring or default emission. A caption supplies the normal table title. |
| `role` / `aria-selected` | No grid-role or selection-state output. Published content remains a semantic HTML table; editor selection is not published. |
| `style`, `title`, `lang`, `dir`, arbitrary `data-*` | No table/cell JSON passthrough. Site templates may provide surrounding language, direction, and presentation. |
| `tabindex`, `contenteditable`, event handlers | Editor mechanics are not copied into published table markup. |

“Summary” in our editor stores the JSON `description` field. It renders as a
paragraph associated by `aria-describedby`; it does **not** output the obsolete
HTML `summary` attribute. Caption and description are plain text and escaped.

## 4. Alignment, widths, and saved node attributes

| Stored JSON attribute | Editor support | Published HTML |
| --- | --- | --- |
| `align`: `left`, `center`, `right` | Selected-cell alignment controls; native Tiptap attribute | Fixed `wagtail-table-align-*` CSS class, not deprecated HTML `align` |
| `verticalAlign`: `top`, `middle`, `bottom` | Selected-cell alignment controls | Fixed `wagtail-table-valign-*` CSS class, not deprecated HTML `valign` |
| Missing / null alignment | Clear/default state | No corresponding alignment class |
| `colwidth`: list matching the cell's colspan | Accepted/preserved native metadata (each width 0–10000); no package column-resize control | **Stored only:** ignored by Python; no widths or column elements emitted |
| `rowspan`, `colspan` | Native table commands and validation | Semantic span attributes as above |

No arbitrary cell height, padding, borders, colours, justified/baseline alignment,
CSS, or attributes can be supplied through this model. These are presentation
questions, not reasons to revive obsolete HTML attributes.

The table document does not accept user-provided `id`, `scope`, `headers`, `abbr`,
`style`, or arbitrary classes. Generated HTML attributes are distinct from the
JSON input allowlist. Pasted HTML passes through the supported Tiptap schema and
package clipboard rules; it is not an arbitrary table-HTML round-trip facility.

## 5. Native Wagtail comparison: generated attributes

These describe the installed default Python templates. A custom integrator
template or Handsontable option can change behaviour; that is not default support.

| Feature | Our tables | Wagtail TableBlock | Wagtail TypedTableBlock |
| --- | --- | --- | --- |
| Row/column header scope | Generated where determinable; individual header cells allowed | `col` for header row, `row` for first-column headers | `col` for column headings |
| Explicit `headers` and header IDs | Generated for supported edge relationships | Not generated | Not generated |
| `rowspan` / `colspan` | Supported model and renderer, with merge restrictions for block content | Renderer uses stored `mergeCells`; editing availability depends on `table_options` | No default span model/renderer |
| Alignment classes | Controlled package vocabulary and public CSS | Renderer forwards saved cell `className`; editor options and frontend CSS determine usable styling | No default per-cell alignment attribute model |
| Description association | Generated paragraph and `aria-describedby` | Not generated by default | Not generated by default |
| Column widths / `<colgroup>` publication | Not emitted | Not emitted by the default template | Not emitted by the default template |
| Footer / authored row groups | No | No | No |
| Cell content | Native plain text or the configured native Wagtail block | Text by default; configurable HTML renderer is a separate mode | Native blocks configured per column |

The native alignment/merge rows above are renderer capabilities checked in source
and sample rendering, not claims that their default toolbar exposes those actions.
Column widths and admin DOM elements must be checked separately from published
output in all implementations.

## 6. Deprecated attributes: reference, not a feature backlog

MDN lists the following as deprecated on these elements. Our renderer emits none
of them. Prefer CSS for presentation and current semantic attributes for headers.
The lists exclude nonstandard historical browser extensions.

| Elements | Deprecated attributes documented by MDN |
| --- | --- |
| `table` | `align`, `bgcolor`, `border`, `cellpadding`, `cellspacing`, `frame`, `rules`, `summary`, `width` |
| `caption` | `align` |
| `col`, `colgroup` | `align`, `bgcolor`, `char`, `charoff`, `valign`, `width` |
| `thead`, `tbody`, `tfoot`, `tr` | `align`, `bgcolor`, `char`, `charoff`, `valign` |
| `th` | `align`, `axis`, `bgcolor`, `char`, `charoff`, `height`, `valign`, `width` |
| `td` | `abbr`, `align`, `axis`, `bgcolor`, `char`, `charoff`, `height`, `scope`, `valign`, `width` |

Notable distinctions: `abbr` is current on `th` but deprecated on `td`; `scope`
belongs on header cells. JSON keys named `align` or `verticalAlign` are internal
model attributes and do not mean deprecated HTML is being generated.

## 7. Content inside cells and evidence

Native text cells render escaped text in `p` elements and supported hard breaks
as `br`. Rich text, images, links, and other block markup belong to the configured
Wagtail block's renderer and feature policy. A StreamBlock is not an HTML table
element and does not add table-specific semantics by itself.

MDN permits flow content in `td`; `th` has tighter descendant restrictions,
including no heading or sectioning content. Arbitrary developer-supplied block
templates can therefore produce content unsuitable for a header cell. The package
delegates their rendering; it does not validate their resulting HTML content model.
Choose appropriate header-cell block configurations/templates and test them.

Package evidence: [JSON validation](https://github.com/allcaps/wagtail-table/blob/main/src/wagtail_table/data.py),
[normalization and associations](https://github.com/allcaps/wagtail-table/blob/main/src/wagtail_table/rendering.py),
[table template](https://github.com/allcaps/wagtail-table/blob/main/src/wagtail_table/templates/wagtail_table/table.html),
[cell template](https://github.com/allcaps/wagtail-table/blob/main/src/wagtail_table/templates/wagtail_table/rows.html),
and [public alignment CSS](https://github.com/allcaps/wagtail-table/blob/main/frontend/public/table-public.css).
Native comparison evidence is Wagtail 8.1's `table_block/blocks/table.html`,
`typed_table_block/typed_table_block.html`, and the `cell_classname`/`cell_span`
template tags. See the native [TableBlock](https://docs.wagtail.org/en/stable/reference/contrib/table_block.html)
and [TypedTableBlock](https://docs.wagtail.org/en/stable/reference/contrib/typed_table_block.html)
documentation for configuration context.

This inventory was checked with sample rendering for description links, alignment
classes, unpublished column widths, native merge metadata, and typed column scopes,
plus the existing renderer/validator tests. It adds no new tags, controls, data
attributes, HTML pass-through, or accessibility claims to the implementation.

## 8. Candidates for further support

Assessment date: 22 November 2026. These are research recommendations, not an
approved implementation backlog. Native capability was checked against installed
Tiptap 3.34.0, particularly `extension-table/src/table/table.ts` and
`extension-table/src/header/table-header.ts`.

| Candidate | Native foundation | Remaining package work and priority |
| --- | --- | --- |
| Resizable columns | Tiptap's `resizable` option uses ProseMirror column resizing and native `colwidth` metadata. Our JSON already preserves that metadata. | Strong candidate for an editor experiment. Publishing widths also needs Python rendering, a responsive sizing policy, and round-trip tests. It is not just enabling an option. |
| Generated `colgroup` / `col` for widths | Tiptap generates column elements from cell widths; they are not independently authored document nodes. | Consider alongside published widths. Avoid a separate column model unless a use case requires one. |
| Integrator-defined table and cell styles | Tiptap supports extension attributes and cell-attribute commands; these do not supply a style-choice configuration or interface. | Useful candidate for site-specific presentation. Define labelled, allowlisted choices per TableBlock for tables, header cells, and data cells; add controls, persistence, and server validation. See the proposal below. |
| `abbr` on `th` | Not a default cell attribute; Tiptap supports defining additional attributes. | Small attribute/UI/rendering addition for abbreviated header labels. Modest expected demand; seek a concrete example first. |
| Authored `scope="row"` / `"col"` | Can use an additional cell attribute; the native editor does not determine its meaning. | Could help offset headers. Correct behaviour after moves, merges, paste, and header toggles needs design; this is not merely an attribute field. |
| `lang` / `dir` overrides | Possible through extension attributes, not default table-cell features. | Consider for multilingual requirements. Prefer inherited page language/direction when sufficient; expose a constrained vocabulary. |
| `tfoot` | The native model has rows, without an authored footer-section node or command. | Later. A footer-row attribute could retain the native row model, but insertion, deletion, spans, paste, and output need defined rules. |
| Multiple `tbody` groups and group scopes | No native authored row-group model. | Larger semantic change. Group scope must describe an actual group; it cannot simply mean a merged cell. |
| Manual `id` / `headers` associations | Attributes can be represented, but no native relationship-authoring interface is provided. | Separate accessibility project: references must remain valid through duplication, deletion, merging, and clipboard operations. |

The [Tiptap table API](https://tiptap.dev/docs/editor/extensions/nodes/table)
provides resizing, merge/split, header commands, and `setCellAttribute()`.
The [ProseMirror table schema](https://github.com/ProseMirror/prosemirror-tables/blob/master/src/schema.ts)
provides table, row, data-cell, and header-cell nodes with extensible cell
attributes. Extensibility does not provide section semantics or authoring UX
automatically. No commercial extensions are required for the native resizing
capability discussed here.

### Proposal: integrator-defined style choices

Allow each `TableBlock` definition to configure available styles separately for
the table, header cells (`th`), and data cells (`td`). Editors would select labels
such as “Compact”, “Numeric”, or “Highlighted”, mapped to developer-defined CSS
classes. This is a proposed capability; no public argument names or storage
representation have been selected.

The developer's allowlist should constrain saved choices and published classes.
Editors should not need to enter raw class names, and pasted content should not
introduce arbitrary classes. Existing alignment classes should remain available
alongside configured styles. The integrating project would supply the CSS;
displaying those styles inside the editing interface is a separate consideration
because site CSS may interfere with embedded Wagtail controls.

This uses ordinary Tiptap extension attributes and commands, rather than a custom
styling engine. The package would still need configuration, accessible choice
controls, persistence, and server-side validation. It would not imply support for
arbitrary CSS or change the current class allowlist described in section 3.

The [upstream issue review](wagtail-issues-and-rfcs.md#extensibility-and-maintenance-have-costs)
adds concrete evidence: class values should compose with site templates, and
Wagtail's patched class-attribute XSS reinforces the need for server validation
and correct attribute escaping even when the editor offers only fixed choices.

Before implementation, resolve:

- Whether choices are exclusive or can be combined, and how styles are cleared.
- What happens to cell styles when a header becomes a data cell or vice versa.
- How mixed selections display their state and receive style changes.
- How existing content behaves when an integrator removes or renames a choice.
- Which configured styles survive copying and pasting, including between tables
  with different available choices.

Suggested experiment order:

1. Improve editing space with cell minimum widths and horizontal scrolling,
   following the [TypedTableBlock precedent](README.md#finding-typedtableblock-reserves-space-for-cell-editors).
   This can be editor-only, without changing stored content or published HTML.
2. Try native column resizing with text, direct-field, and StreamBlock cells.
   Include merged cells and a way to restore automatic sizing.
3. Decide whether widths should affect publication. Check narrow screens and zoom;
   do not assume desktop editing widths are suitable frontend dimensions.
4. Improve supported header relationships using concrete offset/multi-level
   examples. Defer footer sections and arbitrary hierarchies until demonstrated
   requirements justify their complexity.

## 9. Web usage evidence and its limits

HTTP Archive's Web Almanac reports caption adoption in its crawled sample:

| Year | Desktop sites with tables using captions | Mobile sites with tables using captions | All surveyed desktop sites using captions | All surveyed mobile sites using captions |
| --- | --- | --- | --- | --- |
| 2024 | 5.5% | 4.8% | 1.6% | 1.5% |
| 2025 | 5.6% | 4.7% | 1.7% | 1.7% |

Sources: [2024 accessibility, Table usage](https://almanac.httparchive.org/en/2024/accessibility#tables)
and [2025 accessibility, Table usage](https://almanac.httparchive.org/en/2025/accessibility#tables).
These are site/page-sample adoption figures, not percentages of individual
tables. They do not establish whether captions were needed, whether tables were
accessible, or which editor features were requested. The 2025 prose repeats an
approximate 1.6% figure; the figures above follow its table instead.

The crawl includes tables used for layout as well as data. See the respective
[2024 methodology](https://almanac.httparchive.org/en/2024/methodology) and
[2025 methodology](https://almanac.httparchive.org/en/2025/methodology) for sampling
limits. These figures are not an estimate of all tables across the entire web.

This research did not find a verified published breakdown for every table tag or
attribute, including `rowspan`, `colspan`, `abbr`, `scope`, and `tfoot`. A dedicated
HTTP Archive analysis could investigate them, but has not been performed here.
Do not treat missing statistics as evidence of low demand, or low adoption as
evidence that an accessibility feature has little value.

## 10. Recommended CMS baseline

This is a product recommendation informed by
[WAI's table tutorial](https://www.w3.org/WAI/tutorials/tables/), not a claim that
every listed editing feature is individually required by WCAG:

- Real `td` and `th` cells, with understandable row/column header controls.
- Caption authoring and optional descriptions, with accessible associations.
- Correct header relationships for every structure the package claims to support.
- Reliable keyboard editing, clipboard operations, and save/load behaviour.
- Wide tables usable on small screens and with zoom, without clipping content.
- Clear limits for complex headers, rather than misleading generated semantics.

WAI recommends simplifying complex tables where practical, retaining structural
relationships in responsive layouts, and allowing access to wide content. See
[table tips](https://www.w3.org/WAI/tutorials/tables/tips/). Supporting every HTML
table element is not a prerequisite for this baseline. Current implementation
coverage and limitations remain documented in sections 1–7; recommendations here
add no implemented capabilities or accessibility-conformance claims.
