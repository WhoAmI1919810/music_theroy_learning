#!/usr/bin/env python3
"""Search OCR page text while preserving exact PDF page numbers.

Examples:
  python tools/corpus_search.py "副属和弦" --book sangtong_tutorial --limit 8
  python tools/corpus_search.py "增六|拿波里" --book xu_advanced --regex
"""
import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_DIR = os.path.join(ROOT, "corpus", "text")


def split_pages(path):
    pages = []
    current = None
    buffer = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            match = re.match(r"^===== PDF PAGE (\d+) =====\s*$", line)
            if match:
                if current is not None:
                    pages.append((current, "".join(buffer)))
                current = int(match.group(1))
                buffer = []
            elif current is not None:
                buffer.append(line)
    if current is not None:
        pages.append((current, "".join(buffer)))
    return pages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--book", default="", help="book id substring")
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--context", type=int, default=180)
    parser.add_argument("--regex", action="store_true")
    parser.add_argument("--min-page", type=int, default=1)
    parser.add_argument("--max-page", type=int, default=100000)
    args = parser.parse_args()
    flags = re.I | (re.M if args.regex else 0)
    try:
        pattern = re.compile(args.query if args.regex else re.escape(args.query), flags)
    except re.error as exc:
        print("bad pattern:", exc)
        return 2
    hits = 0
    for path in sorted(glob.glob(os.path.join(TEXT_DIR, "*.txt"))):
        book_id = os.path.basename(path)[:-4]
        if args.book and args.book.lower() not in book_id.lower():
            continue
        for page, text in split_pages(path):
            if page < args.min_page or page > args.max_page:
                continue
            for match in pattern.finditer(text):
                start = max(0, match.start() - args.context)
                end = min(len(text), match.end() + args.context)
                snippet = re.sub(r"\s+", " ", text[start:end]).strip()
                print("[%s p.%d] %s" % (book_id, page, snippet))
                hits += 1
                if hits >= args.limit:
                    return 0
    if not hits:
        print("no match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
