"""Build the counterpoint manual and its evidence index.

The source is a deliberately small Markdown subset with explicit heading IDs:
  ## 标题 {#anchor}
Evidence placeholders use:
  [[claim:claim-id]]
"""

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "复调音乐理论体系.md"
TARGET = ROOT / "docs" / "复调音乐手册.html"
SOURCES = ROOT / "evidence" / "sources.json"
BOOKS = ROOT / "corpus" / "books.json"
GROUP_NAMES = {
    "history": "历史与语法",
    "species": "五类对位",
    "invertible": "单对位与复对位",
    "canon": "卡农",
    "fugue": "赋格",
    "modern": "现代对位",
}


def load_data():
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    catalog = json.loads(BOOKS.read_text(encoding="utf-8"))
    return sources, catalog, {book["id"]: book for book in catalog["books"]}


def inline(text, claims, books):
    value = html.escape(text, quote=False)
    value = re.sub(
        r"`([^`]+)`",
        lambda m: "<code>" + m.group(1) + "</code>",
        value,
    )
    value = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: '<a href="' + html.escape(m.group(2), quote=True) + '">' + m.group(1) + "</a>",
        value,
    )
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)

    def claim_link(match):
        claim_id = match.group(1)
        claim = claims.get(claim_id)
        if not claim or not claim["citations"]:
            return '<span class="missing-cite">[缺少证据：' + html.escape(claim_id) + "]</span>"
        links = []
        for citation in claim["citations"]:
            book = books[citation["bookId"]]
            href = "books/%s.html#claim-%s" % (book["id"], claim_id)
            label = "《%s》PDF p.%s" % (book["title"], citation["pdfPage"])
            title = citation.get("quote", "")
            links.append('<a class="cite" href="%s" title="%s">%s</a>' % (
                html.escape(href, quote=True),
                html.escape(title, quote=True),
                html.escape(label),
            ))
        return '<span class="cite-group">%s</span>' % '<span class="cite-sep"> · </span>'.join(links)

    return re.sub(r"\[\[claim:([a-z0-9.\-]+)\]\]", claim_link, value)


def split_table_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [cell.strip() for cell in line.split("|")]


def is_separator(line):
    cells = split_table_row(line)
    return bool(cells) and all(re.match(r"^:?-{3,}:?$", cell) for cell in cells)


def render_table(lines, claims, books):
    headers = split_table_row(lines[0])
    aligns = []
    for cell in split_table_row(lines[1]):
        left = cell.startswith(":")
        right = cell.endswith(":")
        aligns.append("center" if left and right else "right" if right else "left")
    rows = []
    for line in lines[2:]:
        rows.append(split_table_row(line))
    output = ['<div class="table-wrap"><table>', "<thead><tr>"]
    for index, cell in enumerate(headers):
        align = aligns[index] if index < len(aligns) else "left"
        output.append('<th style="text-align:%s">%s</th>' % (align, inline(cell, claims, books)))
    output.append("</tr></thead><tbody>")
    for row in rows:
        output.append("<tr>")
        for index, cell in enumerate(row):
            align = aligns[index] if index < len(aligns) else "left"
            output.append('<td style="text-align:%s">%s</td>' % (align, inline(cell, claims, books)))
        output.append("</tr>")
    output.append("</tbody></table></div>")
    return "".join(output)


def evidence_index(claims, books):
    parts = [
        '<div class="note"><strong>读法：</strong>每条论点先列手册锚点，再列教材、PDF 物理页、章节与原文摘录。扫描页中的谱例、临时记号和连线以影像为准；OCR 仅用于检索。</div>',
        '<div class="table-wrap"><table class="evidence-table"><thead><tr>'
        '<th>组</th><th>论点</th><th>教材依据</th><th>原文摘录</th></tr></thead><tbody>',
    ]
    for claim in claims:
        cites = []
        for citation in claim["citations"]:
            book = books[citation["bookId"]]
            href = "books/%s.html#claim-%s" % (book["id"], claim["id"])
            page = "PDF p.%s" % citation["pdfPage"]
            if citation.get("printedPage"):
                page += " · 印页 %s" % citation["printedPage"]
            cites.append(
                '<div class="cite-entry"><a href="%s">《%s》%s</a><span>%s</span></div>'
                % (
                    html.escape(href, quote=True),
                    html.escape(book["title"]),
                    html.escape(page),
                    html.escape(citation.get("chapter", "")),
                )
            )
        quotes = "<br>".join(
            "<q>%s</q>" % html.escape(citation.get("quote", ""))
            for citation in claim["citations"]
        )
        parts.append(
            "<tr><td>%s</td><td><a href=\"#%s\">%s</a><code>%s</code></td><td>%s</td><td>%s</td></tr>"
            % (
                html.escape(GROUP_NAMES.get(claim["group"], claim["group"])),
                html.escape(claim["manualAnchor"], quote=True),
                html.escape(claim["title"]),
                html.escape(claim["id"]),
                "".join(cites),
                quotes,
            )
        )
    parts.append("</tbody></table></div>")
    return "".join(parts)


def book_catalog(catalog, cited_ids, cited_pages):
    parts = [
        '<div class="note"><strong>统计口径：</strong>源目录共 %s 个 PDF 文件，去重后 %s 本独立教材。%s'
        % (
            catalog["fileCount"],
            catalog["independentBookCount"],
            html.escape(catalog["duplicates"][0]["note"]) if catalog.get("duplicates") else "",
        )
        + "</div>",
        '<div class="table-wrap"><table><thead><tr><th>教材</th><th>作者</th><th>PDF 页数</th><th>本站用途</th></tr></thead><tbody>',
    ]
    for book in catalog["books"]:
        title = html.escape(book["title"])
        if book["id"] in cited_ids:
            title = '<a href="books/%s.html">%s</a>' % (book["id"], title)
        parts.append(
            "<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
            % (title, html.escape(book["author"]), book["pdfPages"], html.escape(book["role"]))
        )
    parts.append("</tbody></table></div>")
    parts.append(
        '<p class="fine">公开部署只包含手册实际引用的 %s 本教材、%s 个页面和对应短引文，不包含整本 PDF。'
        % (len(cited_ids), cited_pages)
    )
    return "".join(parts)


def parse_markdown(text, claims, books, catalog, cited_ids, cited_pages):
    lines = text.replace("\r\n", "\n").split("\n")
    output = []
    toc = []
    paragraph = []
    index = 0
    heading_count = 0

    def flush_paragraph():
        if paragraph:
            output.append("<p>" + inline(" ".join(paragraph), claims, books) + "</p>")
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            flush_paragraph()
            index += 1
            continue
        if stripped == "<!-- EVIDENCE_INDEX -->":
            flush_paragraph()
            output.append(evidence_index(list(claims.values()), books))
            index += 1
            continue
        if stripped == "<!-- BOOK_CATALOG -->":
            flush_paragraph()
            output.append(book_catalog(catalog, cited_ids, cited_pages))
            index += 1
            continue
        if stripped.startswith("```"):
            flush_paragraph()
            code = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code.append(lines[index])
                index += 1
            output.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            index += 1
            continue
        heading = re.match(r"^(#{1,4})\s+(.+?)(?:\s+\{#([A-Za-z0-9_\-]+)\})?$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            body = heading.group(2).strip()
            anchor = heading.group(3)
            if not anchor:
                heading_count += 1
                anchor = "section-" + str(heading_count)
            rendered = inline(body, claims, books)
            output.append('<h%d id="%s">%s</h%d>' % (level, html.escape(anchor, quote=True), rendered, level))
            if level in (2, 3) and anchor not in ("top", "refs"):
                toc.append((level, anchor, re.sub(r"`", "", body)))
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and is_separator(lines[index + 1]):
            flush_paragraph()
            table_lines = [line, lines[index + 1]]
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            output.append(render_table(table_lines, claims, books))
            continue
        if stripped.startswith(">"):
            flush_paragraph()
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip()[1:].strip())
                index += 1
            output.append("<blockquote>" + inline(" ".join(quote_lines), claims, books) + "</blockquote>")
            continue
        unordered = re.match(r"^[-*]\s+(.+)$", stripped)
        ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if unordered or ordered:
            flush_paragraph()
            tag = "ul" if unordered else "ol"
            items = []
            pattern = unordered or ordered
            while index < len(lines):
                current = lines[index].strip()
                match = re.match(r"^[-*]\s+(.+)$", current) if tag == "ul" else re.match(r"^\d+\.\s+(.+)$", current)
                if not match:
                    break
                items.append(inline(match.group(1), claims, books))
                index += 1
            output.append("<%s>%s</%s>" % (tag, "".join("<li>" + item + "</li>" for item in items), tag))
            continue
        if stripped in ("---", "***"):
            flush_paragraph()
            output.append("<hr>")
            index += 1
            continue
        paragraph.append(stripped)
        index += 1
    flush_paragraph()
    return "\n".join(output), toc


def build_html(body, toc, sources, catalog):
    nav = []
    for level, anchor, label in toc:
        nav.append('<a class="toc-l%d" href="#%s">%s</a>' % (level, html.escape(anchor, quote=True), html.escape(label)))
    generated = sources["generatedAt"]
    template = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>复调音乐理论手册 · Counterpoint Atlas</title>
<meta name="description" content="按历史阶段组织复调理论：严格对位、自由对位与赋格、复调化、现代对位；每条论点可回到教材页锚点。">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='8'%20fill='%23eeb15b'/%3E%3Ctext%20x='16'%20y='23'%20text-anchor='middle'%20font-size='20'%20font-family='serif'%20fill='%2320170c'%3EC%3C/text%3E%3C/svg%3E">
<style>
:root{--bg:#0b1118;--panel:#111a25;--panel2:#162333;--paper:#f7f3ea;--ink:#1d2927;--muted:#9aabba;--line:#293a4c;--ink-line:#d8cfbf;--gold:#eeb15b;--teal:#62cfc2;--violet:#b8a6ff;--max:1020px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 12% -8%,#283137 0,transparent 31%),var(--bg);color:#e9eff6;font:16px/1.82 "Noto Serif SC","Source Han Serif SC","Songti SC",serif}
a{color:var(--gold);text-decoration:none}a:hover{text-decoration:underline}.layout{display:grid;grid-template-columns:270px minmax(0,var(--max));gap:32px;justify-content:center;max-width:1450px;margin:0 auto;padding:24px}
aside{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;padding:17px;border:1px solid var(--line);border-radius:16px;background:rgba(17,26,37,.9);backdrop-filter:blur(12px);font:12px/1.45 "Segoe UI","Microsoft YaHei",sans-serif}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:12px}.mark{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,#f3c577,#9a6b32);color:#21170c;font-weight:800}.brand b{line-height:1.25}.brand small{display:block;color:var(--muted);font-size:9px;margin-top:2px;letter-spacing:.05em}
nav{display:flex;flex-direction:column;gap:1px}.toc-l2,.toc-l3{display:block;padding:4px 6px;border-radius:5px;color:#a6b4c3}.toc-l3{padding-left:17px;font-size:11px;color:#899aab}.toc-l2:hover,.toc-l3:hover{background:var(--panel2);color:#fff;text-decoration:none}
.side-links{display:flex;flex-wrap:wrap;gap:5px;margin-top:13px;padding-top:12px;border-top:1px solid var(--line)}.side-links a{padding:5px 7px;border:1px solid var(--line);border-radius:5px;color:var(--teal);font-size:10px}
main{min-width:0;padding:42px 54px 84px;border:1px solid rgba(41,58,76,.75);border-radius:20px;background:rgba(13,20,29,.72);box-shadow:0 30px 90px rgba(0,0,0,.3)}
h1,h2,h3,h4{font-family:"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.38}h1{margin:0 0 9px;font-size:34px;letter-spacing:-.035em;background:linear-gradient(120deg,#fff,#f0c67e);-webkit-background-clip:text;background-clip:text;color:transparent}h2{margin:52px 0 15px;padding-top:18px;border-top:1px solid var(--line);font-size:24px;letter-spacing:-.02em}h3{margin:30px 0 9px;color:#f0d2a1;font-size:18px}h4{margin:22px 0 7px;color:var(--teal);font-size:14px}
p{margin:10px 0}ul,ol{padding-left:25px}li{margin:5px 0}.lead{color:#b8c5d2;font-size:16px}.fine{color:var(--muted);font-size:12px}
blockquote{margin:16px 0;padding:11px 15px;border-left:3px solid var(--gold);background:rgba(238,177,91,.07);color:#c9d1d9}code{padding:1px 5px;border:1px solid #2a3b4d;border-radius:4px;background:#080e15;color:#f1cc93;font:.86em/1.4 "Cascadia Code",Consolas,monospace}
pre{overflow:auto;padding:14px;border:1px solid var(--line);border-radius:9px;background:#070c12}pre code{border:0;background:none;padding:0}
.table-wrap{overflow:auto;margin:15px 0;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;min-width:610px;font:12.5px/1.55 "Segoe UI","Microsoft YaHei",sans-serif}th,td{padding:8px 10px;border-right:1px solid rgba(41,58,76,.55);border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{position:sticky;top:0;background:#192636;color:#f2d6a8}tr:last-child td{border-bottom:0}td:last-child,th:last-child{border-right:0}tbody tr:nth-child(even){background:rgba(255,255,255,.018)}
.cite{display:inline-block;margin:0 2px;color:var(--teal);border-bottom:1px solid rgba(98,207,194,.32);font:.86em/1.4 "Segoe UI","Microsoft YaHei",sans-serif}.cite:hover{border-color:var(--teal);text-decoration:none}.missing-cite{color:#f08585;font-size:11px}
.evidence-table td:first-child{white-space:nowrap;color:#9fb0c1}.evidence-table td:nth-child(2){min-width:220px}.evidence-table code{display:block;margin-top:4px;color:#8497aa;background:none;border:0;padding:0;font-size:9px}.cite-entry{margin:3px 0;font-size:11px}.cite-entry a{display:block}.cite-entry span{display:block;color:#8495a7;font-size:10px}
.note{padding:11px 14px;border:1px solid rgba(98,207,194,.22);border-radius:8px;background:rgba(98,207,194,.08);font-size:12px;line-height:1.7;color:#b8c7d4}
hr{border:0;border-top:1px solid var(--line);margin:30px 0}
@media(max-width:920px){.layout{display:block;padding:10px}aside{position:relative;top:0;max-height:40vh;margin-bottom:10px}.toc-l2,.toc-l3{display:inline-block;margin:2px}.toc-l3{padding-left:6px}main{padding:25px 18px 60px;border-radius:13px}h1{font-size:27px}h2{font-size:21px;margin-top:40px}h3{font-size:17px}}
@media(max-width:520px){main{padding:22px 13px 48px}.table-wrap{margin-left:-4px;margin-right:-4px}body{font-size:15px}.lead{font-size:14px}}
@media print{aside{display:none}.layout{display:block;max-width:none;padding:0}main{padding:0;border:0;box-shadow:none;background:#fff;color:#111}h1,h2,h3,h4{color:#111;-webkit-text-fill-color:#111}.note{color:#111}.table-wrap{overflow:visible}table{min-width:0;font-size:9pt}.cite-entry span{color:#555}}
</style>
<link rel="stylesheet" href="../../manual-visuals/manual-visuals.css">
</head>
<body data-manual="counterpoint">
<div class="layout">
<aside>
  <div class="brand"><span class="mark">C</span><b>复调音乐理论手册<small>Counterpoint Atlas · __GENERATED__</small></b></div>
  <nav aria-label="目录">__NAV__</nav>
  <div class="side-links"><a href="../tutorial/index.html">教程</a><a href="../app/index.html">推演台</a><a href="books/">教材证据</a><a href="../../index.html">工作台</a></div>
</aside>
<main>
__BODY__
</main>
</div>
<script src="../../manual-visuals/manual-visuals.js"></script>
</body>
</html>
"""
    return (template
        .replace("__GENERATED__", html.escape(generated))
        .replace("__NAV__", "".join(nav))
        .replace("__BODY__", body))


def main():
    sources, catalog, books = load_data()
    claims = {claim["id"]: claim for claim in sources["claims"]}
    cited_ids = {book["id"] for book in catalog["books"] if any(book["id"] == citation["bookId"] for claim in sources["claims"] for citation in claim["citations"])}
    cited_pages = len({(citation["bookId"], citation["pdfPage"]) for claim in sources["claims"] for citation in claim["citations"]})
    body, toc = parse_markdown(SOURCE.read_text(encoding="utf-8"), claims, books, catalog, cited_ids, cited_pages)
    anchors = set(re.findall(r'id="([A-Za-z0-9_\-]+)"', body))
    missing = sorted({claim["manualAnchor"] for claim in sources["claims"]} - anchors)
    if missing:
        raise SystemExit("Missing manual anchors: " + ", ".join(missing))
    TARGET.write_text(build_html(body, toc, sources, catalog), encoding="utf-8")
    print("manual:", TARGET)
    print("claims:", len(claims), "anchors:", len(anchors), "toc:", len(toc))


if __name__ == "__main__":
    main()
