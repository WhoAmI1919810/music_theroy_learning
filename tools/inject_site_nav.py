#!/usr/bin/env python3
"""Add the shared navigation script to every static HTML page."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYSTEMS = ("harmony_atlas", "orchestration_atlas", "counterpoint_atlas")
SKIP_PARTS = {"_work", "node_modules", ".git"}


def pages():
    yield ROOT / "index.html"
    for system in SYSTEMS:
        for path in (ROOT / system).rglob("*.html"):
            if not any(part in SKIP_PARTS for part in path.parts):
                yield path


def main():
    changed = 0
    skipped = 0
    for page in pages():
        if not page.exists():
            continue
        text = page.read_text(encoding="utf-8")
        if "data-site-nav" in text:
            skipped += 1
            continue
        depth = len(page.relative_to(ROOT).parts) - 1
        src = "../" * depth + "site-nav.js"
        tag = '<script src="%s" data-site-nav></script>\n' % src
        if "</body>" not in text:
            raise SystemExit("missing </body>: " + str(page))
        text = text.replace("</body>", tag + "</body>", 1)
        page.write_text(text, encoding="utf-8")
        changed += 1
    print("site nav injected: %d changed, %d already present" % (changed, skipped))


if __name__ == "__main__":
    main()
