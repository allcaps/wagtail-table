from wagtail import blocks
from wagtail.admin.panels import FieldPanel
from wagtail.fields import StreamField
from wagtail.models import Page

from wagtail_table.blocks import TableBlock


class DemoPage(Page):
    body = StreamField(
        [
            ("paragraph", blocks.RichTextBlock()),
            ("table", TableBlock()),
        ],
        blank=True,
    )

    content_panels = Page.content_panels + [FieldPanel("body")]
