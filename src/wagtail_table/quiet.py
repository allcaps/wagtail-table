"""Passive representations of current block values for the table editor."""

import logging
from typing import ClassVar

from django.core import signing
from wagtail.whitelist import (
    DEFAULT_ELEMENT_RULES,
    Whitelister,
    allow_without_attributes,
    attribute_rule,
    check_url,
)

logger = logging.getLogger(__name__)
QUIET_SALT = "wagtail_table.quiet"


class QuietWhitelister(Whitelister):
    # Reuse Wagtail's escaping and URL handling, without site classes or links.
    element_rules: ClassVar[dict] = {
        **{key: rule for key, rule in DEFAULT_ELEMENT_RULES.items() if key != "a"},
        "dl": allow_without_attributes,
        "dt": allow_without_attributes,
        "dd": allow_without_attributes,
        "span": allow_without_attributes,
        "img": attribute_rule({"src": check_url, "alt": True}),
    }

    def clean_tag_node(self, doc, tag):
        if tag.name in {
            "script",
            "style",
            "iframe",
            "object",
            "embed",
            "form",
            "input",
            "textarea",
            "select",
            "button",
            "video",
            "audio",
            "svg",
            "math",
        }:
            tag.decompose()
            return
        super().clean_tag_node(doc, tag)


def quiet_html(block, value, request=None):
    if value is None:
        return ""
    try:
        return QuietWhitelister().clean(block.render(value, {"request": request}))
    except Exception:
        # A frontend template can require page context absent in this surface.
        # Its failure must never prevent editing or discard the underlying value.
        logger.exception("Unable to render a quiet table cell")
        return None


def quiet_definition(block):
    return signing.dumps(block.definition_prefix, salt=QUIET_SALT)
