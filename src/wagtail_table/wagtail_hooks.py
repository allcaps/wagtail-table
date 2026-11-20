from wagtail import hooks


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
