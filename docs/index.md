# wagtail-table

A reusable Wagtail StreamField block for editing semantic tables with native
Tiptap and ProseMirror. Published tables render through Python and Django
templates. Installing the Python package does not require Node.js.

Version 0.1.0a3 is an alpha release with native text tables and experimental hybrid
Wagtail block cells. Hybrid cells have quiet and inline editing states. Research
findings and proposed prototypes also describe future work; their inclusion in
the documentation does not imply that every proposal is implemented.

## Choose a starting point

- **Integrating a table:** start with [installation and usage](usage.md).
- **Checking paste behaviour:** read the [clipboard guide](clipboard.md), including
  the distinction between automated fixtures and external-application checks.
- **Checking semantic HTML:** use the [element and attribute support matrix](research/table-editor-ux/html-table-support.md).
- **Running the demo or contributing:** see [local development](development.md).
- **Reviewing interaction design:** start with the [research overview](research/table-editor-ux/README.md)
  and its matched screenshots of direct fields and StreamBlock cells.

## Reading the research

Research distinguishes observations, installed-code checks, vendor documentation,
and proposals. Screenshot indexes record the capture method and its limitations.
Click a screenshot to open its original file at full size. Wide comparison tables
scroll horizontally; the chapter sidebar and search provide other entry points.

The [GitHub repository](https://github.com/allcaps/wagtail-table) contains the
Markdown sources, implementation plan, examples, and issue tracker.
