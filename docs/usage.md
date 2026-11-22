# Installation and usage

The package requires Python 3.11+ and Wagtail 7.4–8.1 (`>=7.4,<8.2`). The current
development environment is the verification baseline; the broader compatibility
matrix remains deferred. See the [changelog](changelog.md) for release status.

## Install

```sh
uv pip install wagtail-table
```

Add `"wagtail_table"` to Django's `INSTALLED_APPS` and use the block in an ordinary
StreamField definition:

```python
from wagtail import blocks
from wagtail_table.blocks import TableBlock


class ContentBlock(blocks.StreamBlock):
    paragraph = blocks.RichTextBlock()
    table = TableBlock()
```

Use Django/Wagtail's normal staticfiles and `collectstatic` workflow. The Python
distribution includes built JavaScript and CSS; integrators do not run npm.
The editor initializes through Wagtail's widget integration without additional
JavaScript configuration.

Include the optional public alignment stylesheet in your frontend template if
you use the supplied alignment classes:

```django
{% load static %}
<link rel="stylesheet" href="{% static 'wagtail_table/table-public.css' %}">
```

Render the containing StreamField with Wagtail's normal `{% include_block %}`
workflow. The table renderer understands the supported JSON vocabulary; it does
not trust stored HTML. See [HTML support](research/table-editor-ux/html-table-support.md)
for generated headers, spans, descriptions, and limitations.

## Native text tables

New blocks start with a 3×3 table. Row, Column, and Cell menus expose native table
operations, header settings, merge/split, and selected-cell alignment. Caption
and Summary are separate fields. Summary becomes an accessible description,
not the obsolete HTML `summary` attribute.

Empty tables may be saved in drafts. Required blocks must contain a valid table
when publishing. One TableBlock stores one table; surrounding rich-text content
is not part of its document.

Read [clipboard behaviour](clipboard.md) before relying on particular paste,
merged-cell, or range-selection behaviour.

## Experimental Wagtail block cells

These capabilities are unreleased. Use the current development checkout to
evaluate them, not the published alpha package.

A direct block displays its native field without StreamBlock sequence controls:

```python
text_table = TableBlock(cell_block=blocks.CharBlock())
rich_table = TableBlock(
    cell_block=blocks.RichTextBlock(features=["bold", "italic", "link"])
)
```

Use a native StreamBlock when editors need a choice of types:

```python
from wagtail.images.blocks import ImageBlock

cell_content = blocks.StreamBlock(
    [
        ("rich_text", blocks.RichTextBlock(features=["bold", "italic", "link"])),
        ("image", ImageBlock()),
    ],
    max_num=1,
)
choice_table = TableBlock(cell_block=cell_content)
```

Omit `max_num=1` to allow multiple items, subject to the StreamBlock's configured
constraints. A one-item StreamBlock still has its choice and sequence interface;
it is different from a direct RichTextBlock.

Cells initially contain native text. Select cells and choose **Cell → Use Wagtail
block** to activate the configured field or sequence. **Use text** switches back.
Changing populated cells requires confirmation before their content is cleared.

### Current hybrid limitations

- Merging across Wagtail block cells is disabled. Splitting retains the original
  content in one cell and creates text cells around it.
- Tabular paste is blocked while block cells exist. Table selections containing
  them cannot be copied or cut through the outer table editor; native widget
  clipboard operations remain separate.
- Table/text undo and embedded rich-text undo are separate histories.
- Cell-specific Wagtail comment anchoring is disabled without stable cell paths.
- Inline sequence controls can overflow narrow columns. Pointer-driven node
  selection can also suppress nested caret/selection styling. The
  [hybrid interaction study](research/table-editor-ux/hybrid-interactions.md)
  records these issues and the proposed experiments.

These limitations remain relevant even where the demo's native fields work well.
Use the comparison pages and local browser tests before adopting experimental
hybrid cells in a production project.
