from django.contrib.staticfiles import finders
from wagtail.admin.telepath import JSContext

from wagtail_table.blocks import TableBlock
from wagtail_table.widgets import TableInput


def test_widget_template_media_and_registration():
    widget = TableInput()
    html = widget.render("table", None, attrs={"id": "table-id"})
    assert "data-wagtail-table" in html
    assert 'name="table"' in html
    context = JSContext()
    packed = context.pack(widget)
    assert packed["_type"] == "wagtail_table.TableInput"
    assert "wagtail_table/table.js" in str(context.media)
    assert "wagtail_table/table.css" in str(context.media)


def test_static_assets_are_shipped():
    assert finders.find("wagtail_table/table.js")
    assert finders.find("wagtail_table/table.css")
    assert finders.find("wagtail_table/THIRD_PARTY_LICENSES.txt")


def test_multiple_widgets_have_independent_ids():
    widget = TableBlock().field.widget
    assert 'id="one"' in widget.render("one", None, attrs={"id": "one"})
    assert 'id="two"' in widget.render("two", None, attrs={"id": "two"})
