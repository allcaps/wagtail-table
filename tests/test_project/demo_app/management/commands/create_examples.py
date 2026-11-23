from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from PIL import Image
from wagtail.images import get_image_model
from wagtail.models import Site

from tests.test_project.demo_app.comparison import (
    cell_content_example_body,
    comparison_example_body,
)
from tests.test_project.demo_app.examples import (
    accessibility_example_body,
    example_tables,
    hybrid_example_body,
)
from tests.test_project.demo_app.models import DemoPage


class Command(BaseCommand):
    help = "Create table, accessibility, and comparison pages, keeping existing edits."

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

        self.create_comparison_pages(site.root_page)

    def create_comparison_pages(self, root_page):
        slug = "table-cell-content-comparison"
        if root_page.get_children().filter(slug=slug).exists():
            self.stdout.write(f"/{slug}/ already exists; keeping current edits.")
        else:
            page = DemoPage(
                title="Cell content comparison",
                slug=slug,
                body=cell_content_example_body(),
            )
            root_page.add_child(instance=page)
            page.save_revision().publish()
            self.stdout.write(self.style.SUCCESS(f"Created /{slug}/."))
        slug = "table-editor-comparison"
        if root_page.get_children().filter(slug=slug).exists():
            self.stdout.write(f"/{slug}/ already exists; keeping current edits.")
            return
        image_model = get_image_model()
        image = image_model.objects.filter(title="Table comparison sample").first()
        if image is None:
            image_file = BytesIO()
            Image.new("RGB", (160, 100), "#147d80").save(image_file, format="PNG")
            image = image_model.objects.create(
                title="Table comparison sample",
                file=ContentFile(image_file.getvalue(), name="table-comparison.png"),
            )
        page = DemoPage(
            title="Table editor comparison",
            slug=slug,
            body=comparison_example_body(image.pk),
        )
        root_page.add_child(instance=page)
        page.save_revision().publish()
        self.stdout.write(self.style.SUCCESS(f"Created /{slug}/."))
