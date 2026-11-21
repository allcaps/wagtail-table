from django.core.management.base import BaseCommand, CommandError
from wagtail.models import Site

from tests.test_project.demo_app.examples import (
    accessibility_example_body,
    example_tables,
    hybrid_example_body,
)
from tests.test_project.demo_app.models import DemoPage


class Command(BaseCommand):
    help = "Create table and accessibility example pages, keeping existing edits."

    def handle(self, *args, **options):
        site = Site.objects.filter(is_default_site=True).first()
        if site is None:
            raise CommandError("Run create_content first to create the demo site.")
        body = []
        for title, value in example_tables():
            body.extend([("paragraph", f"<h2>{title}</h2>"), ("table", value)])
        for title, slug, content in [
            ("Table examples", "table-examples", body),
            (
                "Table accessibility examples",
                "table-accessibility",
                accessibility_example_body(),
            ),
            ("Hybrid table examples", "table-hybrid", hybrid_example_body()),
        ]:
            if site.root_page.get_children().filter(slug=slug).exists():
                self.stdout.write(f"/{slug}/ already exists; keeping current edits.")
                continue
            page = DemoPage(title=title, slug=slug, body=content)
            site.root_page.add_child(instance=page)
            page.save_revision().publish()
            self.stdout.write(self.style.SUCCESS(f"Created /{slug}/."))
