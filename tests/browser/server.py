"""Run the browser-test demo against an isolated, disposable database."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tests.test_project.settings")

if __name__ == "__main__":
    with TemporaryDirectory(prefix="wagtail-table-browser-") as directory:
        os.environ["WAGTAIL_TABLE_DB"] = str(Path(directory) / "db.sqlite3")
        import django

        django.setup()
        from django.contrib.auth import get_user_model
        from django.core.management import call_command

        call_command("migrate", verbosity=0)
        call_command("create_content")
        get_user_model().objects.create_superuser(
            username="editor",
            email="editor@example.com",
            password="table-test-password",  # noqa: S106 -- disposable local test account
        )
        call_command("runserver", "127.0.0.1:8009", use_reloader=False)
