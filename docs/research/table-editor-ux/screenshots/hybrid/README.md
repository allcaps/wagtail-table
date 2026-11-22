# Hybrid-cell baseline captures

Captured **22 November 2026**, Chrome **157** (user agent reports macOS),
**1280×800 CSS pixels**, device scale **1**, light colour scheme, reduced motion.
Installed versions: Wagtail **8.1**, Django **6.1.3**, Tiptap **3.34.0**,
ProseMirror tables **1.8.5** (verify against the lockfile when reproducing).

These are unannotated viewport screenshots of this repository's demo. Native
Wagtail UI and branding belong to Wagtail; the sample text and teal image are
original test data. No third-party account data is shown. Eight additional matched
captures on the same date use `/table-cell-content-comparison/`; the full set has
twenty images. They use the same isolated snapshot method, not the user-provided
page or its image content.

## Capture method and limitations

An isolated SQLite database was migrated and seeded through `create_content` and
`create_examples`. Django's authenticated test client rendered the comparison
page's real admin form and public page. Their HTML snapshots were loaded through
`file://` with installed static/media files resolved to local URLs. The native
SVG sprite response was embedded. No admin CSS or editor implementation was
replaced. A disposable `ux-research` superuser supplied the rendering context.
The avatar request is unavailable in this offline fixture.

This fallback was necessary because local HTTP server startup returned
`[Errno 1] Operation not permitted`. Native DOM selection, field focus, collapse,
and local table scripts run, but network-dependent actions do not. The snapshot
prevented submission, and no user pages were edited or saved in the browser.
Raw HTML, database, media, and browser probes remain outside the repository.

To reproduce the baseline normally, run `make demo`, open
`http://127.0.0.1:8000/table-editor-comparison/`, follow **Edit this page**, and
use the same viewport. Scroll each named block under the sticky admin header.
Existing example edits are preserved, so use a separate demo database if needed.

## Files

| Capture | State / method |
| --- | --- |
| `wagtail-tableblock-small.webp` | Native Wagtail TableBlock; seeded 3×3 text table. |
| `wagtail-typedtable-small.webp` | Native TypedTableBlock; same text, CharBlock columns. |
| `tiptap-small.webp` | Our text editor; same text, native table menus. |
| `wagtail-tableblock-range.webp` | Real pointer drag from Apples to Fresh fruit; two native selected cells confirmed. |
| `tiptap-cell-range.webp` | Real pointer drag across the same cells; native CellSelection confirmed. |
| `typedtable-block-cells.webp` | Native TypedTableBlock with text, StreamBlock, emoji, and image columns. |
| `hybrid-block-cells.webp` | Our mixed cells at rest; nested native fields and overflow are visible. |
| `hybrid-text-input-focused.webp` | CharBlock focused and substring selected programmatically, before pointer-driven node selection. |
| `hybrid-richtext-selection-hidden.webp` | Rich text clicked, then keyboard selection; outer hide-selection state suppresses its highlight/caret. |
| `hybrid-native-collapsed.webp` | Native child toggle buttons activated; no custom quiet-state prototype. |
| `hybrid-wide.webp` | Twelve-column text fixture in the ordinary admin width. |
| `published-block-content.webp` | Django-rendered public response near the mixed-content examples; not Wagtail's live page-preview UI. |

## Direct-field and StreamBlock comparisons

The direct CharBlock and RichTextBlock configurations are existing package
capabilities. One-item and multi-item examples use native StreamBlocks; only the
former has `max_num=1`. All contain the same primary text, with an extra emoji in
the multi-item case. Tables have three columns and two data rows.

| Capture | Configuration |
| --- | --- |
| `direct-typed-char.webp` | TypedTableBlock with direct CharBlock columns. |
| `direct-hybrid-char.webp` | Our table configured with a direct CharBlock. |
| `direct-typed-richtext.webp` | TypedTableBlock with direct RichTextBlock columns. |
| `direct-hybrid-richtext.webp` | Our table configured with a direct RichTextBlock. |
| `one-item-typed-stream.webp` | TypedTableBlock with one-item StreamBlock columns. |
| `one-item-hybrid-stream.webp` | Our one-item StreamBlock choice cells. |
| `multi-item-typed-stream.webp` | TypedTableBlock with rich text plus an emoji per cell. |
| `multi-item-hybrid-stream.webp` | Our multi-item StreamBlock cells. |

See [the report](../../hybrid-interactions.md) for evidence, measurements, and
interpretation. The screenshots do not establish HTTP save/load, live preview,
chooser dialog behaviour, screen-reader access, or cross-browser correctness.
