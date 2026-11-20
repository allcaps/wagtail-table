from django.core.management.base import BaseCommand
from wagtail.models import Page, Site

from tests.test_project.demo_app.models import DemoPage


class Command(BaseCommand):
    help = "Create a table demo page without overwriting existing edits."

    def handle(self, *args, **options):
        if DemoPage.objects.exists():
            self.stdout.write("Demo content already exists; keeping current edits.")
            return
        table = {
            "version": 1,
            "table": {
                "type": "table",
                "content": [],
            },
            "caption": "",
            "description": "",
        }
        for index, values in enumerate(
            [("Item", "Quantity"), ("Apples", "4"), ("Pears", "7")]
        ):
            row = {"type": "tableRow", "content": []}
            for text in values:
                row["content"].append(
                    {
                        "type": "tableHeader" if index == 0 else "tableCell",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": text}],
                            }
                        ],
                    }
                )
            table["table"]["content"].append(row)
        page = DemoPage(title="Table demo", slug="table-demo", body=[("table", table)])
        Page.get_first_root_node().add_child(instance=page)
        site = Site.objects.filter(is_default_site=True).first()
        if site:
            site.root_page = page
            site.save(update_fields=["root_page"])
        else:
            Site.objects.create(
                hostname="localhost", root_page=page, is_default_site=True
            )
        page.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("Created the table demo homepage."))
