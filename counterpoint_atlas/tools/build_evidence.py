#!/usr/bin/env python3
"""Build the public evidence pages from cited PDF pages and OCR."""

import html
import json
import os
import re
import shutil
import sys
from collections import defaultdict

sys.path.insert(0, r"H:\和声学\_work\pydeps")
import fitz


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PDF_ROOT = r"E:\音乐学习笔记\复调"
OCR_SOURCES = [
    r"E:\codex\_counterpoint_work\content_ocr.jsonl",
    r"E:\codex\_counterpoint_work\content_ocr_extra.jsonl",
]
ASSET_WIDTH = 1020
JPEG_QUALITY = 74


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_ocr():
    pages = {}
    for path in OCR_SOURCES:
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                pages[(row["book"], int(row["page"]))] = row
    return pages


def safe_name(text):
    return re.sub(r"[^\w\u4e00-\u9fff.-]+", "-", text).strip("-")


def page_id(page):
    return "p%04d" % page


def write_page_image(book, page, destination):
    pdf_path = os.path.join(PDF_ROOT, book["file"])
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(pdf_path)
    document = fitz.open(pdf_path)
    source = document[page - 1]
    zoom = min(2.0, max(0.8, ASSET_WIDTH / source.rect.width))
    pixmap = source.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY, alpha=False)
    data = pixmap.tobytes("jpeg", jpg_quality=JPEG_QUALITY)
    with open(destination, "wb") as handle:
        handle.write(data)
    document.close()
    return len(data), pixmap.width, pixmap.height


def html_head(title):
    return """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>__TITLE__</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='8'%20fill='%23eeb15b'/%3E%3Ctext%20x='16'%20y='23'%20text-anchor='middle'%20font-size='20'%20font-family='serif'%20fill='%2320170c'%3EC%3C/text%3E%3C/svg%3E">
<style>
:root{--paper:#f7f2e8;--ink:#17211f;--muted:#66706b;--line:#d8cfc0;--accent:#9b512b;--wash:#eee5d6}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e8e1d5;color:var(--ink);font:15px/1.7 "Noto Serif SC","Songti SC",serif}a{color:var(--accent)}
.layout{display:grid;grid-template-columns:250px minmax(0,980px);gap:24px;max-width:1300px;margin:0 auto;padding:24px}
aside{position:sticky;top:16px;align-self:start;max-height:calc(100vh - 32px);overflow:auto;background:rgba(247,242,232,.97);border:1px solid var(--line);border-radius:14px;padding:17px;font:12px/1.55 "Noto Sans SC","Microsoft YaHei",sans-serif}
aside b{display:block;font-size:16px;line-height:1.35}aside .meta{color:var(--muted);font-size:10px;margin:5px 0 12px}.jump{display:flex;flex-wrap:wrap;gap:4px}.jump a{padding:4px 7px;border-radius:5px;background:var(--wash);text-decoration:none}.back{display:block;margin-top:10px;padding:8px;border-radius:7px;background:var(--accent);color:white;text-align:center;text-decoration:none}.back.alt{background:#2c6b64}
main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:34px 44px 64px;box-shadow:0 18px 50px rgba(58,45,28,.08)}
h1,h2{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;line-height:1.4}h1{margin:0 0 6px;font-size:28px}h2{font-size:18px;margin:0}.book-head{border-bottom:2px solid var(--line);padding-bottom:18px;margin-bottom:22px}.book-head p{margin:4px 0;color:var(--muted);font-size:12px}.book-head .hint{color:#806c50}.book-page{padding:24px 0 34px;border-bottom:1px solid var(--line);scroll-margin-top:16px}.page-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}.page-title span{font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--muted)}.page-image{display:block;margin:12px 0;padding:7px;background:white;border:1px solid #d9d4c9;border-radius:8px}.page-image img{display:block;width:100%;height:auto;border-radius:4px}.ocr-text{margin:12px 0;padding:12px 14px;background:var(--wash);border-left:3px solid #c6a679;color:#3d444b;font:12px/1.7 "Noto Sans SC","Microsoft YaHei",sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;max-height:460px;overflow:auto}.claim-list{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:9px}.claim{padding:11px 13px;background:#fbf7ef;border:1px solid #dfd4c1;border-radius:8px;scroll-margin-top:16px}.claim:target{background:#ffe2b8;border-color:var(--accent);box-shadow:0 0 0 2px rgba(155,81,43,.18)}.claim b{display:block;font:600 13px/1.5 "Noto Sans SC","Microsoft YaHei",sans-serif}.claim p{margin:4px 0;color:#48504b;font-size:12px}.claim .quote{color:#6a5945;font-size:12px}.claim .links{font:11px/1.5 "Noto Sans SC","Microsoft YaHei",sans-serif;margin-top:5px}.claim .links a{display:inline-block;margin-right:10px}.index-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.book-card{padding:15px;border:1px solid var(--line);border-radius:10px;background:#fbf7ef}.book-card h3{margin:0 0 4px;font:600 15px/1.4 "Noto Sans SC","Microsoft YaHei",sans-serif}.book-card p{margin:0;color:var(--muted);font-size:12px}.book-card .pages{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.book-card .pages a{font:11px/1 ui-monospace,Consolas,monospace;background:var(--wash);padding:4px 6px;border-radius:4px;text-decoration:none}.catalog{width:100%;border-collapse:collapse;font:12px/1.55 "Noto Sans SC","Microsoft YaHei",sans-serif}.catalog th,.catalog td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.catalog th{background:var(--wash)}.note{padding:12px 14px;border:1px solid #d8c6a6;background:#f8f1e3;border-radius:8px;font:12px/1.65 "Noto Sans SC","Microsoft YaHei",sans-serif}
@media(max-width:820px){.layout{display:block;padding:10px}aside{position:relative;top:0;max-height:none;margin-bottom:10px}main{padding:22px 14px 48px;border-radius:12px}h1{font-size:23px}.index-grid{grid-template-columns:1fr}.book-page{padding:18px 0 26px}.ocr-text{max-height:340px}}
@media print{aside{display:none}.layout{display:block;max-width:none;padding:0}main{border:0;box-shadow:none;padding:0}.ocr-text{max-height:none}.page-image{border:0;padding:0}}
</style></head>""".replace("__TITLE__", html.escape(title))


def render_book(book, pages, claims_by_page, ocr, asset_root):
    book_dir = os.path.join(asset_root, book["id"])
    os.makedirs(book_dir, exist_ok=True)
    page_rows = []
    for page in pages:
        ocr_row = ocr.get((book["file"], page))
        if not ocr_row:
            raise RuntimeError("missing OCR for %s p%d" % (book["id"], page))
        image_name = "p%04d.jpg" % page
        image_path = os.path.join(book_dir, image_name)
        size, width, height = write_page_image(book, page, image_path)
        page_rows.append({"page": page, "ocr": ocr_row, "image": image_name, "bytes": size, "width": width, "height": height, "claims": claims_by_page[page]})

    jump = "".join('<a href="#%s">p.%d</a>' % (page_id(row["page"]), row["page"]) for row in page_rows)
    first_claim = min((claim["id"] for row in page_rows for claim in row["claims"]), default=None)
    articles = []
    for row in page_rows:
        label = "PDF 第 %d 页" % row["page"]
        chapter = row["claims"][0].get("chapter") or ""
        printed = next((claim.get("printedPage") for claim in row["claims"] if claim.get("printedPage")), None)
        if printed:
            label += " · 印刷页约 %s" % printed
        claims_html = []
        for claim in row["claims"]:
            quote = html.escape(claim.get("quote", ""))
            principle = html.escape(claim.get("principle", ""))
            claims_html.append(
                '<li class="claim" id="claim-%s"><b>%s</b><p>%s</p><div class="quote">“%s”</div>'
                '<div class="links"><a href="../复调音乐手册.html#%s">回手册：%s</a><a href="../books/%s.md">Markdown 源</a></div></li>'
                % (html.escape(claim["id"]), html.escape(claim["title"]), principle, quote,
                   html.escape(claim["manualAnchor"]), html.escape(claim["manualAnchor"]),
                   html.escape(book["id"]))
            )
        ocr_text = html.escape(row["ocr"].get("text", ""))
        articles.append(
            '<article class="book-page" id="%s"><div class="page-title"><h2>%s</h2><span>%s</span></div>'
            '<a class="page-image" href="#%s"><img loading="lazy" src="../assets/books/%s/%s" alt="%s PDF 第 %d 页" width="%d" height="%d"></a>'
            '<div class="ocr-text">%s</div><ul class="claim-list">%s</ul></article>'
            % (page_id(row["page"]), label, html.escape(chapter), page_id(row["page"]), html.escape(book["id"]),
               row["image"], html.escape(book["title"]), row["page"], row["width"], row["height"], ocr_text, "".join(claims_html))
        )

    title = "%s · 教材原页" % book["title"]
    body = html_head(title) + '<body><div class="layout"><aside><b>%s</b><div class="meta">%s · %d 个已引用页 · PDF 物理页码</div><div class="jump">%s</div><a class="back" href="../复调音乐手册.html#refs">返回理论手册</a><a class="back alt" href="../../app/index.html">返回推演台</a></aside><main><header class="book-head"><h1>%s</h1><p>%s</p><p class="hint">每页先给扫描原图，再给 OCR 与页面支持的论点。OCR 仅供检索，谱例、临时记号与连线以扫描图为准。</p></header>%s</main></div></body></html>' % (
        html.escape(book["title"]), html.escape(book.get("author", "")), len(page_rows), jump,
        html.escape(book["title"]), html.escape(book.get("role", "")), "".join(articles)
    )
    with open(os.path.join(ROOT, "docs", "books", book["id"] + ".html"), "w", encoding="utf-8") as handle:
        handle.write(body)

    md_lines = ["# %s · 教材原页" % book["title"], "", "%s · %d 个已引用页 · PDF 物理页码" % (book.get("author", ""), len(page_rows)), "", "> OCR 仅用于检索；谱例与临时记号以扫描图为准。", ""]
    for row in page_rows:
        md_lines += ["## PDF 第 %d 页" % row["page"], "", "![%s p.%d](../assets/books/%s/%s)" % (book["title"], row["page"], book["id"], row["image"]), "", "### OCR", "", "```text", row["ocr"].get("text", ""), "```", ""]
        for claim in row["claims"]:
            md_lines += ['<a id="claim-%s"></a>' % claim["id"], "### " + claim["title"], "", claim.get("principle", ""), "", "> “%s”" % claim.get("quote", ""), "", "[返回手册](../复调音乐手册.html#%s)" % claim["manualAnchor"], ""]
    with open(os.path.join(ROOT, "docs", "books", book["id"] + ".md"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(md_lines))
    return len(page_rows)


def build_index(books, cited_books, page_counts):
    cards = []
    for book in cited_books:
        pages = sorted({c["pdfPage"] for claim in page_counts[book["id"]]["claims"] for c in claim["citations"] if c["bookId"] == book["id"]})
        links = "".join('<a href="%s.html#%s">p.%d</a>' % (book["id"], page_id(page), page) for page in pages)
        cards.append('<article class="book-card"><h3>%s</h3><p>%s · %d 页</p><div class="pages">%s</div></article>' % (html.escape(book["title"]), html.escape(book.get("author", "")), len(pages), links))
    rows = []
    for book in books:
        used = page_counts.get(book["id"], {}).get("count", 0)
        link = book["id"] if used else ""
        title = '<a href="%s.html">%s</a>' % (link, html.escape(book["title"])) if used else html.escape(book["title"])
        rows.append("<tr><td>%s</td><td>%s</td><td>%d</td><td>%s</td></tr>" % (title, html.escape(book.get("author", "")), book["pdfPages"], "已引用 %d 页" % used if used else "已编目，未在手册中直接引用"))
    body = html_head("复调教材证据索引") + """<body><div class="layout"><aside><b>教材证据</b><div class="meta">18 本独立教材 · 19 个 PDF 文件</div><a class="back" href="../复调音乐手册.html#refs">返回理论手册</a><a class="back alt" href="../../app/index.html">返回推演台</a></aside><main><header class="book-head"><h1>复调教材证据索引</h1><p>手册引用链接落到具体 PDF 物理页与论点锚点。公开版只保留被引用页。</p></header><div class="note">新增文件 2 个：希格斯《赋格曲》为独立教材；姚世泽《巴赫赋格曲的研究》的第二个文件与已有文件 SHA-256 相同，去重后仍为 18 本独立教材。</div><section class="index-grid">%s</section><h2 style="margin-top:28px">全部编目</h2><div style="overflow:auto"><table class="catalog"><thead><tr><th>教材</th><th>作者</th><th>PDF 页数</th><th>本站使用</th></tr></thead><tbody>%s</tbody></table></div></main></div></body></html>""" % ("".join(cards), "".join(rows))
    with open(os.path.join(ROOT, "docs", "books", "index.html"), "w", encoding="utf-8") as handle:
        handle.write(body)


def main():
    books_doc = load_json(os.path.join(ROOT, "corpus", "books.json"))
    sources = load_json(os.path.join(ROOT, "evidence", "sources.json"))
    books = books_doc["books"]
    book_map = {book["id"]: book for book in books}
    ocr = load_ocr()

    citations_by_page = defaultdict(list)
    for claim in sources["claims"]:
        for citation in claim["citations"]:
            citation = dict(citation)
            citation["principle"] = claim["principle"]
            citations_by_page[(citation["bookId"], int(citation["pdfPage"]))].append({**claim, **citation})

    by_book = defaultdict(dict)
    for (book_id, page), claims in citations_by_page.items():
        by_book[book_id][page] = claims

    page_counts = {}
    for book_id, pages in by_book.items():
        book = book_map[book_id]
        count = render_book(book, sorted(pages), pages, ocr, os.path.join(ROOT, "docs", "assets", "books"))
        page_counts[book_id] = {"count": count, "claims": [claim for page in sorted(pages) for claim in pages[page]]}

    build_index(books, [book_map[book_id] for book_id in sorted(by_book, key=lambda item: book_map[item]["priority"])], page_counts)

    public = {
        "generatedAt": sources["generatedAt"],
        "pageConvention": "pdf",
        "independentBookCount": books_doc["independentBookCount"],
        "fileCount": books_doc["fileCount"],
        "duplicates": books_doc["duplicates"],
        "citedBooks": [
            {"id": book_id, "title": book_map[book_id]["title"], "html": "docs/books/%s.html" % book_id, "markdown": "docs/books/%s.md" % book_id, "pageCount": page_counts[book_id]["count"]}
            for book_id in sorted(by_book, key=lambda item: book_map[item]["priority"])
        ],
        "citedPageCount": sum(item["count"] for item in page_counts.values()),
        "claimCount": len(sources["claims"])
    }
    with open(os.path.join(ROOT, "evidence", "public-deploy.json"), "w", encoding="utf-8") as handle:
        json.dump(public, handle, ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "evidence", "source-map.json"), "w", encoding="utf-8") as handle:
        json.dump(sources, handle, ensure_ascii=False, indent=2)

    os.makedirs(os.path.join(ROOT, "corpus", "ocr"), exist_ok=True)
    with open(os.path.join(ROOT, "corpus", "ocr", "cited-pages.jsonl"), "w", encoding="utf-8", newline="\n") as out:
        for (book_id, page), claims in sorted(citations_by_page.items()):
            book = book_map[book_id]
            row = ocr.get((book["file"], page))
            if row:
                out.write(json.dumps({"bookId": book_id, "book": book["title"], "page": page, "text": row["text"], "conf": row.get("conf"), "claims": sorted({c["id"] for c in claims})}, ensure_ascii=False) + "\n")
    print("cited books:", len(by_book), "pages:", public["citedPageCount"], "claims:", public["claimCount"])


if __name__ == "__main__":
    main()
