import json
from pathlib import Path

import pytest


@pytest.fixture
def table_value():
    return json.loads((Path(__file__).parent / "fixtures/basic.json").read_text())


@pytest.fixture(autouse=True)
def temporary_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
