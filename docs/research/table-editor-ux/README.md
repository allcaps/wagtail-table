# Table editor UX research

Status: historical review and the first live-demo comparison completed on
20 November 2026. Current Wagtail baseline screenshots and prototype evaluation
remain pending.

Start with the [visual comparison report](comparison.md): TinyMCE 8.10.2 and
CKEditor 5 49.1.0, with 17 screenshots of table interactions, observed keyboard
behavior, and proposed experiments. The [capture index](screenshots/README.md)
records source pages, versions, dates, and the setup used for the screenshots.

## Background and original idea

The [original report](history/original-table-editor-report.pdf) explores a gap
between convenient text-table editing and control over semantic table structure.
Its requirements include row, column, and individual cell headers, horizontal and
vertical merging, and text alignment. A Wagtail proof of concept exposed another
problem: adding per-cell settings can make the interface crowded and disrupt
ordinary table entry and pasting.

The report investigated both grid components and rich-text editors. It concluded
that a table-focused TinyMCE integration was the best fit among the options it
examined. This is a historical conclusion, not our current implementation choice
or a current assessment of those products. See the
[historical summary and screenshots](history/README.md) for page references.

Today, `wagtail-table` has a native Tiptap/ProseMirror text-table alpha. We want
to reuse its editing and table manipulation, integrate it with Wagtail StreamField,
and keep custom code small. The next question is how to make the controls clear,
compact, and comfortable for ordinary editing tasks. Hybrid Wagtail block cells
remain a later step, after the text-table UX has been refined.

The PDF's creation metadata is dated 17 July 2024; the original writing date and
author attribution are not established by that metadata. We do not assume that
ProseMirror or Tiptap first became available after the report.

## Questions to investigate

These are research questions, not approved design changes.

| Editing task | What we want to learn |
| --- | --- |
| Insert a table | How can editors choose the size, and what replaces insertion controls once a table exists? |
| Find and use actions | Which actions belong in a persistent toolbar, a nearby contextual control, or a properties panel? |
| Select and modify cells | Is the active cell/range clear, and does selection survive toolbar and menu interactions? |
| Add/remove rows and columns | How do editors discover where an operation applies, using either a pointer or keyboard? |
| Merge, split, and configure headers | Are the available actions and their effects understandable, especially around merged cells? |
| Align content | How should current cell, selected range, row, and column scope be expressed? |
| Paste and edit a large table | Can editors see, navigate, and modify the table comfortably within StreamField's available width? |
| Set caption and description | Can editors distinguish the two without keeping unnecessary controls in view? |

Reported baseline concerns include button alignment, control placement, and
limited editing width. Small refinements have since added persistent mutually
exclusive panels, compact fields, grouped cell actions, accurate header states,
and starter tables. The current demo still needs a documented visual baseline;
the product comparison is not a new integration test of our editor.

## Research approach and outputs

1. Capture the current Wagtail demo against the tasks above, including a small
   table, merged cells, and a wide table. Include keyboard workflows and focus.
2. Compare the same tasks in a small set of existing table editors. Record product
   version/date, source links, what was directly observed, and what comes only
   from documentation. Do not infer keyboard usability from screenshots.
3. Add a visual comparison report here, with selected screenshots beside the
   observations they support. Keep historical evidence separate from current
   captures. Attribute third-party screenshots and record capture dates.
4. Recommend a small set of interactions to prototype in the demo. Review the
   evidence and proposals before implementing a redesign. Context menus remain
   an option to assess, with discoverable keyboard-accessible alternatives.

Keep curated research and decisions in Git. Keep raw capture dumps, recordings,
browser traces, and temporary experiments outside the repository. Preserve the
original PDF unchanged; a full transcription is not required for this first pass.

Phase 5 in [PLAN.md](../../../PLAN.md) defines the implementation checkpoint.
No editor behavior or public package API changes are part of these research artifacts.
