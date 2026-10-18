#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build per-book Markdown facsimiles with OCR text and every PDF page image.

The archive favors completeness over aggressive figure cropping: each PDF page
is rendered as one image, so no score example, diagram, table, or marginal mark
can be lost. OCR text is included for search and copying but the page image is
authoritative for notation.
"""
import argparse
import concurrent.futures
import datetime
import html
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.dirname(ROOT)
BOOKS_JSON = os.path.join(ROOT, 'corpus', 'books.json')
INDEX_JSON = os.path.join(ROOT, 'corpus', 'index.json')
OCR_DIR = os.path.join(ROOT, 'corpus', 'ocr')
DOCS = os.path.join(ROOT, 'docs')
BOOKS_DIR = os.path.join(DOCS, 'books')
ASSETS_DIR = os.path.join(DOCS, 'assets', 'books')
ARCHIVE_JSON = os.path.join(ROOT, 'evidence', 'book-archives.json')
PUBLIC_DEPLOY = os.path.join(ROOT, 'evidence', 'public-deploy.json')
BOOK_ANNOTATIONS = os.path.join(ROOT, 'evidence', 'book-annotations.json')
MANUAL_HTML = os.path.join(DOCS, '和声学手册.html')

KIND_LABELS = {
    'claim': '论点',
    'example': '案例',
    'period': '阶段依据',
    'prose': '正文引用',
    'profile': '代表页',
}


def ref_anchor(kind, identifier, page):
    """Must match build_docs.ref_anchor."""
    slug = re.sub(r'[^0-9A-Za-z_-]+', '-', str(identifier)).strip('-').lower()
    return 'ref-%s-%s-p%04d' % (kind, slug, int(page))

MAX_SCALE = 2.0
MAX_WIDTH = 2000
MAX_HEIGHT = 3000
JPEG_QUALITY = 84
MIN_IMAGE_BYTES = 1024

BOOK_CSS = r'''
:root{--bg:#f1ede4;--paper:#fffdf8;--ink:#1c242d;--muted:#68727c;--line:#d7cdbd;--accent:#9b5b21;--wash:#f7f2e8}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 "Noto Serif SC","Source Han Serif SC","Songti SC",serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:230px minmax(0,980px);gap:28px;justify-content:center;max-width:1280px;margin:0 auto;padding:26px}
aside{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;padding:18px;background:rgba(255,253,248,.88);border:1px solid var(--line);border-radius:14px;font:13px/1.6 ui-sans-serif,"Microsoft YaHei",sans-serif}
aside b{display:block;font-size:16px;margin-bottom:10px}aside .meta{color:var(--muted);margin-bottom:12px}.jump{display:flex;flex-wrap:wrap;gap:4px}.jump a{padding:3px 6px;border-radius:5px;background:var(--wash)}.jump a:hover{background:#eadfcd;text-decoration:none}
main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:38px 50px 70px;box-shadow:0 18px 50px rgba(58,45,28,.08)}
h1,h2{font-family:"Noto Sans SC","Source Han Sans SC","Microsoft YaHei",sans-serif;line-height:1.35}h1{margin:0 0 12px;font-size:30px}h2{font-size:19px;margin:0 0 14px;color:#4a3520}
.book-head{border-bottom:2px solid var(--line);padding-bottom:24px;margin-bottom:28px}.book-head p{margin:8px 0}.book-head .hint{color:var(--muted)}
.book-page{padding:26px 0 34px;border-bottom:1px solid var(--line);break-inside:avoid;page-break-inside:avoid;scroll-margin-top:18px}.page-image{display:block;background:#fff;border:1px solid #d9d4c9;border-radius:8px;padding:8px}.page-image img{display:block;width:100%;height:auto;background:#fff;border-radius:4px}.page-image:hover{border-color:var(--accent)}
.ocr-text{margin:15px 0 0;padding:13px 16px;background:var(--wash);border-left:3px solid #c6a679;color:#3d444b;font:14px/1.75 "Noto Sans SC","Microsoft YaHei",sans-serif;overflow-wrap:anywhere}
.manual-refs{margin:14px 0 0;padding:12px 15px;background:#f8f1e3;border:1px solid #d8c6a6;border-radius:8px;font:13px/1.65 "Noto Sans SC","Microsoft YaHei",sans-serif;overflow-wrap:anywhere}.manual-refs strong{display:block;margin-bottom:5px;color:#6f461d}.manual-refs ul{margin:0;padding-left:20px}.manual-refs li{margin:6px 0}.manual-refs .ref-kind{display:inline-block;margin-right:5px;padding:0 5px;border-radius:999px;background:#e9d7b8;color:#704719;font-size:11px}.manual-refs .ref-text{color:var(--muted)}.back{display:inline-block;margin-top:20px;font:12px ui-sans-serif,sans-serif;color:var(--muted)}
.manual-refs li{scroll-margin-top:18px}.manual-refs li:target{background:#eadfcd;border-radius:5px;outline:1px solid #c6a679;padding:4px 5px;margin-left:-5px}
.index-table{width:100%;border-collapse:collapse;font:13px/1.55 ui-sans-serif,"Microsoft YaHei",sans-serif}.index-table th,.index-table td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.index-table th{background:var(--wash)}.index-table td:nth-child(3),.index-table td:nth-child(4){text-align:right}.index-note{color:var(--muted)}
@media(max-width:820px){.layout{display:block;padding:10px}aside{position:relative;top:0;max-height:none;margin-bottom:10px}main{padding:24px 16px 50px;border-radius:12px}h1{font-size:25px}.book-page{padding:20px 0 26px}}
@media print{aside{display:none}.layout{display:block;max-width:none;padding:0}main{border:0;box-shadow:none;padding:0}.book-page{border:0}.page-image{border:0;padding:0}.page-image img{max-height:245mm}.ocr-text{background:#fff;border-left:1px solid #999}body{background:#fff}}
'''


def read_json(path):
    with open(path, encoding='utf-8-sig') as handle:
        return json.load(handle)


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    os.replace(tmp, path)


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)
    os.replace(tmp, path)


def load_ocr(book_id):
    path = os.path.join(OCR_DIR, book_id + '.jsonl')
    if not os.path.exists(path):
        raise RuntimeError('missing OCR file: ' + path)
    pages = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get('type') != 'page':
                continue
            pages[int(row['page'])] = row
    return pages


def page_image_name(page):
    return 'p%04d.jpg' % page


def escape_alt(text):
    return text.replace('\\', '\\\\').replace(']', '\\]')


def ocr_html(row):
    text = (row or {}).get('text', '') or ''
    text = text.replace('\r\n', '\n').replace('\r', '\n').strip('\n')
    if not text.strip():
        return '<div class="ocr-text"><em>本页没有可识别的文字；请以整页影印图为准。</em></div>'
    lines = [html.escape(line.rstrip(), quote=False) for line in text.split('\n')]
    return '<div class="ocr-text">%s</div>' % '<br>\n'.join(lines)


def manual_ref_items(items):
    rendered = []
    for item in items or []:
        label = item.get('label') or item.get('id') or '手册条目'
        text = item.get('text') or ''
        text_html = html.escape(text).replace('\n', '<br>')
        kind = KIND_LABELS.get(item.get('kind'), item.get('kind') or '引用')
        id_attr = ''
        if item.get('anchor'):
            id_attr = ' id="%s"' % html.escape(item['anchor'], quote=True)
        rendered.append(
            '<li%s class="manual-ref-item" data-kind="%s"><span class="ref-kind">%s</span>'
            '<a href="%s">%s</a><br><span class="ref-text">%s</span></li>' % (
                id_attr,
                html.escape(item.get('kind') or '', quote=True),
                html.escape(kind),
                html.escape(item.get('href') or '', quote=True),
                html.escape(label),
                text_html,
            )
        )
    return rendered


def manual_refs_md(page, items):
    if not items:
        return ''
    return '\n'.join([
        '<!-- MANUAL-REFS:p%04d -->' % page,
        '<div class="manual-refs"><strong>手册使用本页</strong><ul>%s</ul></div>' % ''.join(
            manual_ref_items(items)
        ),
    ])


def manual_refs_html(page, items):
    if not items:
        return ''
    return '<div class="manual-refs" id="manual-refs-p%04d"><strong>手册使用本页</strong><ul>%s</ul></div>' % (
        page, ''.join(manual_ref_items(items))
    )


def page_links(pages):
    picks = sorted({int(page) for page in pages})
    return ' · '.join('[p.%d](#p%04d)' % (page, page) for page in picks)


def book_header(book, index_row, archive_pages, duplicate_of=None, canonical_title=None):
    title = book['title']
    lines = ['# ' + title, '']
    lines.append('> **PDF 文件**：`%s`  ' % book['file'])
    lines.append('> **物理页数**：%d（从 PDF 第 1 页起计）  ' % book['pages'])
    lines.append('> **OCR 平均置信度**：%s  ' % index_row.get('mean_conf', '—'))
    lines.append('> **字符数**：%s' % index_row.get('chars', '—'))
    if duplicate_of:
        lines.append('> **版本说明**：本文件是 `%s` 的重复扫描本；逐页影印图复用《%s》的页面图，文字按同一 OCR 页面生成。' % (
            book['file'], canonical_title or duplicate_of
        ))
    lines.extend([
        '',
        '本文件收录**理论手册实际引用的 %d 个 PDF 页**，每页采用整版影印 + OCR 文本。整页图保留谱例、图表、表格、边注和版面关系；OCR 只供检索与复制，具体音符、临时记号、连线和罗马数字以图像为准。被理论手册引用的条目列在图后，可直接回跳。' % len(archive_pages),
        '',
        '页码一律使用 **PDF 物理页码**，可能与书内印刷页码不同。',
        '',
        '**快速跳页**：' + page_links(archive_pages),
        '',
        '---',
        '',
    ])
    return '\n'.join(lines)


def page_section(book, page, image_rel, ocr_row, manual_refs=None):
    alt = escape_alt('%s PDF p.%d（整页影印）' % (book['title'], page))
    return '\n'.join([
        '<!-- PAGE:%d -->' % page,
        '<a id="p%04d"></a>' % page,
        '## PDF p.%d' % page,
        '',
        '![%s](%s)' % (alt, image_rel),
        '',
        manual_refs_md(page, manual_refs),
        '',
        ocr_html(ocr_row),
        '',
        '---',
        '',
    ])


def page_html(book, page, image_rel, ocr_row, image_size, manual_refs=None):
    alt = html.escape('%s PDF p.%d（整页影印）' % (book['title'], page), quote=True)
    image = html.escape(image_rel, quote=True)
    return '\n'.join([
        '<section class="book-page" id="p%04d">' % page,
        '<h2>PDF p.%d</h2>' % page,
        '<a class="page-image" href="%s" target="_blank" rel="noopener" title="打开原尺寸图"><img loading="lazy" decoding="async" width="%d" height="%d" src="%s" alt="%s"></a>' % (
            image, image_size[0], image_size[1], image, alt
        ),
        manual_refs_html(page, manual_refs),
        ocr_html(ocr_row),
        '</section>',
        '',
    ])


def book_html(book, index_row, ocr_pages, image_prefix, image_sizes,
              archive_pages, duplicate_of=None, canonical_title=None, page_annotations=None):
    jump = ' · '.join('<a href="#p%04d">p.%d</a>' % (page, page)
                       for page in archive_pages)
    title = html.escape(book['title'])
    source = html.escape(book['file'])
    duplicate = ''
    if duplicate_of:
        duplicate = '<p class="hint"><b>版本说明：</b>本文件是重复扫描本，页面图复用《%s》；文字按同一 OCR 页面生成。</p>' % html.escape(canonical_title or duplicate_of)
    body = '\n'.join(page_html(
                         book, page, image_prefix + page_image_name(page),
                         ocr_pages[page], image_sizes[page],
                         (page_annotations or {}).get(str(page), [])
                     )
                     for page in archive_pages)
    return '''<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title><style>%s</style></head>
<body><div class="layout"><aside><b>%s</b><div class="meta">PDF %d 页 · OCR %s</div><div class="jump">%s</div><a class="back" href="index.html">← 返回十六册总索引</a><br><a class="back" href="../和声学手册.html">← 返回理论手册</a></aside>
<main><header class="book-head"><h1>%s</h1><p><b>PDF 文件：</b>%s</p><p><b>总页数：</b>%d（PDF 物理页码）　<b>已发布引用页：</b>%d　<b>OCR 平均置信度：</b>%s　<b>字符数：</b>%s</p>%s<p class="hint">公开部署版仅保留理论手册实际引用并建立锚点的教材页；每页先显示整页影印图，后附 OCR 文本。OCR 供检索与复制；谱例、临时记号、罗马数字与连线以图像为准。点击图片可打开原尺寸。</p></header>
%s<section class="back"><a href="index.html">返回总索引</a> · <a href="../和声学手册.html">返回理论手册</a></section></main></div></body></html>''' % (
        title, BOOK_CSS, title, book['pages'], index_row.get('mean_conf', '—'), jump,
        title, source, book['pages'], len(archive_pages), index_row.get('mean_conf', '—'), index_row.get('chars', '—'),
        duplicate, body
    )


def render_page(doc, page_number, output_path, force=False):
    if not force and os.path.exists(output_path) and os.path.getsize(output_path) >= MIN_IMAGE_BYTES:
        return False
    import fitz
    page = doc[page_number - 1]
    rect = page.rect
    scale = min(MAX_SCALE, MAX_WIDTH / max(1.0, rect.width), MAX_HEIGHT / max(1.0, rect.height))
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
    payload = pix.tobytes('jpeg', jpg_quality=JPEG_QUALITY)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    tmp = output_path + '.tmp'
    with open(tmp, 'wb') as handle:
        handle.write(payload)
    os.replace(tmp, output_path)
    return True


def image_size(path):
    from PIL import Image
    with Image.open(path) as image:
        return image.size


def build_one(book, index_row, ocr_pages, duplicate_of=None, canonical=None,
              force=False, page_annotations=None, annotations_only=False,
              source_dir=None):
    canonical_id = duplicate_of or book['id']
    image_dir = os.path.join(ASSETS_DIR, canonical_id)
    markdown_path = os.path.join(BOOKS_DIR, book['id'] + '.md')
    html_path = os.path.join(BOOKS_DIR, book['id'] + '.html')
    pdf_path = os.path.join(source_dir or SOURCE_DIR, book['file'])
    if set(ocr_pages) != set(range(1, book['pages'] + 1)):
        missing = sorted(set(range(1, book['pages'] + 1)) - set(ocr_pages))
        extra = sorted(set(ocr_pages) - set(range(1, book['pages'] + 1)))
        raise RuntimeError('%s OCR page mismatch: missing=%s extra=%s' % (book['id'], missing[:8], extra[:8]))

    annotation_pages = sorted({int(page) for page in (page_annotations or {})})
    archive_pages = annotation_pages or list(range(1, book['pages'] + 1))
    if not duplicate_of:
        if annotations_only:
            missing = [page for page in archive_pages
                       if not os.path.exists(os.path.join(image_dir, page_image_name(page)))]
            if missing:
                raise RuntimeError('%s missing page images: %s' % (book['id'], missing[:8]))
        else:
            import fitz
            if not os.path.exists(pdf_path):
                raise RuntimeError('missing PDF: ' + pdf_path)
            doc = fitz.open(pdf_path)
            try:
                if doc.page_count != book['pages']:
                    raise RuntimeError('%s PDF page count changed: %s != %s' % (book['id'], doc.page_count, book['pages']))
                rendered = 0
                for page in archive_pages:
                    output_path = os.path.join(image_dir, page_image_name(page))
                    if render_page(doc, page, output_path, force=force):
                        rendered += 1
                    if page == archive_pages[-1]:
                        print('[%s] %d cited pages (rendered %d)' % (book['id'], len(archive_pages), rendered), flush=True)
            finally:
                doc.close()
    else:
        missing = [page for page in range(1, book['pages'] + 1)
                   if not os.path.exists(os.path.join(image_dir, page_image_name(page)))]
        if missing:
            raise RuntimeError('duplicate %s missing canonical images: %s' % (book['id'], missing[:8]))

    title = canonical['title'] if canonical else book['title']
    parts = [book_header(book, index_row, archive_pages, duplicate_of=duplicate_of, canonical_title=title)]
    for page in archive_pages:
        image_rel = '../assets/books/%s/%s' % (canonical_id, page_image_name(page))
        parts.append(page_section(
            book, page, image_rel, ocr_pages[page],
            (page_annotations or {}).get(str(page), [])
        ))
    write_text(markdown_path, '\n'.join(parts))
    image_prefix = '../assets/books/%s/' % canonical_id
    image_sizes = {
        page: image_size(os.path.join(image_dir, page_image_name(page)))
        for page in archive_pages
    }
    write_text(html_path, book_html(
        book, index_row, ocr_pages, image_prefix, image_sizes,
        archive_pages,
        duplicate_of=duplicate_of, canonical_title=title,
        page_annotations=page_annotations
    ))

    image_bytes = sum(
        os.path.getsize(os.path.join(image_dir, page_image_name(page)))
        for page in archive_pages
    )
    return {
        'id': book['id'],
        'title': book['title'],
        'file': book['file'],
        'pages': book['pages'],
        'archivePages': len(archive_pages),
        'citedPages': archive_pages,
        'priority': book.get('priority', 999),
        'markdown': 'books/' + book['id'] + '.md',
        'html': 'books/' + book['id'] + '.html',
        'imageDir': 'assets/books/' + canonical_id,
        'imagePattern': 'p%04d.jpg',
        'imageBytes': image_bytes,
        'ocrMeanConfidence': index_row.get('mean_conf'),
        'duplicateOf': duplicate_of or None,
        'canonicalTitle': title if duplicate_of else None,
    }


def build_plan(books_meta):
    plan = []
    for book in books_meta['books']:
        plan.append((book, None, None))
    by_id = {book['id']: book for book in books_meta['books']}
    for duplicate in books_meta.get('duplicates', []):
        canonical_id = duplicate['same_as']
        canonical = by_id[canonical_id]
        dup = {
            'id': canonical_id + '_duplicate',
            'title': canonical['title'] + '（重复扫描本）',
            'file': duplicate['file'],
            'pages': canonical['pages'],
            'kind': canonical.get('kind', ''),
            'unique': False,
        }
        plan.append((dup, canonical_id, canonical))
    return plan


def build_index(results, books_meta):
    total_cited = sum(item['archivePages'] for item in results)
    total_source_pages = sum(item['pages'] for item in results)
    lines = [
        '# 和声学教材 · 引用页影印与 OCR 文本',
        '',
        '> 共 %d 种独立教材，公开部署 %d 个被理论手册实际引用的 PDF 页。每页保留整版影印图，并在图后附 OCR 文本与手册回跳链接。所有页码均为 PDF 物理页码。' % (len(results), total_cited),
        '',
        '## 使用说明',
        '',
        '- 每册 Markdown 的每个被引用页先给整页图，再给 OCR 文本；点击图片可打开原尺寸。',
        '- OCR 用于检索、复制和定位，谱例、临时记号、罗马数字与连线以整页图为准。',
        '- 被理论手册引用的页面在图后列出“手册使用本页”，其中包括论点提炼、案例的原书要点与机制、阶段依据和正文引用，并可回跳到手册中的对应条目。',
        '- 快速跳页在每册开头列出全部已发布引用页；每页也有 `p0001` 形式的锚点。',
        '',
        '## 总览',
        '',
        '| # | 教材 | 总页数 | 已引用页 | OCR 置信度 | Markdown |',
        '| --- | --- | ---: | ---: | ---: | --- |',
    ]
    for number, item in enumerate(results, 1):
        lines.append('| %d | %s | %d | %d | %s | [打开](%s) |' % (
            number, item['title'], item['pages'], item['archivePages'],
            item['ocrMeanConfidence'], item['id'] + '.md'
        ))
    lines.extend([
        '',
        '## 归档统计',
        '',
        '- 独立教材：%d 种' % len(results),
        '- 教材总页数：%d' % total_source_pages,
        '- 公开引用页：%d' % total_cited,
        '',
        '机器可读清单见 [`../evidence/book-archives.json`](../evidence/book-archives.json)。',
        '',
    ])
    write_text(os.path.join(BOOKS_DIR, 'README.md'), '\n'.join(lines))
    index_css = r'''
:root{--bg:#0d131c;--panel:#141d29;--text:#e8edf4;--muted:#9aabc0;--gold:#efb45b;--teal:#61c7bd;--line:#2a394b}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% -10%,#2b2632 0,transparent 32%),var(--bg);color:var(--text);font:15px/1.7 ui-sans-serif,"Noto Sans SC","Microsoft YaHei",sans-serif}
a{color:var(--gold);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(calc(100% - 28px),1080px);margin:0 auto;padding:34px 0 60px}
.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:28px}.brand{display:flex;align-items:center;gap:11px}.mark{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#f0bd6c,#8d6230);color:#20180f;font-weight:800}.brand b{display:block;font-size:14px}.brand small{display:block;color:var(--muted);font-size:11px}.back{font-size:12px;color:var(--teal);white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:7px 11px}
h1{margin:0 0 9px;font-size:clamp(28px,5vw,44px);line-height:1.2;letter-spacing:-.035em}.lead{margin:0 0 28px;color:var(--muted);max-width:760px}.lead strong{color:var(--text)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.book{border:1px solid var(--line);border-radius:14px;background:rgba(20,29,41,.86);padding:18px;min-width:0}.book-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.book h2{font-size:15px;line-height:1.45;margin:0;color:#f1d3a1}.book-head span{font:11px ui-monospace,Consolas,monospace;color:var(--teal);white-space:nowrap}.book-note{margin:8px 0 12px;color:var(--muted);font-size:11px}.pages{display:flex;flex-wrap:wrap;gap:5px}.pages a{display:inline-flex;align-items:center;justify-content:center;min-width:42px;min-height:30px;padding:2px 7px;border:1px solid var(--line);border-radius:6px;background:#101924;color:#c6d3e0;font:11px ui-monospace,Consolas,monospace}.pages a:hover{border-color:#5a7189;color:#fff;text-decoration:none}
footer{margin-top:26px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
@media(max-width:720px){.wrap{width:min(calc(100% - 20px),1080px);padding-top:22px}.grid{grid-template-columns:1fr}.top{margin-bottom:22px}.back{font-size:11px}.book{padding:15px}.pages a{min-height:32px}.lead{font-size:13px}}
'''
    cards = []
    for item in results:
        pages = ''.join('<a href="%s.html#p%04d">p.%d</a>' % (item['id'], page, page)
                        for page in item['citedPages'])
        cards.append(
            '<article class="book"><div class="book-head"><h2>%s</h2>'
            '<span>%d 页</span></div><p class="book-note">公开引用页；总页数 %d。</p>'
            '<div class="pages">%s</div></article>' % (
                html.escape(item['title']), item['archivePages'], item['pages'], pages
            )
        )
    index_html = '''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d131c"><title>和声教材证据索引 · Harmony Atlas</title><style>%s</style></head>
<body><main class="wrap"><div class="top"><div class="brand"><span class="mark">H</span><span><b>和声教材证据索引</b><small>Harmony Atlas · Source Anchors</small></span></div><a class="back" href="../和声学手册.html">← 返回理论手册</a></div>
<h1>教材页与论点锚点</h1><p class="lead">共 <strong>%d</strong> 个被理论手册实际引用的页面，覆盖 <strong>%d</strong> 种教材。点击页码可直达对应页的影印、OCR 和页内论点位置。公开部署版不包含未引用扫描页。</p>
<section class="grid">%s</section><footer>共 %d 种教材，教材总页数 %d。页码均为 PDF 物理页码，可能与书内印刷页码不同。</footer></main></body></html>''' % (
        index_css, total_cited, len(results), ''.join(cards), len(results), total_source_pages
    )
    write_text(os.path.join(BOOKS_DIR, 'index.html'), index_html)


def build_public_manifest(results):
    books = [
        {
            'id': item['id'],
            'html': 'docs/' + item['html'],
            'pages': item['citedPages'],
            'pageCount': item['archivePages'],
        }
        for item in results
    ]
    payload = {
        'mode': 'public-deploy',
        'generatedAt': datetime.date.today().isoformat(),
        'source': 'docs/和声学手册.html citation anchors',
        'bookCount': len(books),
        'pageCount': sum(book['pageCount'] for book in books),
        'books': books,
    }
    write_json(PUBLIC_DEPLOY, payload)
    return payload


def load_book_annotations():
    if not os.path.exists(BOOK_ANNOTATIONS):
        raise RuntimeError(
            'missing reverse-reference data: %s (run tools/build_docs.py first)' % BOOK_ANNOTATIONS
        )
    payload = read_json(BOOK_ANNOTATIONS)
    return payload.get('books', {})


def build_all(books_meta, index_rows, selected=None, workers=4, force=False,
              annotations_only=False, source_dir=None):
    plan = [item for item in build_plan(books_meta) if not item[1]]
    index_by_id = {row['id']: row for row in index_rows}
    if selected:
        plan = [item for item in plan if item[0]['id'] in selected]
    if not plan:
        raise RuntimeError('no books selected')
    os.makedirs(BOOKS_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    annotations = load_book_annotations()

    ocr_cache = {}
    for book, duplicate_of, _ in plan:
        canonical_id = duplicate_of or book['id']
        if canonical_id not in ocr_cache:
            ocr_cache[canonical_id] = load_ocr(canonical_id)
    results = []
    started = time.time()
    unique_plan = plan
    duplicate_plan = []
    if workers <= 1 or len(unique_plan) <= 1:
        for book, duplicate_of, canonical in unique_plan:
            ocr = ocr_cache[book['id']]
            results.append(build_one(
                book, index_by_id[book['id']], ocr, force=force,
                page_annotations=annotations.get(book['id'], {}),
                annotations_only=annotations_only, source_dir=source_dir
            ))
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
            future_map = {}
            for book, _, _ in unique_plan:
                future = pool.submit(
                    build_one, book, index_by_id[book['id']], ocr_cache[book['id']],
                    force=force, page_annotations=annotations.get(book['id'], {}),
                    annotations_only=annotations_only, source_dir=source_dir
                )
                future_map[future] = book['id']
            for future in concurrent.futures.as_completed(future_map):
                result = future.result()
                results.append(result)
                print('finished %s in %.1fs' % (result['id'], time.time() - started), flush=True)
    for book, duplicate_of, canonical in duplicate_plan:
        results.append(build_one(
            book, index_by_id[duplicate_of], ocr_cache[duplicate_of],
            duplicate_of=duplicate_of, canonical=canonical, force=force,
            page_annotations=annotations.get(duplicate_of, {}),
            annotations_only=annotations_only
        ))
    results.sort(key=lambda item: (item['duplicateOf'] is not None, item['priority'], item['id']))
    return results


def check_all(books_meta):
    plan = [item for item in build_plan(books_meta) if not item[1]]
    problems = []
    total_pages = 0
    total_images = 0
    annotated_pages = 0
    total_refs = 0
    annotations = {}
    if not os.path.exists(BOOK_ANNOTATIONS):
        problems.append('missing reverse-reference data ' + BOOK_ANNOTATIONS)
    else:
        annotations = read_json(BOOK_ANNOTATIONS).get('books', {})
    if not os.path.exists(MANUAL_HTML):
        problems.append('missing manual html ' + MANUAL_HTML)
        manual_text = ''
    else:
        manual_text = open(MANUAL_HTML, encoding='utf-8').read()
    manual_ids = set(re.findall(r'id="([^"]+)"', manual_text))
    known_books = {duplicate_of or book['id'] for book, duplicate_of, _ in plan}
    for book_id in annotations:
        if book_id not in known_books:
            problems.append('reverse references cite unknown book ' + book_id)

    for book, duplicate_of, canonical in plan:
        canonical_id = duplicate_of or book['id']
        md_path = os.path.join(BOOKS_DIR, book['id'] + '.md')
        html_path = os.path.join(BOOKS_DIR, book['id'] + '.html')
        if not os.path.exists(md_path):
            problems.append('missing markdown ' + md_path)
            continue
        if not os.path.exists(html_path):
            problems.append('missing html ' + html_path)
        text = open(md_path, encoding='utf-8').read()
        page_annotations = annotations.get(canonical_id, {})
        expected_pages = sorted(int(page) for page in page_annotations)
        markers = [int(x) for x in re.findall(r'<!-- PAGE:(\d+) -->', text)]
        if markers != expected_pages:
            problems.append('%s page markers mismatch' % book['id'])
        image_refs = re.findall(r'!\[[^\]]*\]\((\.\./assets/books/[^)]+)\)', text)
        if len(image_refs) != len(expected_pages):
            problems.append('%s image refs %d != %d' % (
                book['id'], len(image_refs), len(expected_pages)))
        html_text = ''
        if os.path.exists(html_path):
            html_text = open(html_path, encoding='utf-8').read()
            if len(re.findall(r'<section class="book-page" id="p[0-9]{4}">', html_text)) != len(expected_pages):
                problems.append('%s html page sections mismatch' % book['id'])
            if 'html{scroll-behavior:auto}' not in html_text:
                problems.append('%s html does not use immediate page jumps' % book['id'])
            dimensioned = len(re.findall(
                r'<img loading="lazy" decoding="async" width="\d+" height="\d+"', html_text
            ))
            if dimensioned != len(expected_pages):
                problems.append('%s html image dimensions %d != %d' % (
                    book['id'], dimensioned, len(expected_pages)
                ))
            if '.manual-refs{' not in html_text:
                problems.append('%s html is missing manual-reference styles' % book['id'])
        for ref in image_refs:
            path = os.path.normpath(os.path.join(BOOKS_DIR, ref))
            if not os.path.exists(path) or os.path.getsize(path) < MIN_IMAGE_BYTES:
                problems.append('%s invalid image %s' % (book['id'], ref))
                break

        md_sections = {
            int(page): body for page, body in re.findall(
                r'<!-- PAGE:(\d+) -->(.*?)(?=<!-- PAGE:|\Z)', text, re.S
            )
        }
        html_sections = {
            page: body for page, body in re.findall(
                r'<section class="book-page" id="(p[0-9]{4})">(.*?)</section>',
                html_text, re.S
            )
        }
        for page_key, items in page_annotations.items():
            try:
                page = int(page_key)
            except (TypeError, ValueError):
                problems.append('%s has a non-numeric annotation page %r' % (canonical_id, page_key))
                continue
            if not 1 <= page <= book['pages']:
                problems.append('%s annotation page %d is outside the book' % (canonical_id, page))
                continue
            if not isinstance(items, list) or not items:
                problems.append('%s p.%d has an empty annotation list' % (canonical_id, page))
                continue
            page_tag = 'p%04d' % page
            annotated_pages += 1
            total_refs += len(items)
            section = md_sections.get(page, '')
            if '<!-- MANUAL-REFS:%s -->' % page_tag not in section:
                problems.append('%s markdown p.%d lacks manual references' % (book['id'], page))
            elif section.count('class="manual-ref-item"') != len(items):
                problems.append('%s markdown p.%d manual refs count mismatch' % (book['id'], page))
            html_section = html_sections.get(page_tag, '')
            if 'id="manual-refs-%s"' % page_tag not in html_section:
                problems.append('%s html p.%d lacks manual references' % (book['id'], page))
            elif html_section.count('class="manual-ref-item"') != len(items):
                problems.append('%s html p.%d manual refs count mismatch' % (book['id'], page))
            for item in items:
                for field in ('kind', 'id', 'label', 'text', 'href'):
                    if not isinstance(item.get(field), str) or not item[field].strip():
                        problems.append('%s p.%d has an incomplete annotation item' % (canonical_id, page))
                        break
                if item.get('kind') not in KIND_LABELS:
                    problems.append('%s p.%d has unknown annotation kind %r' % (
                        canonical_id, page, item.get('kind')
                    ))
                href = item.get('href') or ''
                prefix = '../和声学手册.html#'
                if not href.startswith(prefix):
                    problems.append('%s p.%d has invalid manual href %s' % (canonical_id, page, href))
                    continue
                target = href[len(prefix):]
                if target not in manual_ids:
                    problems.append('%s p.%d references missing manual anchor %s' % (
                        canonical_id, page, target
                    ))
        total_pages += book['pages']
        total_images += len(image_refs)
    if not os.path.exists(os.path.join(BOOKS_DIR, 'README.md')):
        problems.append('missing books README')
    if not os.path.exists(os.path.join(BOOKS_DIR, 'index.html')):
        problems.append('missing books index HTML')
    if problems:
        raise RuntimeError('archive check failed:\n' + '\n'.join(problems[:40]))
    print('verified %d markdown books, %d page entries, %d page-image references, '
          '%d annotated pages, %d reverse links' % (
        len(plan), total_pages, total_images, annotated_pages, total_refs
    ))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', default='', help='comma-separated book ids')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--force', action='store_true', help='re-render existing page images')
    parser.add_argument('--annotations-only', action='store_true',
                        help='rebuild Markdown/HTML from existing images and OCR; no PyMuPDF needed')
    parser.add_argument('--source-dir', default='', help='directory containing the source PDFs')
    parser.add_argument('--check', action='store_true', help='verify Markdown and images without building')
    args = parser.parse_args()
    books_meta = read_json(BOOKS_JSON)
    index_rows = read_json(INDEX_JSON)
    if args.check:
        check_all(books_meta)
        return
    selected = {item.strip() for item in args.book.split(',') if item.strip()} or None
    results = build_all(books_meta, index_rows, selected=selected, workers=args.workers,
                        force=args.force, annotations_only=args.annotations_only,
                        source_dir=args.source_dir or None)
    if selected:
        print('built %d selected book(s)' % len(results))
        return
    build_index(results, books_meta)
    public_manifest = build_public_manifest(results)
    payload = {
        'version': 1,
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'note': 'Per-page facsimile images plus OCR text; physical PDF pagination.',
        'settings': {
            'maxScale': MAX_SCALE,
            'maxWidth': MAX_WIDTH,
            'maxHeight': MAX_HEIGHT,
            'jpegQuality': JPEG_QUALITY,
        },
        'totals': {
            'pdfs': len(results),
            'uniqueBooks': sum(1 for item in results if not item['duplicateOf']),
            'uniquePages': sum(item['pages'] for item in results),
            'archivePages': sum(item['archivePages'] for item in results),
            'uniquePageImages': sum(item['archivePages'] for item in results),
        },
        'books': results,
    }
    write_json(ARCHIVE_JSON, payload)
    print('books:', len(results), 'cited pages:', public_manifest['pageCount'],
          'images:', payload['totals']['uniquePageImages'])


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('build_book_archives failed:', exc, file=sys.stderr)
        raise
