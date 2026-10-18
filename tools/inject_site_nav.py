#!/usr/bin/env python3
"""Add the shared theme bootstrap, stylesheet and navigation to every HTML page."""

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYSTEMS = ("harmony_atlas", "orchestration_atlas", "counterpoint_atlas")
SKIP_PARTS = {"_work", "node_modules", ".git", "tests"}

THEME_BOOTSTRAP = """<script data-site-theme-init>(function(){var d=document.documentElement;var t='light';try{var s=localStorage.getItem('music-site-theme');if(s==='dark'||s==='light')t=s;}catch(e){}d.setAttribute('data-theme',t);d.style.colorScheme=t;var p=location.pathname;var section='home';if(p.indexOf('/harmony_atlas/docs/books/')>=0)section='harmony-books';else if(p.indexOf('/harmony_atlas/docs/')>=0)section='harmony-manual';else if(p.indexOf('/harmony_atlas/app/')>=0)section='harmony-app';else if(p.indexOf('/counterpoint_atlas/docs/books/')>=0)section='counterpoint-books';else if(p.indexOf('/counterpoint_atlas/docs/')>=0)section='counterpoint-manual';else if(p.indexOf('/counterpoint_atlas/tutorial/')>=0)section='counterpoint-tutorial';else if(p.indexOf('/counterpoint_atlas/app/')>=0)section='counterpoint-app';else if(p.indexOf('/orchestration_atlas/docs/books/')>=0)section='orchestration-books';else if(p.indexOf('/orchestration_atlas/docs/')>=0)section='orchestration-manual';else if(p.indexOf('/orchestration_atlas/app/')>=0)section='orchestration-app';d.setAttribute('data-site-section',section);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0b1119':'#f5efe4');})();</script>"""


def pages():
    yield ROOT / "index.html"
    for system in SYSTEMS:
        for path in (ROOT / system).rglob("*.html"):
            if not any(part in SKIP_PARTS for part in path.parts):
                yield path


def main():
    changed = 0
    for page in pages():
        if not page.exists():
            continue
        text = page.read_text(encoding="utf-8")
        original = text
        depth = len(page.relative_to(ROOT).parts) - 1
        prefix = "../" * depth
        src = prefix + "site-nav.js"
        if "data-site-nav" not in text:
            tag = '<script src="%s" data-site-nav></script>\n' % src
            if "</body>" not in text:
                raise SystemExit("missing </body>: " + str(page))
            text = text.replace("</body>", tag + "</body>", 1)

        text = re.sub(
            r'\n?<script[^>]*data-site-theme-init[^>]*>.*?</script>',
            "",
            text,
            flags=re.DOTALL,
        )
        text = re.sub(
            r'\n?<link[^>]*data-site-theme-css[^>]*>',
            "",
            text,
            flags=re.IGNORECASE,
        )
        theme_tags = (
            "\n" + THEME_BOOTSTRAP + "\n"
            + '<link rel="stylesheet" href="%ssite-theme.css" data-site-theme-css>\n' % prefix
        )
        if "</head>" not in text:
            raise SystemExit("missing </head>: " + str(page))
        text = text.replace("</head>", theme_tags + "</head>", 1)
        if text != original:
            page.write_text(text, encoding="utf-8")
            changed += 1
    print("site theme/nav injected: %d changed, %d total pages" % (changed, len(list(pages()))))


if __name__ == "__main__":
    main()
