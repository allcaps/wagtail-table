from wagtail import blocks
from wagtail.admin.panels import FieldPanel
from wagtail.contrib.table_block.blocks import TableBlock as WagtailTableBlock
from wagtail.contrib.typed_table_block.blocks import TypedTableBlock
from wagtail.fields import StreamField
from wagtail.models import Page

from wagtail_table.blocks import TableBlock

from .cell_blocks import HybridCellBlock, ResearchCellBlock


class DemoPage(Page):
    body = StreamField(
        [
            ("paragraph", blocks.RichTextBlock()),
            ("table", TableBlock()),
            ("hybrid_table", TableBlock(cell_block=HybridCellBlock())),
            ("legacy_table", WagtailTableBlock(label="Wagtail TableBlock")),
            (
                "typed_table",
                TypedTableBlock(
                    [
                        *ResearchCellBlock().child_blocks.items(),
                        ("one_block", ResearchCellBlock(max_num=1)),
                        ("blocks", ResearchCellBlock()),
                    ],
                    label="Wagtail TypedTableBlock",
                ),
            ),
            (
                "char_cell_table",
                TableBlock(cell_block=blocks.CharBlock(), label="Direct text cells"),
            ),
            (
                "richtext_cell_table",
                TableBlock(
                    cell_block=blocks.RichTextBlock(
                        features=["bold", "italic", "link"]
                    ),
                    label="Direct rich text cells",
                ),
            ),
            (
                "single_choice_table",
                TableBlock(
                    cell_block=ResearchCellBlock(max_num=1),
                    label="One-item choice cells",
                ),
            ),
            (
                "research_hybrid_table",
                TableBlock(
                    cell_block=ResearchCellBlock(), label="Research hybrid table"
                ),
            ),
        ],
        blank=True,
    )

    content_panels = Page.content_panels + [FieldPanel("body")]
