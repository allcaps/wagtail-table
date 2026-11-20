"""Exercise the installed wheel with isolated Python, outside the source checkout."""

from pathlib import Path

import django
from django.conf import settings

settings.configure(
    SECRET_KEY="distribution-smoke-check",  # noqa: S106
    INSTALLED_APPS=[
        "wagtail_table",
        "wagtail.admin",
        "wagtail",
        "wagtail.users",
        "wagtail.images",
        "wagtail.documents",
        "wagtail.snippets",
        "wagtail.sites",
        "wagtail.search",
        "modelcluster",
        "taggit",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.sessions",
        "django.contrib.messages",
        "django.contrib.staticfiles",
    ],
    DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}},
    TEMPLATES=[
        {"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True}
    ],
    STATIC_URL="/static/",
    USE_TZ=True,
)
django.setup()

from django.contrib.staticfiles import finders
from wagtail.admin.icons import get_icons

import wagtail_table
from wagtail_table.blocks import TableBlock

if "site-packages" not in Path(wagtail_table.__file__).parts:
    raise RuntimeError("Smoke check imported the source checkout")

for asset in ("table.js", "table.css", "table-public.css", "THIRD_PARTY_LICENSES.txt"):
    found = finders.find(f"wagtail_table/{asset}")
    if not found or not Path(found).stat().st_size:
        raise RuntimeError(f"Missing installed static asset: {asset}")

sprite = get_icons()
for alignment in ("left", "center", "right", "top", "middle", "bottom"):
    if f'id="icon-wagtail-table-align-{alignment}"' not in sprite:
        raise RuntimeError(f"Missing installed alignment icon: {alignment}")

value = {
    "version": 1,
    "table": {
        "type": "table",
        "content": [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableCell",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": "<script>unsafe</script> & text",
                                    },
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    },
    "caption": "Installed <table>",
    "description": "A distribution check",
}
block = TableBlock()
html = block.render(block.clean(value))
if (
    not all(
        part in html
        for part in (
            "<table",
            "<tbody>",
            "<td",
            "&lt;script&gt;",
            "&amp; text",
            "<caption>Installed &lt;table&gt;</caption>",
            "aria-describedby=",
        )
    )
    or "<script>" in html
):
    raise RuntimeError("Installed templates did not render safe table HTML")
print(
    "Installed wheel: imports, static assets, icons, validation, and rendering passed"
)
