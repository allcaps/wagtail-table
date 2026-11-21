# Changelog

## Unreleased

- Flush native Draftail form values before duplicating or submitting hybrid cells
  so an immediate save retains rich text in duplicated tables.

- Add experimental inline hybrid cells via `TableBlock(cell_block=...)`, with
  native Wagtail StreamBlock editing and multiple items per cell. Include a
  rich-text/image/emoji demo, version-2 persistence, native validation and
  rendering, reference tracking, batch cell conversion with confirmation before
  clearing content, and conservative paste/merge rules.

- Add a WAI-inspired accessibility fixture collection and demo page, with source
  links, motivations, spanning-header examples, and explicit renderer limitations.

- Replace alignment menu entries with two labelled button groups, original SVG
  icons registered with Wagtail, and accessible names and hover/focus tooltips.
  Put a text-style Clear action after each group's icons to restore defaults.

- Start new blocks with a 3×3 table and show Insert table only in empty editors.
  Preserve empty drafts and use native Wagtail required-field validation when
  publishing. Reject any document content outside the single table.
- Group controls in native Wagtail Row, Column, and Cell dropdowns, placing edge
  header toggles in Row and Column. Empty editors show a direct Insert table
  button instead of menus.
  Keep caption and description fields visible below the table.
  Move selected-cell alignment into Cell, with mixed-selection indicators and
  default resets. Use keyboard shortcuts for undo/redo instead of toolbar buttons.
- Keep first-row/column header highlights accurate in custom header layouts.
- Use Wagtail's field markup for Caption and Summary, with separate help text
  associated with each input. Summary retains the existing description storage.

## 0.1.0a1 — 2026-11-20

First public alpha of the native Tiptap table editor for Wagtail StreamField.

- Direct text editing, row and column operations, cell selection, merge/split,
  undo/redo, header controls, and horizontal/vertical alignment.
- Captions, accessible descriptions, versioned JSON storage, and escaped
  server-side HTML rendering with no public JavaScript dependency.
- HTML table and TSV paste through native ProseMirror table handling, with
  package-specific limits and feedback for unsupported content.
- Independent StreamField editors, including dynamic insertion, duplication,
  draft save/reload, and publishing.
- Prebuilt frontend assets and bundled dependency notices in Python packages;
  installing the package does not require Node.js.

This is an experimental release for evaluation. Public APIs and stored data may
change before a stable release; automatic migrations between alpha versions are
not promised. Back up content before upgrading. Hybrid Wagtail block cells are
planned and are not implemented.

The verified development stack is Python 3.13, Wagtail 8.1, and Django 6.1.
Broader compatibility testing, real Excel/Google Sheets/Word clipboard checks,
and a full accessibility review remain outstanding. Complex header relationships
have documented limits; UX refinement is planned before hybrid-cell work.
