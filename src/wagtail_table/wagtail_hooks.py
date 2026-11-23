from django.urls import path
from wagtail import hooks

from .views import quiet_cell


@hooks.register("register_admin_urls")
def register_table_urls():
    return [
        path("wagtail-table/quiet-cell/", quiet_cell, name="wagtail_table_quiet_cell")
    ]


@hooks.register("register_icons")
def register_table_icons(icons):
    return icons + [
        "wagtail_table/icons/align-left.svg",
        "wagtail_table/icons/align-center.svg",
        "wagtail_table/icons/align-right.svg",
        "wagtail_table/icons/align-top.svg",
        "wagtail_table/icons/align-middle.svg",
        "wagtail_table/icons/align-bottom.svg",
    ]
