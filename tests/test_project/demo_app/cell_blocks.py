from wagtail import blocks
from wagtail.images.blocks import ImageBlock


class HybridCellBlock(blocks.StreamBlock):
    rich_text = blocks.RichTextBlock(features=["bold", "italic", "link"])
    image = ImageBlock()
    emoji = blocks.ChoiceBlock(
        choices=[
            ("✅", "✅ Yes"),
            ("ℹ️", "ℹ️ Information"),
            ("⭐", "⭐ Star"),
            ("🖼️", "🖼️ Picture"),
        ],
        icon="pick",
    )

    class Meta:
        label = "Cell content"
