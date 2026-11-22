# Lessons from Wagtail table issues and RFCs

Research date: **22 November 2026**. This review identifies behaviours to preserve
or test in `wagtail-table`. It is not a reproduction of upstream bugs, an
accessibility audit, or a commitment to implement every requested feature.

The strongest lesson is that a working editing surface is only part of a table
block. Visible edits must reach saved state; nested controls need clear focus
ownership; content must participate in search, reference tracking, and native
validation. Existing tables also need a migration story.

## Evidence and method

Reviewed both open and closed issues using GitHub's public search and REST API:

| Search in `wagtail/wagtail` | Results returned |
| --- | ---: |
| `is:issue TableBlock` | 52 |
| `is:issue TypedTableBlock` | 19 |
| `is:issue table in:title` | 55 |

These sets overlap and include irrelevant database/listing-table issues. Counts
describe these searches on the review date, not the number of table-editor bugs.
Selected issue bodies and relevant discussion comments were read, including
maintainer explanations of closures. Statuses below were checked through the
GitHub API; an old report being open does not demonstrate that current Wagtail
still exhibits it. Likewise, closed does not necessarily mean fixed.

The [RFC search supplied for this review](https://github.com/wagtail/rfcs/pulls?q=is%3Apr+table)
returned seven PRs through the API, many with incidental matches. A title-only
search returned none. Reading recent roadmap RFC texts separately located the
directly relevant table proposal in RFC 107. Related integration RFCs were also
reviewed. This is a targeted review, not an exhaustive review of every RFC,
comment, design attachment, or historical pull request. Linked Figma prototypes
and recordings were not interactively evaluated here.

## Issues: what a replacement needs to get right

Each implication below is our interpretation of the upstream evidence, rather
than a claim that the issue's proposed solution should be copied.

### Saved state must match what editors see

| Evidence | Status on review date | Lesson for this package |
| --- | --- | --- |
| [#14663: touch/keyboard edits disappear after saving](https://github.com/wagtail/wagtail/issues/14663) | Open; unconfirmed / needs information | The report distinguishes visible DOM edits from the widget's saved model, with touch emulation on Wagtail 7.4.3. Test actual typing followed by save/reload; inspecting the cell before save is insufficient. This is not physical-phone evidence or a reproduced bug in our package. |
| [#14662: caption becomes undefined on duplication](https://github.com/wagtail/wagtail/issues/14662) | Open; confirmed by a maintainer | Duplicate metadata as well as cell content. Test empty and populated captions, descriptions, and independent subsequent edits. A proposed fix PR does not establish a released fix. |
| [#7654: replacement columns disappear on save](https://github.com/wagtail/wagtail/issues/7654) | Closed; completed | Test delete-column → insert at the same position → type → save, as one editing session. Index reuse and stale nested form state are integration risks. |
| [#5503: merge state is lost on save](https://github.com/wagtail/wagtail/issues/5503) | Closed; completed | A native library option is not complete package support until spans survive JSON, reload, and published rendering. |
| [#2655: alignment is not saved](https://github.com/wagtail/wagtail/issues/2655) | Closed; completed | Every offered action needs a complete persistence/rendering path. The same applies to future column widths and style choices. |

### Focus and accessibility belong to the editor integration

| Evidence | Status on review date | Lesson for this package |
| --- | --- | --- |
| [#8893: keyboard users cannot reach TableBlock](https://github.com/wagtail/wagtail/issues/8893) | Closed; completed | Test entering and leaving the whole widget with the keyboard, as well as movement inside cells. A table library's keyboard shortcuts do not establish a usable surrounding form. |
| [#7646: TypedTableBlock accessibility and UI catalogue](https://github.com/wagtail/wagtail/issues/7646) | Open | The issue identifies focus after insertion, row/column position announcements, heading-input labels, menu state, and deletion safety. Use these as review questions. Its ARIA grid suggestion is not a mandate to add grid roles without the corresponding interaction model. |
| [#5989: make header choice explicit](https://github.com/wagtail/wagtail/issues/5989) | Closed; completed | Header controls can be overlooked even when the renderer supports headers. Evaluate discoverability and accurate state. The discussion also favours preserving stored flags while changing the UI, rather than forcing a data migration for a control redesign. |
| [#6016: configured header defaults and checkboxes disagree](https://github.com/wagtail/wagtail/issues/6016) | Open | Initial settings, displayed state, saved nodes, and published semantics must agree. Avoid an independent header preset drifting from the actual cell types. |
| [#5235: captions for TableBlock](https://github.com/wagtail/wagtail/issues/5235), [#8507: captions for TypedTableBlock](https://github.com/wagtail/wagtail/issues/8507) | Both closed; completed | Captions are part of the content model and semantic output. Preserve them across editing and duplication, rather than treating them as decorative text. |

An issue checklist may contain stale unchecked items even after individual fixes
have shipped. In particular, the TypedTableBlock menu's `aria-expanded` improvement
is recorded in [Wagtail 6.4 release notes](https://docs.wagtail.org/en/v6.4/releases/6.4.html).
Do not use #7646 alone to claim every listed defect remains in Wagtail 8.1.

### Space, visibility, and lifecycle

| Evidence | Status on review date | Lesson for this package |
| --- | --- | --- |
| [#9717: wide TypedTableBlocks are cut off](https://github.com/wagtail/wagtail/issues/9717) | Open | A scrolling table wrapper must work inside the complete edit form, including nested containers and the preview panel. |
| [#11091: TypedTableBlock design improvements](https://github.com/wagtail/wagtail/issues/11091) | Open | A wider modal/panel is already an upstream design direction. Inspect its linked designs before inventing an unrelated full-screen treatment; this review did not test the prototype. |
| [#5763: a large table stretches neighbouring InlinePanel fields](https://github.com/wagtail/wagtail/issues/5763) | Closed; completed | Test containment in nested forms, not just a standalone table. A wide editor must not distort adjacent fields. |
| [#2687: TableBlock in a non-default tab](https://github.com/wagtail/wagtail/issues/2687) | Open | Initialization while hidden must not require a browser resize to become usable. |
| [#13760: table missing outside the first tab](https://github.com/wagtail/wagtail/issues/13760) | Closed as duplicate of #2687 | Closing a duplicate does not resolve the underlying behaviour. Group these as one recurring visibility concern. |
| [#8611: initially collapsed table does not load](https://github.com/wagtail/wagtail/issues/8611) | Closed; unable to reproduce in later maintainer checks | Keep expand-after-load and nested StructBlock cases in our regression scenarios; do not describe this closure as a verified code fix. |
| [#10335](https://github.com/wagtail/wagtail/issues/10335), [#10427](https://github.com/wagtail/wagtail/issues/10427): saved tables stop being editable | Closed; completed | Test a second editing session after saving, rather than only initial creation. |
| [#11301: another saved-table editing report](https://github.com/wagtail/wagtail/issues/11301) | Closed; not planned, with unsuccessful reproduction attempts | Maintainers raised outdated static assets as a possible explanation. Include collected/static production assets in release checks; do not assume all similar symptoms share a cause. |

These reports reinforce the [minimum-width and scrolling finding](README.md#finding-typedtableblock-reserves-space-for-cell-editors)
and the [hybrid interaction study](hybrid-interactions.md). Width, hidden-state
initialization, and competing selection behaviour are distinct problems.

### Reuse the rest of Wagtail, not just its form controls

| Evidence | Status on review date | Lesson for this package |
| --- | --- | --- |
| [#13156: TypedTableBlock text is not searchable](https://github.com/wagtail/wagtail/issues/13156), [#3167: TableBlock search indexing](https://github.com/wagtail/wagtail/issues/3167) | Both closed; completed | Traverse native and configured block content for search, including metadata where appropriate. Successful HTML rendering does not imply indexing support. |
| [#13581: media references inside typed cells are missing](https://github.com/wagtail/wagtail/issues/13581) | Closed; completed | Delegate reference extraction to native blocks. Images/document links must participate in usage tracking; otherwise cleanup based on apparent non-use can break content. |
| [#7997: nested table errors are not displayed](https://github.com/wagtail/wagtail/issues/7997) | Closed; completed; comments identify #10131 as the fix | Test error presentation within StructBlocks and hybrid cells. An unsuccessful save with only a generic banner does not tell the editor how to repair the table. |
| [#11816: TableBlock conversion fails on None](https://github.com/wagtail/wagtail/issues/11816), [#12848: normalize an empty TypedTable](https://github.com/wagtail/wagtail/issues/12848) | Both closed; completed | Defaults, empty values, normalization, and invalid drafts need explicit tests. Rendering and indexing must handle absence safely. |
| [#13730: table commenting behaviour](https://github.com/wagtail/wagtail/issues/13730) | Open; report not confirmed | Record whole-table versus cell-comment support explicitly. Native child controls do not automatically give the table reliable comment targeting. |
| [#13949: missing installed app produces a Telepath failure](https://github.com/wagtail/wagtail/issues/13949) | Open | Make installation requirements clear and test registration/static media together. A broken StreamField with only a console message is poor integration feedback. |
| [#5504: unsupported locale](https://github.com/wagtail/wagtail/issues/5504) | Open | A widget dependency's language catalogue must not prevent initialization. Translate our controls and use supported fallbacks where needed. |

### Extensibility and maintenance have costs

- [#8324](https://github.com/wagtail/wagtail/issues/8324) is an open request for
  accessible row/column reordering. It shows demand for maintaining existing
  tables without re-keying content. Investigate native commands and merged/hybrid
  content behaviour before selecting a drag interaction; the issue does not
  establish that our package already supports reordering.
- [#6041](https://github.com/wagtail/wagtail/issues/6041) is a closed request for
  richer content such as links, lists, and emphasis. It supports our motivation
  for combining convenient text entry with Wagtail-native content, without
  establishing that inline multi-item StreamBlocks are the best interface.
- [#6536](https://github.com/wagtail/wagtail/issues/6536) remains open: a template
  helper returning an entire class attribute makes adding site classes awkward.
  Prefer composable, validated class values when designing
  [integrator-defined styles](html-table-support.md#proposal-integrator-defined-style-choices).
- [#9315](https://github.com/wagtail/wagtail/issues/9315) is closed after maintainers
  distinguished scanner findings from vulnerabilities applicable to Wagtail's
  configured cell types. [#13259](https://github.com/wagtail/wagtail/issues/13259)
  was closed without planned action after maintainers explained that the flagged
  Moment.js paths are not used. These reports demonstrate maintenance and audit
  friction; they do not establish exploitable vulnerabilities in the default
  widget. License constraints also limited upgrading the bundled Handsontable.
- Separately, [CVE-2026-28222](https://github.com/wagtail/wagtail/security/advisories/GHSA-p5cm-246w-84jm)
  is a confirmed, patched TableBlock class-attribute escaping vulnerability.
  For proposed styles, validate allowed choices on the server and still escape
  template attributes correctly. An editor-only choice list is not a substitute
  for either. This is upstream evidence, not a finding against this package.

## RFCs, roadmap, and design direction

### Direct table direction: RFC 107 and roadmap item 107

[RFC 107](https://github.com/wagtail/rfcs/pull/107) was merged on 9 July 2025.
Its [New table block section](https://github.com/wagtail/rfcs/blob/main/text/107-roadmap-updates.md#new-table-block)
proposes replacing or improving the editing experience offered by the two native
blocks. A merged roadmap proposal is not a delivered replacement or an approved
editor architecture.

The separate [roadmap issue #107](https://github.com/wagtail/roadmap/issues/107)
is open and marked Future. Its goals cover rich cell content, an accessible
editing interface, and migration from the existing TableBlock. The matching
number is coincidental: this is a different repository and record from RFC 107.

[Discussion #14113](https://github.com/wagtail/wagtail/discussions/14113) keeps the
approach open: improve existing blocks or start again, in core or a package.
It identifies retiring unsupported Handsontable as a goal and links TinyMCE,
Jspreadsheet CE, TypedTableBlock improvements, and Draftail as alternatives.
It also distinguishes editorial layout/control needs from spreadsheet-like data
entry. This is useful motivation for our combined approach, not upstream approval
of Tiptap or of this package.

**Implication:** add a migration investigation to release planning. Inventory
legacy text, headers, captions, spans, and alignment; define conversions and
report unsupported data before writing a migration command. Preservation and a
reviewable conversion matter more than reproducing every legacy editor setting.
No conversion tool or migration guarantee is introduced by this report.

### Related integration RFCs

| RFC | Verified disposition | Relevance and boundary |
| --- | --- | --- |
| [104: validation on publish](https://github.com/wagtail/rfcs/pull/104) | Merged, 22 May 2025 | Explains incomplete drafts versus publish-time requiredness. Use Wagtail's validation lifecycle for empty tables and required native child blocks. A merged RFC alone does not establish every implementation detail; use installed APIs. |
| [50: commenting](https://github.com/wagtail/rfcs/pull/50) | Merged, 1 February 2022 | Explains why comments need links to editable content rather than frontend HTML offsets. Table/cell targeting and behaviour after structural edits require explicit support and testing. |
| [78: Stimulus adoption](https://github.com/wagtail/rfcs/pull/78) | Merged, 24 October 2022 | Supports native lifecycle-aware admin components and less global/inline JavaScript. It does not require replacing our documented StreamField/Telepath integration or introducing another editor framework. |
| [80: References Index](https://github.com/wagtail/rfcs/pull/80) | Closed without merge | The author explains that the actual implementation differed and points to [core PR #9170](https://github.com/wagtail/wagtail/pull/9170). Use the shipped reference APIs; do not implement this RFC's abandoned JSON/field design. |

The table query also returned RFCs 45, 69, 85, 100, and 116. Their matches do not
make them table-editor specifications. In the reviewed set, no dedicated RFC
selects a replacement table engine. RFC 107's rendered text and the roadmap
discussion provide more direct table guidance than a title/PR-body search alone.

## Suggested acceptance scenarios for our package

These are review targets, not claims of new automated coverage:

1. Type, immediately save, reload, edit again, and publish. Repeat after moving
   focus, using keyboard-only input and touch emulation. Record physical-device
   testing separately.
2. Duplicate text and hybrid tables with metadata and unsaved child-field edits;
   change each copy independently. Delete and replace rows/columns in the same
   session, then reload.
3. Persist merged cells, header types, alignment, and any newly offered styles or
   widths through the full save/load/render cycle.
4. Open a saved table inside an initially hidden tab and a collapsed nested
   block. Confirm it works without resizing the window and remains independent
   of other table instances.
5. Use wide tables inside nested forms and alongside preview. Confirm scrolling
   contains the table, neighbouring fields remain usable, and focus is visible.
6. Verify keyboard entry/exit, focus after insertion/deletion, labelled controls,
   menu state, and the distinction between editing content and selecting cells.
   Include a manual screen-reader pass; native shortcuts are insufficient evidence.
7. Check nested required-field errors, repair and resubmit, save incomplete drafts
   where allowed, and enforce publication requirements through Wagtail.
8. Index table text and metadata; verify native image/document usage and search
   through the actual Wagtail integration, not only rendered HTML.
9. Review comments, localization, collected assets, and legacy import as explicit
   capabilities or documented limitations. Do not infer them from a usable demo.

Current package source already implements `get_searchable_content`,
`extract_references`, and deferred required validation. Existing tests include
image reference extraction and hybrid save/render scenarios. That is a useful
foundation, not proof that every scenario above is covered. This research ran no
new editor, physical-device, screen-reader, or upstream reproduction tests.

Clipboard evidence remains in the [clipboard policy and verification guide](../../clipboard.md):
these issue searches do not replace testing real spreadsheet/word-processor
clipboard payloads. The investigation identifies priorities, without expanding
the supported HTML vocabulary or changing package behaviour.
