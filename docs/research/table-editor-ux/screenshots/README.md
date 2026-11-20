# Live-demo screenshot index

Captured on **20 November 2026** through the connected Chrome browser.
All files are unannotated viewport screenshots, 1280×800 pixels at device pixel
ratio 1, WebP format. Explanatory annotations are in the
[comparison report](../comparison.md), rather than painted over the interfaces.

Sources and attribution:

- **TinyMCE 8.10.2:** Tiny Technologies,
  [Non-Premium Plugins demo](https://www.tiny.cloud/docs/tinymce/latest/full-featured-open-source-demo/).
  Version read from the running editor. The captured editor skin is dark.
- **CKEditor 5 49.1.0:** CKSource,
  [Tables overview demo](https://ckeditor.com/docs/ckeditor5/latest/features/tables/tables.html).
  Version read from the page's runtime version value. The captured editor skin
  is light.

The browser user agent reported Chrome 157 on macOS. Light color-scheme
emulation was set; each demo retained its own editor skin. Optional cookies
were left disabled. No account or trial signup was used.

The original demo content was replaced through each editor's content API with
the three-column stock fixture described in the report. UI controls, menus,
dialogs, and selection highlights are the actual demo UI. Later captures reflect
the merge/split and header changes performed during the session. TinyMCE uses
a full-width bordered fixture; CKEditor uses intrinsic table sizing. Website
navigation is retained for provenance; no CSS was injected to restyle the demos.

| TinyMCE file | Captured state |
| --- | --- |
| [tinymce-insert-grid.webp](tinymce-insert-grid.webp) | Table menu and insertion grid, with 3×3 highlighted. |
| [tinymce-context-toolbar.webp](tinymce-context-toolbar.webp) | Focused table with direct structural controls nearby. |
| [tinymce-row-menu.webp](tinymce-row-menu.webp) | Table → Row submenu. |
| [tinymce-column-menu.webp](tinymce-column-menu.webp) | Table → Column submenu. |
| [tinymce-multiple-cells.webp](tinymce-multiple-cells.webp) | Pointer-drag selection of adjacent cells. |
| [tinymce-merge-menu.webp](tinymce-merge-menu.webp) | Cell submenu for the selected range. |
| [tinymce-cell-properties.webp](tinymce-cell-properties.webp) | Cell Properties dialog before changes. |
| [tinymce-header-types.webp](tinymce-header-types.webp) | Cell type dropdown with data/header choices. |
| [tinymce-table-properties.webp](tinymce-table-properties.webp) | Table Properties dialog with caption option. |

| CKEditor file | Captured state |
| --- | --- |
| [ckeditor-insert-grid.webp](ckeditor-insert-grid.webp) | Insert table grid, with 3×3 highlighted. |
| [ckeditor-context-toolbar.webp](ckeditor-context-toolbar.webp) | Selected cell and contextual table toolbar. |
| [ckeditor-row-menu.webp](ckeditor-row-menu.webp) | Row menu with header, insertion, deletion, and selection controls. |
| [ckeditor-multiple-cells.webp](ckeditor-multiple-cells.webp) | Pointer-drag selection of adjacent cells. |
| [ckeditor-merge-menu.webp](ckeditor-merge-menu.webp) | Merge/split dropdown for the selected range. |
| [ckeditor-cell-properties.webp](ckeditor-cell-properties.webp) | Cell-properties balloon with semantics and visual settings. |
| [ckeditor-header-types.webp](ckeditor-header-types.webp) | Data/header and row/column header choices. |
| [ckeditor-inline-caption.webp](ckeditor-inline-caption.webp) | Caption toggle activated and caption text entered. |

The interfaces and branding belong to their respective owners. These captures
are retained as attributed excerpts for comparative UX commentary; the package's
BSD license does not relicense the depicted third-party interfaces or branding.
See the linked source pages for their notices. Historical PDF page renders live
separately in `../history/` and are not current-product captures.
