from wagtail import blocks
from wagtail.admin.panels import FieldPanel
from wagtail.fields import StreamField
from wagtail.models import Page

from wagtail_table.blocks import TableBlock

from .cell_blocks import HybridCellBlock


class DemoPage(Page):
    body = StreamField(
        [
            ("paragraph", blocks.RichTextBlock()),
            ("table", TableBlock()),
            ("hybrid_table", TableBlock(cell_block=HybridCellBlock())),
        ],
        blank=True,
    )

    content_panels = Page.content_panels + [FieldPanel("body")]
