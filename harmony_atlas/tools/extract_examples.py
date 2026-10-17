#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extract verified textbook example crops for the offline harmony manual.

Gallery metadata lives in evidence/example-gallery.json. Each entry records a
PDF physical page, a normalized crop rectangle, and an OCR needle. The needle
is checked against the merged OCR before the crop is written.
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(os.path.dirname(ROOT), '_work')
sys.path.insert(0, os.path.join(WORK, 'pydeps'))

EXAMPLES_JSON = os.path.join(ROOT, 'evidence', 'example-gallery.json')
BOOKS_JSON = os.path.join(ROOT, 'corpus', 'books.json')
OCR_DIR = os.path.join(ROOT, 'corpus', 'ocr')
DOCS = os.path.join(ROOT, 'docs')


def read_json(path):
    with open(path, encoding='utf-8-sig') as handle:
        return json.load(handle)


def normalized(text):
    return re.sub(r'\s+', '', text or '')


def ocr_pages(book_id):
    path = os.path.join(OCR_DIR, book_id + '.jsonl')
    if not os.path.exists(path):
        raise RuntimeError('missing OCR file: ' + path)
    pages = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get('type') == 'page':
                pages[int(row['page'])] = row.get('text', '')
    return pages


def validate(gallery, books):
    by_id = {book['id']: book for book in books['books']}
    seen = set()
    cache = {}
    for item in gallery['examples']:
        example_id = item.get('id', '')
        if not re.match(r'^[CEM][0-9]{2}$', example_id):
            raise RuntimeError('invalid example id: ' + repr(example_id))
        if example_id in seen:
            raise RuntimeError('duplicate example id: ' + example_id)
        seen.add(example_id)
        book_id = item.get('book')
        if book_id not in by_id:
            raise RuntimeError(example_id + ': unknown book ' + repr(book_id))
        page = item.get('page')
        book = by_id[book_id]
        if not isinstance(page, int) or page < 1 or page > book['pages']:
            raise RuntimeError(example_id + ': page outside ' + book_id)
        crop = item.get('crop')
        if not isinstance(crop, list) or len(crop) != 4:
            raise RuntimeError(example_id + ': crop must have four numbers')
        if not all(isinstance(x, (int, float)) and 0 <= x <= 1 for x in crop):
            raise RuntimeError(example_id + ': crop values must be normalized')
        if not (crop[0] < crop[2] and crop[1] < crop[3]):
            raise RuntimeError(example_id + ': crop rectangle is empty')
        if item.get('kind') not in ('repertoire', 'textbookModel'):
            raise RuntimeError(example_id + ': invalid kind')
        if item.get('stage') not in ('commonPractice', 'expandedTonality', 'modernPostTonal'):
            raise RuntimeError(example_id + ': invalid stage')
        if item.get('image') != 'assets/examples/%s.jpg' % example_id:
            raise RuntimeError(example_id + ': unexpected image path')
        if book_id not in cache:
            cache[book_id] = ocr_pages(book_id)
        text = cache[book_id].get(page, '')
        needle = item.get('ocrNeedle', '')
        if not needle or normalized(needle) not in normalized(text):
            raise RuntimeError('%s: OCR needle %r not found on %s p.%s' % (
                example_id, needle, book_id, page))
        if not item.get('bookPoint') or not item.get('lever') or not item.get('reading') or not item.get('use'):
            raise RuntimeError(example_id + ': incomplete analysis fields')
        if not isinstance(item.get('nodes'), list) or not item['nodes']:
            raise RuntimeError(example_id + ': missing theory nodes')
    return by_id


def render(gallery, books_by_id, only=None):
    import fitz
    rendered = 0
    for item in gallery['examples']:
        if only and item['id'] not in only:
            continue
        book = books_by_id[item['book']]
        pdf = os.path.join(os.path.dirname(ROOT), book['file'])
        if not os.path.exists(pdf):
            raise RuntimeError('missing PDF: ' + pdf)
        doc = fitz.open(pdf)
        try:
            page = doc[item['page'] - 1]
            rect = page.rect
            x0, y0, x1, y1 = item['crop']
            clip = fitz.Rect(
                rect.x0 + rect.width * x0,
                rect.y0 + rect.height * y0,
                rect.x0 + rect.width * x1,
                rect.y0 + rect.height * y1,
            )
            pix = page.get_pixmap(
                matrix=fitz.Matrix(4, 4),
                clip=clip,
                colorspace=fitz.csRGB,
                alpha=False,
            )
            out = os.path.join(DOCS, item['image'])
            os.makedirs(os.path.dirname(out), exist_ok=True)
            pix.save(out, jpg_quality=92)
            rendered += 1
            print('%s  %s p.%s  %dx%d  %s' % (
                item['id'], item['book'], item['page'], pix.width, pix.height, out))
        finally:
            doc.close()
    return rendered


def check(gallery):
    missing = []
    for item in gallery['examples']:
        path = os.path.join(DOCS, item['image'])
        if not os.path.exists(path):
            missing.append(path)
        elif os.path.getsize(path) < 20000:
            missing.append(path + ' (too small)')
    if missing:
        raise RuntimeError('missing or invalid example images:\n' + '\n'.join(missing))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true',
                        help='verify metadata and existing images without rendering')
    parser.add_argument('--only', default='',
                        help='comma-separated example ids to render')
    args = parser.parse_args()
    gallery = read_json(EXAMPLES_JSON)
    books = read_json(BOOKS_JSON)
    books_by_id = validate(gallery, books)
    if args.check:
        check(gallery)
        print('verified %d example images' % len(gallery['examples']))
        return
    only = {x.strip() for x in args.only.split(',') if x.strip()} or None
    rendered = render(gallery, books_by_id, only)
    check(gallery)
    print('rendered %d example images; verified %d' % (rendered, len(gallery['examples'])))


if __name__ == '__main__':
    main()
