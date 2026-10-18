#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the manual and page-level textbook archives from shared evidence data."""
import argparse
import html
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.environ.get('ORCHESTRATION_PDF_DIR', os.path.dirname(ROOT))
DOCS = os.path.join(ROOT, 'docs')
BOOKS_DIR = os.path.join(DOCS, 'books')
ASSETS_DIR = os.path.join(DOCS, 'assets', 'sources')
EVIDENCE = os.path.join(ROOT, 'evidence')
MANUAL_MD = os.path.join(DOCS, '配器法理论体系.md')
MANUAL_HTML = os.path.join(DOCS, '配器法手册.html')
OCR_DIR = os.path.join(ROOT, 'corpus', 'ocr')

for deps in (os.path.join(ROOT, '_work', 'pydeps'), r'H:\和声学\_work\pydeps'):
    if os.path.isdir(deps) and deps not in sys.path:
        sys.path.insert(0, deps)

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def load_json(name):
    with open(os.path.join(EVIDENCE, name), encoding='utf-8') as handle:
        return json.load(handle)


def midi_name(value):
    value = int(round(float(value)))
    return NOTE_NAMES[value % 12] + str(value // 12 - 1)


def note_range(values):
    return '%s–%s' % (midi_name(values[0]), midi_name(values[1]))


def dynamic_name(value):
    names = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
    value = max(1, min(8, int(round(float(value)))))
    return names[value - 1]


def archive_href(book_id, page, claim_id=None):
    anchor = 'cite-%s-p%04d' % (claim_id, int(page)) if claim_id else 'p%04d' % int(page)
    return 'books/%s.html#%s' % (book_id, anchor)


def pdf_href(book_id, page):
    return '/pdf/%s#page=%d' % (book_id, int(page))


def source_links(claim, separator=' · '):
    links = []
    for citation in claim.get('citations', []):
        book = BOOK_MAP[citation['book']]
        printed = citation.get('printedPage')
        suffix = '；印刷 p.%s' % printed if printed else ''
        label = '%s，PDF p.%s%s' % (book['short'], citation['pdfPage'], suffix)
        links.append('[%s](%s)' % (
            label, archive_href(citation['book'], citation['pdfPage'], claim['id'])))
    return separator.join(links)


def unique_citations(claims):
    seen = set()
    output = []
    for claim in claims:
        for citation in claim.get('citations', []):
            key = (claim['id'], citation['book'], int(citation['pdfPage']))
            if key not in seen:
                seen.add(key)
                output.append((claim, citation))
    return output


def expand_citation_tokens(markdown):
    pattern = re.compile(r'\[\[cite:([A-Za-z0-9_.-]+)\]\]')

    def replace(match):
        claim = CLAIM_MAP.get(match.group(1))
        if not claim:
            return '**缺少依据：%s**' % match.group(1)
        return source_links(claim, separator='  \n')

    return pattern.sub(replace, markdown)


def instruments_markdown():
    lines = [
        '| 乐器 | 实际音域 | 舒适音区 | 力度上限 | 融合/穿透 | 配器提示 |',
        '| --- | --- | --- | --- | --- | --- |'
    ]
    for item in INSTRUMENT_DATA['INSTRUMENTS']:
        if item['id'] == 'percussion':
            span = '无固定音高'
            comfort = '依乐器而定'
        else:
            span = note_range([item['midiLow'], item['midiHigh']])
            comfort = note_range(item['comfortable'])
        lines.append('| %s | %s | %s | %s | %d / %d | %s |' % (
            item['name'], span, comfort, dynamic_name(item['maxDynamic']),
            item['blend'], item['penetration'], item['note']))
    return '\n'.join(lines)


def mechanisms_markdown():
    lines = []
    for item in MECHANISM_DATA['MECHANISMS']:
        claims = [CLAIM_MAP[cid] for cid in item['claims'] if cid in CLAIM_MAP]
        citations = unique_citations(claims)
        lines.append('<a id="%s"></a>' % item['id'])
        lines.append('### %s｜%s' % (item['id'], item['title']))
        lines.append('')
        lines.append('> 依据类型：%s' % ('教材直接陈述' if item.get('evidence') == 'direct' else '教材定义与声学推论'))
        lines.append('')
        lines.append('- **原理**：%s' % item['principle'])
        lines.append('- **检查**：%s' % item['check'])
        lines.append('- **用法**：%s' % item['use'])
        lines.append('- **边界**：%s' % item['limit'])
        if citations:
            links = []
            for claim, citation in citations:
                book = BOOK_MAP[citation['book']]
                links.append('[%s PDF p.%s](%s)' % (
                    book['short'], citation['pdfPage'],
                    archive_href(citation['book'], citation['pdfPage'], claim['id'])))
            lines.append('- **教材**：' + ' · '.join(links))
        else:
            lines.append('- **教材**：待补关键页原文。')
        lines.append('')
    return '\n'.join(lines)


def books_markdown():
    lines = [
        '| 教材 | 本手册中的分工 | 已引用页数 | 页面入口 |',
        '| --- | --- | --- | --- |'
    ]
    for book in SOURCE_DATA['BOOKS']:
        pages = sorted({int(c['pdfPage']) for claim in SOURCE_DATA['CLAIMS'] for c in claim['citations'] if c['book'] == book['id']})
        page_text = '、'.join(str(page) for page in pages) if pages else '待补'
        lines.append('| %s | %s | %s | [逐页影印](books/%s.html) |' % (
            book['title'], book['role'], page_text, book['id']))
    return '\n'.join(lines)


def replace_auto_blocks(markdown):
    markdown = markdown.replace('<!-- AUTO:INSTRUMENTS -->', instruments_markdown())
    markdown = markdown.replace('<!-- AUTO:MECHANISMS -->', mechanisms_markdown())
    markdown = markdown.replace('<!-- AUTO:BOOKS -->', books_markdown())
    return markdown


def inline(text):
    code_store = []

    def stash_code(match):
        code_store.append(match.group(1))
        return '\x00CODE%d\x00' % (len(code_store) - 1)

    text = re.sub(r'`([^`]+)`', stash_code, text)
    text = html.escape(text, quote=False)
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img alt="\1" src="\2">', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    for index, value in enumerate(code_store):
        text = text.replace('\x00CODE%d\x00' % index, '<code>%s</code>' % html.escape(value))
    return text


def table_html(lines):
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        rows.append(cells)
    if len(rows) < 2:
        return ''
    header = rows[0]
    body = rows[2:]
    output = ['<div class="table-wrap"><table><thead><tr>']
    output.extend('<th>%s</th>' % inline(cell) for cell in header)
    output.append('</tr></thead><tbody>')
    for row in body:
        output.append('<tr>')
        output.extend('<td>%s</td>' % inline(cell) for cell in row)
        output.append('</tr>')
    output.append('</tbody></table></div>')
    return ''.join(output)


def markdown_to_html(markdown):
    lines = markdown.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    output = []
    paragraph = []
    list_items = []
    list_kind = None
    quote_lines = []
    table_lines = []
    section_index = 0
    toc = []

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            output.append('<p>%s</p>' % inline(' '.join(part.strip() for part in paragraph)))
            paragraph = []

    def flush_list():
        nonlocal list_items, list_kind
        if list_items:
            tag = list_kind or 'ul'
            output.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline(item) for item in list_items), tag))
            list_items = []
            list_kind = None

    def flush_quote():
        nonlocal quote_lines
        if quote_lines:
            output.append('<blockquote>%s</blockquote>' % inline(' '.join(quote_lines)))
            quote_lines = []

    def flush_table():
        nonlocal table_lines
        if table_lines:
            output.append(table_html(table_lines))
            table_lines = []

    def flush_all():
        flush_paragraph()
        flush_list()
        flush_quote()
        flush_table()

    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            flush_all()
            index += 1
            continue
        if stripped.startswith('<a id='):
            flush_all()
            output.append(stripped)
            index += 1
            continue
        heading = re.match(r'^(#{1,6})\s+(.+)$', stripped)
        if heading:
            flush_all()
            level = len(heading.group(1))
            body = inline(heading.group(2))
            if level == 2:
                section_index += 1
                anchor = 'section-%d' % section_index
                toc.append((anchor, heading.group(2)))
                output.append('<h2 id="%s">%s</h2>' % (anchor, body))
            elif level == 1:
                output.append('<h1>%s</h1>' % body)
            else:
                output.append('<h%d>%s</h%d>' % (level, body, level))
            index += 1
            continue
        if re.match(r'^---+$', stripped):
            flush_all()
            output.append('<hr>')
            index += 1
            continue
        if stripped.startswith('> '):
            flush_paragraph()
            flush_list()
            flush_table()
            quote_lines.append(stripped[2:])
            index += 1
            continue
        if stripped.startswith('|') and index + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{3,}', lines[index + 1]):
            flush_paragraph()
            flush_list()
            flush_quote()
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith('|'):
                table_lines.append(lines[index])
                index += 1
            flush_table()
            continue
        unordered = re.match(r'^-\s+(.+)$', stripped)
        ordered = re.match(r'^\d+[.)]\s+(.+)$', stripped)
        if unordered or ordered:
            flush_paragraph()
            flush_quote()
            flush_table()
            kind = 'ul' if unordered else 'ol'
            if list_kind and list_kind != kind:
                flush_list()
            list_kind = kind
            list_items.append((unordered or ordered).group(1))
            index += 1
            continue
        paragraph.append(line)
        index += 1
    flush_all()
    return ''.join(output), toc


MANUAL_CSS = r'''
:root{--bg:#ece7dc;--paper:#fffdf8;--ink:#172123;--muted:#66716d;--line:#d5cbbb;--accent:#bb5d2b;--teal:#2c6c68;--wash:#f5f0e6}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.8 "Noto Serif SC","Source Han Serif SC","Songti SC",serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.manual-layout{display:grid;grid-template-columns:250px minmax(0,900px);gap:26px;max-width:1240px;margin:0 auto;padding:28px}
.manual-nav{position:sticky;top:20px;align-self:start;max-height:calc(100vh - 40px);overflow:auto;background:transparent;border:0;border-right:1px solid var(--line);border-radius:0;padding:18px 18px 18px 0;font:12px/1.5 "Noto Sans SC","Microsoft YaHei",sans-serif}
.manual-nav b{display:block;font-size:16px;margin-bottom:5px}.manual-nav .meta{color:var(--muted);font-size:10px;margin-bottom:12px}.manual-nav a{display:block;padding:3px 5px;border-radius:5px;color:#4f5c58}.manual-nav a:hover{background:var(--wash);text-decoration:none}.manual-nav .app-link{margin-top:12px;padding:7px 9px;background:var(--accent);color:white;text-align:center;border-radius:7px}
main{min-width:0;background:transparent;border:0;border-radius:0;padding:44px 0 72px;box-shadow:none}
h1,h2,h3,h4{font-family:"Noto Sans SC","Source Han Sans SC","Microsoft YaHei",sans-serif;line-height:1.38}h1{margin:0 0 20px;font-size:34px;letter-spacing:-.02em}h2{font-size:25px;margin:48px 0 14px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:19px;margin:28px 0 10px;color:#304441}h4{font-size:15px;margin:20px 0 6px;color:var(--accent)}
p{margin:10px 0}.lead{font-size:18px;color:#465450}blockquote{margin:18px 0;padding:10px 0 10px 16px;border-left:3px solid var(--accent);background:transparent;color:#52605c;font-size:14px}
main img{display:block;max-width:100%;height:auto;margin:16px 0 6px;border:1px solid var(--line);border-radius:10px;background:white}
code{padding:1px 5px;border-radius:4px;background:#ece6da;font:13px ui-monospace,Consolas,monospace}hr{border:0;border-top:1px solid var(--line);margin:26px 0}
ul,ol{padding-left:24px}li{margin:5px 0}.table-wrap{overflow:auto;margin:16px 0}table{width:100%;border-collapse:collapse;font:12px/1.6 "Noto Sans SC","Microsoft YaHei",sans-serif}th,td{border-bottom:1px solid var(--line);padding:8px 9px;text-align:left;vertical-align:top}th{background:var(--wash);color:#4b3c2c;font-weight:700}tr:hover td{background:#fcfaf4}
.callout{border:0;border-top:1px solid var(--line);border-radius:0;padding:14px 0 0;background:transparent;margin:14px 0}.mechanism-anchor{scroll-margin-top:20px}
@media(max-width:860px){.manual-layout{display:block;padding:10px}.manual-nav{position:relative;top:0;max-height:none;margin-bottom:10px;padding:0 0 12px;border-right:0;border-bottom:1px solid var(--line)}main{padding:25px 0 50px;border-radius:0}h1{font-size:27px}h2{font-size:22px}.table-wrap{margin-left:-4px;margin-right:-4px}}
@media print{.manual-nav{display:none}.manual-layout{display:block;max-width:none;padding:0}main{border:0;box-shadow:none;padding:0}body{background:white}h2{page-break-after:avoid}a{color:#222}}
'''


def build_manual():
    with open(MANUAL_MD, encoding='utf-8') as handle:
        markdown = handle.read()
    markdown = replace_auto_blocks(markdown)
    markdown = expand_citation_tokens(markdown)
    body, toc = markdown_to_html(markdown)
    toc_html = ''.join('<a href="#%s">%s</a>' % (anchor, html.escape(title)) for anchor, title in toc)
    page = '''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>配器法理论体系与推演手册</title><style>%s</style><link rel="stylesheet" href="../../manual-visuals/manual-visuals.css"></head><body class="mtv-light" data-manual="orchestration">
<div class="manual-layout"><aside class="manual-nav"><b>配器法手册</b><div class="meta">7 册 / 4 部教材 · 关键页证据链 · 24 条机制</div>%s<a class="app-link" href="../app/index.html">打开配器推演台</a></aside>
<main>%s<footer class="callout"><b>使用提醒</b><br>教材页码一律为 PDF 物理页。点击页内依据链接可查看扫描图与 OCR；原 PDF 链接需要本地服务运行。程序推演不代替试奏。</footer></main></div>
<script src="../../manual-visuals/manual-visuals.js"></script></body></html>''' % (MANUAL_CSS, toc_html, body)
    with open(MANUAL_HTML, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(page)
    print('manual:', MANUAL_HTML)


ARCHIVE_CSS = r'''
:root{--bg:#ece7dc;--paper:#fffdf8;--ink:#172123;--muted:#66716d;--line:#d5cbbb;--accent:#bb5d2b;--wash:#f5f0e6}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 "Noto Serif SC","Source Han Serif SC","Songti SC",serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:230px minmax(0,980px);gap:24px;max-width:1280px;margin:0 auto;padding:24px}
aside{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;padding:17px;background:rgba(255,253,248,.94);border:1px solid var(--line);border-radius:14px;font:12px/1.55 "Noto Sans SC","Microsoft YaHei",sans-serif}
aside b{display:block;font-size:16px;margin-bottom:5px}aside .meta{color:var(--muted);font-size:10px;margin-bottom:12px}.jump{display:flex;flex-wrap:wrap;gap:4px}.jump a{padding:3px 6px;border-radius:5px;background:var(--wash);color:#52605c}.jump a:hover{background:#eadfcd;text-decoration:none}.back{display:block;margin-top:12px;padding:7px;border-radius:7px;background:var(--accent);color:white;text-align:center}
main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:36px 46px 66px;box-shadow:0 18px 50px rgba(58,45,28,.08)}
h1,h2{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;line-height:1.4}h1{margin:0 0 8px;font-size:29px}h2{font-size:18px;margin:0 0 10px;color:#4a3520}
.book-head{border-bottom:2px solid var(--line);padding-bottom:20px;margin-bottom:24px}.book-head p{margin:5px 0}.book-head .hint{color:var(--muted);font-size:12px}
.book-page{padding:24px 0 32px;border-bottom:1px solid var(--line);scroll-margin-top:18px}.page-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}.page-title h2{margin:0}.page-title span{color:var(--muted);font:11px ui-monospace,Consolas,monospace}
.page-image{display:block;margin-top:12px;background:white;border:1px solid #d9d4c9;border-radius:8px;padding:7px}.page-image img{display:block;width:100%;height:auto;border-radius:4px;background:white}.page-image:hover{border-color:var(--accent)}
.ocr-text{margin:12px 0 0;padding:12px 14px;background:var(--wash);border-left:3px solid #c6a679;color:#3d444b;font:12px/1.7 "Noto Sans SC","Microsoft YaHei",sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
.manual-refs{margin:12px 0 0;padding:12px 14px;background:#f8f1e3;border:1px solid #d8c6a6;border-radius:8px;font:12px/1.65 "Noto Sans SC","Microsoft YaHei",sans-serif}.manual-refs strong{display:block;margin-bottom:5px;color:#6f461d}.manual-refs ul{margin:0;padding-left:18px}.manual-refs li{margin:5px 0;padding:5px 7px;border-radius:5px;scroll-margin-top:16px}.manual-refs li:target{background:#ffe2b8;box-shadow:0 0 0 2px #bb5d2b}.manual-refs .quote{color:var(--muted);font-style:italic}
.index-table{width:100%;border-collapse:collapse;font:12px/1.55 "Noto Sans SC","Microsoft YaHei",sans-serif}.index-table th,.index-table td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.index-table th{background:var(--wash)}.index-note{color:var(--muted);font-size:12px}
@media(max-width:820px){.layout{display:block;padding:10px}aside{position:relative;top:0;max-height:none;margin-bottom:10px}main{padding:22px 14px 48px;border-radius:12px}h1{font-size:24px}.book-page{padding:18px 0 24px}}
@media print{aside{display:none}.layout{display:block;max-width:none;padding:0}main{border:0;box-shadow:none;padding:0}.book-page{border:0}.page-image{border:0;padding:0}.ocr-text{background:white}.back{display:none}body{background:white}}
'''


def load_ocr(book_id):
    path = os.path.join(OCR_DIR, book_id + '.jsonl')
    pages = {}
    if not os.path.exists(path):
        return pages
    try:
        with open(path, encoding='utf-8') as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get('type') == 'page':
                    pages[int(row['page'])] = row
    except Exception as error:
        print('WARN OCR', book_id, error)
    return pages


def ensure_page_image(book_id, page_number, doc):
    import fitz
    folder = os.path.join(ASSETS_DIR, book_id)
    os.makedirs(folder, exist_ok=True)
    target = os.path.join(folder, 'p%04d.jpg' % page_number)
    if os.path.exists(target) and os.path.getsize(target) > 2048:
        return target
    try:
        page = doc[page_number - 1]
        pix = page.get_pixmap(matrix=fitz.Matrix(1.45, 1.45), alpha=False)
        data = pix.tobytes('jpeg', jpg_quality=84)
        with open(target, 'wb') as handle:
            handle.write(data)
        print('rendered', book_id, 'p.%d' % page_number)
        return target
    except Exception as error:
        print('WARN image', book_id, page_number, repr(error))
        return None


def image_dimensions(path):
    try:
        from PIL import Image
        with Image.open(path) as image:
            return image.size
    except Exception:
        return None


def page_claims(book_id, page_number):
    output = []
    seen = set()
    for claim in SOURCE_DATA['CLAIMS']:
        for citation in claim.get('citations', []):
            if citation['book'] == book_id and int(citation['pdfPage']) == int(page_number):
                if claim['id'] not in seen:
                    seen.add(claim['id'])
                    output.append((claim, citation))
    return output


def build_book_archive(book, doc):
    citations = sorted({
        int(citation['pdfPage'])
        for claim in SOURCE_DATA['CLAIMS']
        for citation in claim.get('citations', [])
        if citation['book'] == book['id']
    })
    ocr = load_ocr(book['id'])
    page_sections = []
    for page_number in citations:
        image_path = ensure_page_image(book['id'], page_number, doc)
        records = page_claims(book['id'], page_number)
        claims = []
        mechanism_ids = []
        printed_values = []
        chapter_values = []
        for claim, citation in records:
            claims.append(claim)
            if citation.get('printedPage'):
                printed_values.append(str(citation['printedPage']))
            if citation.get('chapter') and citation['chapter'] not in chapter_values:
                chapter_values.append(citation['chapter'])
            for mechanism_id in claim.get('mechanisms', []):
                if mechanism_id not in mechanism_ids:
                    mechanism_ids.append(mechanism_id)
        printed_text = (' · 印刷 p.' + ' / '.join(sorted(set(printed_values)))) if printed_values else ''
        chapter_text = (' · ' + '；'.join(chapter_values)) if chapter_values else ''
        img_html = ''
        if image_path:
            rel = '../assets/sources/%s/p%04d.jpg' % (book['id'], page_number)
            size = image_dimensions(image_path)
            size_attr = ' width="%d" height="%d"' % size if size else ''
            img_html = '<a class="page-image" href="/pdf/%s#page=%d" target="_blank"><img loading="lazy" src="%s" alt="%s PDF p.%d"%s></a>' % (
                book['id'], page_number, rel, html.escape(book['title']), page_number, size_attr)
        ocr_text = ''
        if page_number in ocr and ocr[page_number].get('text'):
            ocr_text = '<div class="ocr-text">%s</div>' % html.escape(ocr[page_number]['text'])
        refs = []
        for claim in claims:
            quote = ''
            for citation in claim.get('citations', []):
                if citation['book'] == book['id'] and int(citation['pdfPage']) == page_number:
                    quote = '<div class="quote">“%s”</div>' % html.escape(citation.get('quote', ''))
                    break
            refs.append('<li id="cite-%s-p%04d"><b>%s</b><br>%s%s</li>' % (
                html.escape(claim['id']), page_number, html.escape(claim['id']), html.escape(claim['claim']), quote))
        mechanism_links = ''.join(
            '<a href="../配器法手册.html#%s">%s</a> ' % (mechanism_id, mechanism_id)
            for mechanism_id in mechanism_ids
        )
        manual_refs = ''
        if refs:
            manual_refs = '<div class="manual-refs"><strong>本手册使用本页</strong><ul>%s</ul>%s</div>' % (
                ''.join(refs), ('<div>回跳手册：' + mechanism_links + '</div>') if mechanism_links else '')
        page_sections.append('''<article class="book-page" id="p%04d"><div class="page-title"><h2>PDF 第 %d 页</h2><span>%s%s%s</span></div>%s%s%s</article>''' % (
            page_number, page_number, book['short'], printed_text, chapter_text, img_html, ocr_text, manual_refs))
    jumps = ''.join('<a href="#p%04d">p.%d</a>' % (page, page) for page in citations)
    page = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>%s · 教材原页</title><style>%s</style></head><body><div class="layout"><aside><b>%s</b><div class="meta">%d 个已引用页 · PDF 物理页码</div><div class="jump">%s</div><a class="back" href="../配器法手册.html#top">返回理论手册</a><a class="back" style="background:var(--teal)" href="../../app/index.html">返回推演台</a></aside><main><header class="book-head"><h1>%s</h1><p>%s</p><p class="hint">点击页面扫描图可打开原 PDF 对应页；原 PDF 链接需要本地服务运行。</p></header>%s</main></div></body></html>''' % (
        html.escape(book['title']), ARCHIVE_CSS, html.escape(book['short']), len(citations), jumps,
        html.escape(book['title']), html.escape(book['role']), ''.join(page_sections))
    target = os.path.join(BOOKS_DIR, book['id'] + '.html')
    with open(target, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(page)
    return len(citations)


def build_book_index(book_counts):
    rows = []
    for book in SOURCE_DATA['BOOKS']:
        rows.append('<tr><td><a href="%s.html">%s</a></td><td>%s</td><td>%d</td><td>%s</td></tr>' % (
            book['id'], html.escape(book['title']), html.escape(book['role']),
            book_counts.get(book['id'], 0), html.escape(str(book['pages']))))
    page = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>教材原页索引</title><style>%s</style><style>.layout{display:block;max-width:1040px;margin:0 auto;padding:24px}main{padding:32px 38px}.back{display:inline-block;margin-top:16px;padding:7px 12px;border-radius:7px;background:var(--accent);color:white}</style></head><body><div class="layout"><main><h1>教材原页索引</h1><p class="index-note">这里只收录本手册实际引用的页面。扫描图用于核对谱例、表格与印刷页码；OCR 文本用于检索。</p><table class="index-table"><thead><tr><th>教材</th><th>分工</th><th>已引用页</th><th>总页数</th></tr></thead><tbody>%s</tbody></table><a class="back" href="../配器法手册.html#top">返回理论手册</a></main></div></body></html>''' % (
        ARCHIVE_CSS, ''.join(rows))
    with open(os.path.join(BOOKS_DIR, 'index.html'), 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(page)


def build_book_archives():
    os.makedirs(BOOKS_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    try:
        import fitz
    except Exception as error:
        print('WARN PyMuPDF unavailable; archives will contain text only:', repr(error))
        fitz = None
    counts = {}
    for book in SOURCE_DATA['BOOKS']:
        doc = None
        if fitz is not None:
            path = os.path.join(SOURCE_DIR, book['file'])
            if os.path.exists(path):
                try:
                    doc = fitz.open(path)
                except Exception as error:
                    print('WARN open', book['id'], repr(error))
        try:
            counts[book['id']] = build_book_archive(book, doc)
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
    build_book_index(counts)
    print('archives:', ', '.join('%s=%d' % item for item in sorted(counts.items())))


SOURCE_DATA = load_json('source-map.json')
INSTRUMENT_DATA = load_json('instruments.json')
MECHANISM_DATA = load_json('mechanisms.json')
THEORY_DATA = load_json('theory.json')
BOOK_MAP = {book['id']: book for book in SOURCE_DATA['BOOKS']}
CLAIM_MAP = {claim['id']: claim for claim in SOURCE_DATA['CLAIMS']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', default='', help='directory containing the source PDFs')
    args = parser.parse_args()
    if args.source_dir:
        global SOURCE_DIR
        SOURCE_DIR = args.source_dir
    started = time.time()
    build_manual()
    build_book_archives()
    print('done in %.1fs' % (time.time() - started))


if __name__ == '__main__':
    main()
