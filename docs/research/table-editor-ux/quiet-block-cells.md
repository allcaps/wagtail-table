# Experiment: quiet block cells

Branch: `experiment/quiet-block-cells`, based on `research/hybrid-table-ux`.
The corner-selection experiment remains on its separate branch. This experiment
does not add its handles or merge changes into main.

## Question and interaction

Can a passive cell representation separate table manipulation from native Wagtail
editing, consistently across direct fields, one-item choices, and multi-item
StreamBlocks?

| State | Surface | Interaction owner |
| --- | --- | --- |
| Quiet | Current rendered value, or blank content, with a pencil | Tiptap/ProseMirror cell selection and table commands |
| Edit | Configured native block editor and Done, inside the cell | Wagtail fields, Draftail, block insertion, and choosers |
| Page preview / publication | Existing block rendering within the page template | The site's frontend and Wagtail preview workflow |

The pencil has a row/column label and can be activated with the keyboard. One cell
per table can be active. It expands to a minimum width of 22rem, compared with
TypedTableBlock's 20rem content-cell minimum. Horizontal scrolling contains the
expanded table. This experiment does not resize or save column widths.

The table remains editable while a cell is active. Interacting with another cell,
choosing a table action, or activating another pencil finishes the current edit
and preserves its contents. Switching pencils opens the next editor directly.
Native child fields, insertion popovers, and chooser dialogs do not close the
active editor. Other tables and page controls stay available.

Done remains an explicit way to finish and return focus to the pencil. Implicit
closing preserves the new interaction's focus instead. Both paths flush native
state, hide the form, and refresh the passive representation; neither saves the
page, discards changes, or enforces publication-time requiredness. Range-selection
mouse handlers finish before collapsing the active editor changes table geometry.
No overlay or cancel/revert mechanism is added.

Quiet block nodes are not independently selectable/draggable atoms: their cells
use native CellSelection. Clicking the quiet surface can select its cell, while
native range handling remains responsible for selecting across cells. Active
input/rich-text caret and selection styles are isolated from ProseMirror's
hide-selection state. The outer accessibility role changes from textbox to group
while editing so native fields remain exposed.

## Rendering and persistence

The initial form state includes a passive representation generated with the
configured block's Python `render()` method. Default StructBlock output may show
keys and values; StreamBlocks render their children. This is not the block
picker's sample-value preview.

Done posts the affected cell's native form fields to a package admin endpoint.
It uses Wagtail's registered block definitions, a signed definition reference,
admin access checks, CSRF protection, and the native block's form decoding.
Incomplete required values remain editable. No arbitrary Python import path or
block definition is accepted from the browser. Requests do not write content.

Wagtail's HTML whitelister supplies escaping and URL handling. The quiet fragment
retains basic text markup and images, without links, forms, controls, scripts,
embedded documents, site classes, IDs, or event handlers. No frontend assets are
loaded. A template requiring missing page context, a failed request, or an expired
editing session leaves the quiet representation blank; the pencil and cell data remain.
Stale requests are aborted when reopening/replacing/removing a cell.

The request context is available to rendering; the full page-preview context is
not. Consequently quiet content and page preview can differ in structure, styling,
and completeness. The published renderer is unchanged.

Quiet HTML is transient editor state, excluded from saved JSON. Native widgets
remain mounted in hidden wrappers while quiet, keeping their existing state,
native POST fields, and duplication path. Wagtail replaces widget placeholders,
so those wrappers must be separate from the placeholder passed to `render()`.
Draftail is flushed through its own save API before Done, duplication, or page
submission. Rendering never supplies the authoritative saved value.

## Deliberate limits and follow-up

- No custom quiet-rendering hook is introduced. A future optional block method
  could provide an editor-specific representation, falling back to normal block
  rendering. Naming, context, and sanitization policy need a separate design.
- The passive vocabulary may omit useful site-specific markup. This experiment
  prioritizes readable, noninteractive content over frontend visual fidelity.
- Hidden widgets still incur initialization cost. Lazy mounting and server-side
  render batching are future performance investigations, not part of this pass.
- The signed definition reference follows Wagtail's process-local block registry
  pattern. Definition changes while a form is open can invalidate a rendering
  request; content must remain editable and saveable despite this.
- Existing hybrid restrictions on merge, clipboard operations, cell comments,
  and separate undo histories remain in place.
- Screen-reader usability and physical touch devices require dedicated review.

## Verification

Python coverage checks native direct/StreamBlock decoding, incomplete required
values, endpoint access and CSRF, multipart requests after CSRF processing,
passive HTML, template failure, and transient state. TypeScript coverage checks
that quiet HTML survives form-state duplication but never enters submitted JSON.

The browser journeys cover direct text/rich text and one/multi-item StreamBlocks,
pencil/Done, focus, selection, duplication, metadata, save/reload, and publication.
Execution results and remaining limitations are recorded in PLAN.md. A collected
test is not evidence of successful execution.
