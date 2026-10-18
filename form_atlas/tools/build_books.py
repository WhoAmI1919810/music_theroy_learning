#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render only cited form-theory textbook pages and build the evidence archive."""
import argparse
import datetime
import html
import json
import os
import re
import sys

import fitz
from PIL import Image


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
BOOKS_DIR = os.path.join(DOCS, "books")
ASSETS_DIR = os.path.join(DOCS, "assets", "books")
BOOKS_JSON = os.path.join(ROOT, "corpus", "books.json")
EVIDENCE = os.path.join(ROOT, "evidence")
SOURCE_MAP = os.path.join(EVIDENCE, "source-map.json")
CASES_JSON = os.path.join(EVIDENCE, "cases.json")
OCR_DIR = os.path.join(ROOT, "corpus", "ocr")
ARCHIVE_JSON = os.path.join(EVIDENCE, "book-archives.json")
DEFAULT_SOURCE = r"E:\音乐学习笔记\曲式"

MAX_WIDTH = 1800
JPEG_QUALITY = 82


def read_json(path):
    with open(path, encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def write_json(path, payload):
    write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def page_tag(page):
    return "p%04d" % int(page)


def ref_anchor(claim_id, page):
    slug = re.sub(r"[^0-9A-Za-z_-]+", "-", str(claim_id)).strip("-").lower()
    return "ref-%s-p%04d" % (slug, int(page))


def case_anchor(case_id, page):
    slug = re.sub(r"[^0-9A-Za-z_-]+", "-", str(case_id)).strip("-").lower()
    return "case-ref-%s-p%04d" % (slug, int(page))


def load_ocr(book_id):
    path = os.path.join(OCR_DIR, book_id + ".jsonl")
    if not os.path.exists(path):
        raise RuntimeError("missing OCR cache: " + path)
    rows = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            rows[int(row["page"])] = row
    return rows


def collect_references(books, claims, cases):
    refs = {book["id"]: {} for book in books}
    for claim in claims:
        for source in claim.get("books", []):
            pages = refs[source["book"]]
            pages.setdefault(int(source["page"]), []).append({
                "kind": "claim",
                "id": claim["id"],
                "label": claim.get("short") or claim["topic"],
                "anchor": ref_anchor(claim["id"], source["page"]),
            })
    for item in cases:
        for source in item.get("sources", []):
            pages = refs[source["book"]]
            pages.setdefault(int(source["page"]), []).append({
                "kind": "case",
                "id": item["id"],
                "label": "%s《%s》" % (item["composer"], item["title"]),
                "anchor": case_anchor(item["id"], source["page"]),
            })
    return refs


def render_page(doc, page_no, target, force=False):
    if os.path.exists(target) and not force:
        return os.path.getsize(target)
    page = doc[page_no - 1]
    scale = 2.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
    width, height = pix.width, pix.height
    image = Image.frombytes("RGB", (width, height), pix.samples)
    if image.width > MAX_WIDTH:
        ratio = MAX_WIDTH / float(image.width)
        image = image.resize((MAX_WIDTH, max(1, int(image.height * ratio))), Image.LANCZOS)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    image.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return os.path.getsize(target)


BOOK_CSS = r'''
:root{--book-bg:var(--theme-bg);--paper:var(--theme-surface);--ink:var(--theme-text);--muted:var(--theme-muted);--line:var(--theme-line);--accent:var(--theme-gold)}
*{box-sizing:border-box}html{scroll-padding-top:64px}body{margin:0;background:var(--book-bg);color:var(--ink);font:16px/1.75 "Noto Serif SC","Source Han Serif SC","Songti SC",Georgia,serif}
a{color:var(--theme-teal);text-decoration:none}a:hover{text-decoration:underline}
.book-wrap{width:min(calc(100% - 32px),1120px);margin:0 auto;padding:24px 0 50px}.book-head{padding:22px 0 20px;border-bottom:2px solid var(--line)}.book-head h1{margin:0;font-size:clamp(25px,4vw,38px);line-height:1.3;letter-spacing:-.025em}.book-head .meta{margin-top:8px;color:var(--muted);font:12px/1.6 ui-sans-serif,"Microsoft YaHei",sans-serif}.book-head p{max-width:830px;margin:12px 0 0;color:var(--theme-soft);font-size:14px}.head-links{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}.head-links a{padding:5px 9px;border:1px solid var(--line);border-radius:7px;background:var(--theme-surface-2);font:11px ui-sans-serif,sans-serif}
.page-index{display:flex;flex-wrap:wrap;gap:5px;margin:15px 0 0}.page-index a{padding:4px 7px;border:1px solid var(--line);border-radius:6px;background:var(--theme-surface-2);font:10px ui-monospace,monospace;color:var(--theme-soft)}
.book-page{margin:24px 0 0;padding:22px;border:1px solid var(--line);border-radius:14px;background:var(--paper);box-shadow:var(--theme-shadow);scroll-margin-top:calc(var(--music-site-nav-height,46px) + 14px)}.page-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 12px}.page-title h2{margin:0;font-size:18px}.page-title span{color:var(--muted);font:10px ui-monospace,monospace}.page-image{display:block;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px}.page-image img{display:block;width:100%;height:auto;border-radius:4px}.page-image:hover{border-color:var(--accent)}
.ocr{margin-top:12px;border:1px solid var(--line);border-radius:8px;background:var(--theme-surface-2);padding:10px 13px}.ocr summary{cursor:pointer;color:var(--muted);font:11px ui-sans-serif,sans-serif}.ocr pre{margin:10px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--theme-soft);font:12px/1.7 ui-sans-serif,"Microsoft YaHei",sans-serif}
.refs{margin:13px 0 0;padding:11px 14px;border-left:3px solid var(--accent);border-radius:0 8px 8px 0;background:var(--theme-gold-soft);font:12px/1.6 ui-sans-serif,"Microsoft YaHei",sans-serif}.refs b{display:block;margin-bottom:5px;color:var(--accent)}.refs ul{margin:0;padding-left:18px}.refs li{margin:4px 0;scroll-margin-top:calc(var(--music-site-nav-height,46px) + 14px)}.refs li:target{background:var(--theme-gold-soft);outline:1px solid var(--accent);border-radius:4px;padding:3px 5px;margin-left:-5px}.refs .kind{display:inline-block;margin-right:5px;padding:0 5px;border-radius:999px;background:var(--theme-surface);color:var(--muted);font-size:9px;text-transform:uppercase}
.book-index{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:20px}.book-card{padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--paper)}.book-card h2{margin:0;font-size:19px}.book-card .meta{margin-top:4px;color:var(--muted);font-size:10px;font-family:ui-monospace,monospace}.book-card p{color:var(--theme-soft);font-size:12px}.book-card a{font-size:11px}
.note{margin:18px 0;padding:12px 14px;border:1px solid var(--line);border-radius:9px;background:var(--theme-surface-2);color:var(--muted);font:12px/1.65 ui-sans-serif,sans-serif}
@media(max-width:720px){.book-wrap{width:calc(100% - 18px);padding-top:12px}.book-page{padding:12px;border-radius:10px;margin-top:16px}.book-index{grid-template-columns:1fr}.page-title{display:block}.page-title span{display:block;margin-top:3px}.refs{padding:9px 10px}.ocr{padding:8px 10px}}
@media print{.head-links,.page-index,.ocr{display:none}.book-wrap{width:auto;padding:0}.book-page{border:0;box-shadow:none;padding:0;break-after:page}.page-image{border:0;padding:0}}
'''

THEME_INIT = '''<script data-site-theme-init>(function(){var d=document.documentElement;var t='light';try{var s=localStorage.getItem('music-site-theme');if(s==='dark'||s==='light')t=s;}catch(e){}d.setAttribute('data-theme',t);d.style.colorScheme=t;var p=location.pathname;var section='home';if(p.indexOf('/form_atlas/docs/books/')>=0)section='form-books';else if(p.indexOf('/form_atlas/docs/')>=0)section='form-manual';else if(p.indexOf('/form_atlas/app/')>=0)section='form-app';else if(p.indexOf('/harmony_atlas/docs/books/')>=0)section='harmony-books';else if(p.indexOf('/harmony_atlas/docs/')>=0)section='harmony-manual';else if(p.indexOf('/harmony_atlas/app/')>=0)section='harmony-app';else if(p.indexOf('/counterpoint_atlas/docs/books/')>=0)section='counterpoint-books';else if(p.indexOf('/counterpoint_atlas/docs/')>=0)section='counterpoint-manual';else if(p.indexOf('/counterpoint_atlas/tutorial/')>=0)section='counterpoint-tutorial';else if(p.indexOf('/counterpoint_atlas/app/')>=0)section='counterpoint-app';else if(p.indexOf('/orchestration_atlas/docs/books/')>=0)section='orchestration-books';else if(p.indexOf('/orchestration_atlas/docs/')>=0)section='orchestration-manual';else if(p.indexOf('/orchestration_atlas/app/')>=0)section='orchestration-app';d.setAttribute('data-site-section',section);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0b1119':'#f5efe4');})();</script>'''


def page_html(book, page, refs, ocr_row):
    image_rel = "../assets/books/%s/%s.jpg" % (book["id"], page_tag(page))
    ocr_lines = [line.get("text", "") for line in (ocr_row or {}).get("lines", []) if line.get("text")]
    ocr_text = "\n".join(ocr_lines) or (ocr_row or {}).get("text", "")
    ref_items = []
    if refs:
        for ref in refs:
            kind_label = "论点" if ref["kind"] == "claim" else "案例"
            manual_target = ref["id"] if ref["kind"] == "claim" else "case-" + ref["id"]
            ref_items.append(
                '<li id="%s"><span class="kind">%s</span><a href="../曲式学手册.html#%s">%s</a></li>' % (
                    html.escape(ref["anchor"]), kind_label, html.escape(manual_target), html.escape(ref["label"])
                )
            )
    ref_block = ''
    if ref_items:
        ref_block = '<div class="refs"><b>本页在理论手册中的引用</b><ul>%s</ul></div>' % "".join(ref_items)
    return '''<section class="book-page" id="%s">
  <div class="page-title"><h2>PDF p.%d</h2><span>%s</span></div>
  <a class="page-image" href="%s" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="%s" alt="%s PDF 第 %d 页"></a>
  %s
  <details class="ocr"><summary>OCR 检索文本（仅辅助检索，谱例以影印为准）</summary><pre>%s</pre></details>
</section>''' % (
        page_tag(page), page, html.escape(book["short"]), image_rel, image_rel,
        html.escape(book["title"]), page, ref_block, html.escape(ocr_text)
    )


def book_page(book, pages, refs, ocr, source_files):
    title = html.escape(book["title"])
    page_links = "".join('<a href="#%s">p.%d</a>' % (page_tag(page), page) for page in pages)
    sections = "".join(page_html(book, page, refs.get(page, []), ocr.get(page)) for page in pages)
    source_name = html.escape(os.path.basename(source_files.get(book["id"], book["file"])))
    return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0b1119"><title>%s · 教材页</title>%s
<link rel="stylesheet" href="../../../site-theme.css" data-site-theme-css><link rel="stylesheet" href="books.css"></head>
<body><a class="skip" href="#main">跳到主要内容</a><main id="main" class="book-wrap">
<header class="book-head"><h1>%s</h1><div class="meta">%s · 原书 %d 页 · 公开引用 %d 页</div><p>%s</p>
<div class="head-links"><a href="../曲式学手册.html">← 曲式学手册</a><a href="../../app/">曲式理论地图</a><a href="index.html">全部教材依据</a></div>
<nav class="page-index" aria-label="引用页索引">%s</nav></header>
<div class="note">页码为 PDF 物理页。以下仅收录理论手册与案例实际引用的页面；页图保留整版，OCR 文本用于检索，不能替代读谱。</div>
%s
</main><script src="../../../site-nav.js" data-site-nav></script></body></html>''' % (
        title, THEME_INIT, title, html.escape(source_name), book["pages"], len(pages), html.escape(book["role"]), page_links, sections
    )


def index_page(books, plans, total_pages):
    cards = []
    for book in books:
        if not plans.get(book["id"]):
            continue
        cards.append('''<article class="book-card"><h2>%s</h2><div class="meta">%s · 引用 %d 页 · 原书 %d 页</div><p>%s</p><a href="%s.html">查看引用页影印 →</a></article>''' % (
            html.escape(book["title"]), html.escape(book["short"]), len(plans[book["id"]]), book["pages"], html.escape(book["role"]), book["id"]
        ))
    return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0b1119"><title>曲式教材依据 · Form Atlas</title>%s
<link rel="stylesheet" href="../../../site-theme.css" data-site-theme-css><link rel="stylesheet" href="books.css"></head>
<body><a class="skip" href="#main">跳到主要内容</a><main id="main" class="book-wrap"><header class="book-head"><h1>曲式教材依据</h1>
<div class="meta">%d 本教材 · %d 个公开引用页</div><p>同一理论在多种教材中出现时，理论手册会并列引用所有对应页。这里按教材反向索引，便于从教材页回看它支持的论点或案例。</p>
<div class="head-links"><a href="../曲式学手册.html">← 曲式学手册</a><a href="../../app/">曲式理论地图</a></div></header>
<div class="book-index">%s</div></main><script src="../../../site-nav.js" data-site-nav></script></body></html>''' % (
        THEME_INIT, len([book for book in books if plans.get(book["id"])]), total_pages, "".join(cards)
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    books = read_json(BOOKS_JSON)["books"]
    claims = read_json(SOURCE_MAP)["claims"]
    cases = read_json(CASES_JSON)["cases"]
    refs = collect_references(books, claims, cases)
    os.makedirs(BOOKS_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    write_text(os.path.join(BOOKS_DIR, "books.css"), BOOK_CSS)
    plans = {}
    archives = []
    source_files = {}
    total_pages = 0
    for book in books:
        pages = sorted(refs.get(book["id"], {}))
        if not pages:
            continue
        source = os.path.join(args.source_dir, book["file"])
        if not os.path.exists(source):
            raise RuntimeError("missing source PDF: " + source)
        source_files[book["id"]] = source
        ocr = load_ocr(book["id"])
        missing = [page for page in pages if page not in ocr]
        for page in missing:
            ocr[page] = {"page": page, "text": "", "lines": []}
        doc = fitz.open(source)
        if len(doc) != int(book["pages"]):
            raise RuntimeError("%s page count %d != metadata %d" % (book["id"], len(doc), book["pages"]))
        sizes = []
        for page in pages:
            target = os.path.join(ASSETS_DIR, book["id"], page_tag(page) + ".jpg")
            size = render_page(doc, page, target, force=args.force)
            sizes.append(size)
        doc.close()
        plans[book["id"]] = pages
        total_pages += len(pages)
        write_text(os.path.join(BOOKS_DIR, book["id"] + ".html"), book_page(book, pages, refs[book["id"]], ocr, source_files))
        archives.append({
            "id": book["id"], "title": book["title"], "pages": book["pages"],
            "citedPages": pages, "imageCount": len(pages), "imageBytes": sum(sizes),
            "ocrPages": len(pages) - len(missing),
        })
        print("%s: %d cited pages" % (book["id"], len(pages)), flush=True)
    write_text(os.path.join(BOOKS_DIR, "index.html"), index_page(books, plans, total_pages))
    write_json(ARCHIVE_JSON, {
        "version": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "settings": {"maxWidth": MAX_WIDTH, "jpegQuality": JPEG_QUALITY},
        "totals": {"books": len(archives), "citedPages": total_pages, "images": total_pages},
        "books": archives,
    })
    print("built %d books, %d cited pages" % (len(archives), total_pages))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("build_books failed:", exc, file=sys.stderr)
        raise
