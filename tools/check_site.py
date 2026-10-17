#!/usr/bin/env python3
"""Check shared navigation coverage, local links and fragment targets."""

import html
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".git", "_work", "node_modules"}
HTML_FILES = [
    path
    for path in ROOT.rglob("*.html")
    if path.is_file() and not any(part in SKIP_PARTS for part in path.parts)
]


def target_file(page, href):
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    # The orchestration app exposes PDFs through an in-app virtual route.
    if parsed.path.startswith("/pdf/"):
        return None
    path = unquote(parsed.path)
    candidate = (page.parent / path).resolve()
    if path.endswith("/"):
        candidate = candidate / "index.html"
    if candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate


def ids_in(path):
    data = path.read_text(encoding="utf-8")
    return {html.unescape(value) for value in re.findall(r'\bid="([^"]+)"', data)}


def main():
    failures = []
    id_cache = {}
    for page in HTML_FILES:
        text = page.read_text(encoding="utf-8")
        if "data-site-nav" not in text:
            failures.append("missing shared nav: %s" % page.relative_to(ROOT))
        if "site-nav.js" not in text:
            failures.append("missing nav script: %s" % page.relative_to(ROOT))

        for href in re.findall(r'\b(?:href|src)="([^"#]+(?:#[^"]*)?)"', text):
            if href.startswith(("data:", "mailto:", "javascript:")):
                continue
            target = target_file(page, href)
            if target is None:
                continue
            if not target.is_file():
                failures.append("broken local target: %s -> %s" % (page.relative_to(ROOT), href))
                continue
            fragment = unquote(urlsplit(href).fragment)
            # Several apps render their section anchors from JavaScript after
            # load. Check the page itself, but do not treat those fragments as
            # static document IDs.
            dynamic_app = target.parent.name == "app"
            if fragment and target.suffix.lower() == ".html" and not dynamic_app:
                if target not in id_cache:
                    id_cache[target] = ids_in(target)
                if fragment not in id_cache[target]:
                    failures.append("missing fragment: %s -> %s" % (page.relative_to(ROOT), href))

    if failures:
        print("site check failed (%d):" % len(failures), file=sys.stderr)
        for failure in failures[:80]:
            print("  " + failure, file=sys.stderr)
        return 1
    print("site check ok: %d HTML pages, shared nav, local links and fragments" % len(HTML_FILES))
    return 0


if __name__ == "__main__":
    sys.exit(main())
