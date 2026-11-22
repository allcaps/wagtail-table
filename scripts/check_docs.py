"""Check local links and assets in the generated book without network requests."""

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links = []
        self.ids = set()
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])


def broken_target(root, page, link, documents):
    url = urlsplit(link)
    if url.scheme or url.netloc:
        return False
    if url.path.startswith("/"):
        target = root / unquote(url.path).lstrip("/")
    else:
        target = page.parent / unquote(url.path) if url.path else page
    target = target.resolve()
    if target.is_dir():
        target /= "index.html"
    if not target.is_relative_to(root) or not target.is_file():
        return True
    document = documents.get(target)
    return bool(document and url.fragment and unquote(url.fragment) not in document.ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    root = parser.parse_args().directory.resolve()
    documents = {page: Document(page) for page in root.rglob("*.html")}
    if not documents:
        parser.exit(1, f"No HTML pages found in {root}\n")
    failures = [
        f"{page.relative_to(root)}: {link}"
        for page, document in documents.items()
        for link in document.links
        if broken_target(root, page, link, documents)
    ]
    if failures:
        parser.exit(1, "Broken documentation links:\n" + "\n".join(failures) + "\n")
    print(f"Checked local links, fragments, and assets in {len(documents)} HTML pages.")


if __name__ == "__main__":
    main()
