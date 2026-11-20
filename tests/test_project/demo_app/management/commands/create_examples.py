from django.core.management.base import BaseCommand, CommandError
from wagtail.models import Site

from tests.test_project.demo_app.examples import example_tables
from tests.test_project.demo_app.models import DemoPage


class Command(BaseCommand):
    help = "Create a child page with table examples, keeping any existing edits."

    def handle(self, *args, **options):
        site = Site.objects.filter(is_default_site=True).first()
        if site is None:
            raise CommandError("Run create_content first to create the demo site.")
        if site.root_page.get_children().filter(slug="table-examples").exists():
            self.stdout.write("Example page already exists; keeping current edits.")
            return
        body = []
        for title, value in example_tables():
            body.extend([("paragraph", f"<h2>{title}</h2>"), ("table", value)])
        page = DemoPage(title="Table examples", slug="table-examples", body=body)
        site.root_page.add_child(instance=page)
        page.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("Created /table-examples/."))
