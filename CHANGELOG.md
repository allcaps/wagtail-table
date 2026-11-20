# Changelog

## Unreleased

- Start new blocks with a 3×3 table and show Insert table only in empty editors.
  Preserve empty drafts and use native Wagtail required-field validation when
  publishing. Reject any document content outside the single table.
- Keep Table actions and Table settings buttons visible above their panels;
  opening either panel closes the other. Use compact form controls and keep
  merge, split, and header-cell actions together on one row.
- Keep first-row/column header highlights accurate in custom header layouts.

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
