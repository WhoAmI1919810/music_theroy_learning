# -*- coding: utf-8 -*-
"""Resumable, low-priority OCR for the orchestration textbook corpus.

All outputs stay under the project directory. Usage:
  python tools/ocr_books.py --books adler_1 --workers 1 --chunk 4 --limit-pages 8 --scale 1.8
  python tools/ocr_books.py --ranges adler_1:16-17 --workers 1 --chunk 4 --scale 1.8
  python tools/ocr_books.py --all --workers 1 --chunk 4 --scale 2.0

Without --books, --ranges or --all the script refuses to start. Use --dry-run to
inspect the selected page ranges without loading a PDF or OCR model.
"""
import os, sys, json, time, traceback, argparse
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('MKL_NUM_THREADS', '1')
os.environ.setdefault('ORT_NUM_THREADS', '1')
os.environ.setdefault('NUMEXPR_NUM_THREADS', '1')
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '_work')
for deps in (os.path.join(WORK, 'pydeps'), r'H:\和声学\_work\pydeps'):
    if os.path.isdir(deps):
        sys.path.insert(0, deps)
OCR_DIR = os.path.join(ROOT, 'corpus', 'ocr')
PART_DIR = os.path.join(WORK, 'ocr_parts')
LOG_DIR = os.path.join(WORK, 'logs')
os.makedirs(OCR_DIR, exist_ok=True)
os.makedirs(PART_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

_engine = None
_docs = {}

def _get_engine():
    global _engine
    if _engine is None:
        try:
            import cv2
            cv2.setNumThreads(1)
        except Exception:
            pass
        from rapidocr_onnxruntime import RapidOCR
        import logging
        logging.getLogger('OrtInferSession').setLevel(logging.WARNING)
        logging.getLogger('RapidOCR').setLevel(logging.WARNING)
        try:
            _engine = RapidOCR(intra_op_num_threads=1, det_use_dml=True, rec_use_dml=True, cls_use_dml=True)
        except Exception:
            _engine = RapidOCR(intra_op_num_threads=1)
    return _engine

def _get_doc(path):
    global _docs
    import fitz
    if path not in _docs:
        if len(_docs) >= 2:
            old = next(iter(_docs))
            try:
                _docs[old].close()
            except Exception:
                pass
            del _docs[old]
        _docs[path] = fitz.open(path)
    return _docs[path]

def process_part(task):
    import fitz, numpy as np
    part_path = task['part_path']
    if os.path.exists(part_path):
        try:
            with open(part_path, encoding='utf-8') as fh:
                rows = [json.loads(x) for x in fh if x.strip()]
            if len(rows) == (task['end'] - task['start']) + 1:
                return {'part': part_path, 'skipped': True, 'pages': len(rows) - 1}
        except Exception:
            pass
    doc = _get_doc(task['pdf'])
    engine = _get_engine()
    scale = task['scale']
    rows = [{'type': 'meta', 'book_id': task['book_id'], 'start': task['start'] + 1,
             'end': task['end'], 'scale': scale, 'created': time.strftime('%Y-%m-%d %H:%M:%S')}]
    for pno in range(task['start'], task['end']):
        t0 = time.time()
        try:
            page = doc[pno]
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csGRAY, alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
            mean = float(img.mean()); std = float(img.std())
            lines = []
            if not (mean > 248 and std < 6):
                res, _ = engine(img)
                for item in (res or []):
                    box, text, score = item[0], item[1], float(item[2])
                    text = (text or '').strip()
                    if not text:
                        continue
                    ys = [p[1] for p in box]; xs = [p[0] for p in box]
                    lines.append({'text': text, 'score': round(score, 3),
                                  'x': round(min(xs), 1), 'y': round(min(ys), 1)})
                lines.sort(key=lambda z: (round(z['y'] / 12.0), z['x']))
            text = '\n'.join(z['text'] for z in lines)
            conf = round(sum(z['score'] for z in lines) / len(lines), 3) if lines else 0.0
            rows.append({'type': 'page', 'page': pno + 1, 'text': text, 'lines': lines,
                         'n_lines': len(lines), 'mean_conf': conf,
                         'w': pix.width, 'h': pix.height, 'scale': scale,
                         'elapsed': round(time.time() - t0, 2)})
        except Exception as e:
            rows.append({'type': 'page', 'page': pno + 1, 'text': '', 'lines': [],
                         'n_lines': 0, 'mean_conf': 0.0, 'scale': scale, 'error': repr(e),
                         'elapsed': round(time.time() - t0, 2)})
    tmp = part_path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    os.replace(tmp, part_path)
    return {'part': part_path, 'skipped': False, 'pages': len(rows) - 1,
            'chars': sum(len(r.get('text', '')) for r in rows),
            'elapsed': round(sum(r.get('elapsed', 0) for r in rows), 1)}

def build_tasks(books, chunk, scale, limit_pages, ranges=None):
    ranges = ranges or {}
    tasks = []
    for b in books:
        pdf = os.path.join(os.path.dirname(ROOT), b['file'])
        spans = ranges.get(b['id'])
        if not spans:
            n = b['pages'] if not limit_pages else min(b['pages'], limit_pages)
            spans = [(0, n)]
        for span_start, span_end in spans:
            for start in range(span_start, span_end, chunk):
                end = min(start + chunk, span_end)
                part = os.path.join(PART_DIR, '%s__%04d_%04d.jsonl' % (b['id'], start, end))
                tasks.append({'book_id': b['id'], 'pdf': pdf, 'start': start, 'end': end,
                              'scale': scale, 'part_path': part, 'priority': b.get('priority', 99)})
    tasks.sort(key=lambda t: (t['priority'], t['start']))
    return tasks


def select_books(all_books, requested_ids, all_flag, range_ids):
    if requested_ids:
        wanted = requested_ids
    elif all_flag:
        wanted = {book['id'] for book in all_books}
    elif range_ids:
        wanted = range_ids
    else:
        return []
    unknown = wanted - {book['id'] for book in all_books}
    if unknown:
        raise ValueError('unknown book id(s): ' + ', '.join(sorted(unknown)))
    return [book for book in all_books if book['id'] in wanted]

def main():
    try:
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(
            ctypes.windll.kernel32.GetCurrentProcess(), 0x4000
        )
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument('--books', default='', help='comma separated ids')
    ap.add_argument('--all', action='store_true', help='explicitly select all books')
    ap.add_argument('--workers', type=int, default=1)
    ap.add_argument('--chunk', type=int, default=4)
    ap.add_argument('--scale', type=float, default=2.0)
    ap.add_argument('--limit-pages', type=int, default=0)
    ap.add_argument('--ranges', default='', help='book:start-end (1-based), comma separated')
    ap.add_argument('--dry-run', action='store_true', help='print task ranges without OCR')
    args = ap.parse_args()
    with open(os.path.join(ROOT, 'corpus', 'books.json'), encoding='utf-8-sig') as fh:
        meta = json.load(fh)
    all_books = meta['books']
    ranges = {}
    for spec in (x.strip() for x in args.ranges.split(',') if x.strip()):
        book_id, span = spec.split(':', 1)
        start, end = (int(x) for x in span.split('-', 1))
        if start < 1 or end < start:
            print('ERROR invalid range: ' + spec, file=sys.stderr)
            return 2
        ranges.setdefault(book_id, []).append((start - 1, end))
    known_ids = {book['id'] for book in all_books}
    unknown_range_ids = set(ranges) - known_ids
    if unknown_range_ids:
        print('ERROR unknown book id(s): ' + ', '.join(sorted(unknown_range_ids)), file=sys.stderr)
        return 2
    if args.all and ranges:
        print('ERROR use --all without --ranges; use --ranges alone for targeted pages', file=sys.stderr)
        return 2
    requested_ids = {x.strip() for x in args.books.split(',') if x.strip()}
    try:
        books = select_books(all_books, requested_ids, args.all, set(ranges))
    except ValueError as error:
        print('ERROR', error, file=sys.stderr)
        return 2
    if not books:
        print('refusing to OCR the whole corpus implicitly; pass --books, --ranges or --all', file=sys.stderr)
        return 2
    if args.all and not ranges and not args.limit_pages:
        print('WARNING full corpus selected; use --ranges or --limit-pages for targeted work', file=sys.stderr)
    if args.workers > 2:
        print('WARNING workers >2 may raise CPU contention; default is 1', file=sys.stderr)
    tasks = build_tasks(books, args.chunk, args.scale, args.limit_pages, ranges)
    total_pages = sum(t['end'] - t['start'] for t in tasks)
    print('books=%d tasks=%d pages=%d workers=%d scale=%s' % (len(books), len(tasks), total_pages, args.workers, args.scale), flush=True)
    if args.dry_run:
        for task in tasks:
            print('DRY %s pages=%d-%d part=%s' % (
                task['book_id'], task['start'] + 1, task['end'], os.path.basename(task['part_path'])))
        return 0
    t0 = time.time(); done_pages = 0; failed = 0
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(process_part, t) for t in tasks]
        for k, fut in enumerate(as_completed(futs), 1):
            try:
                r = fut.result()
                done_pages += r['pages']
                print('[%d/%d] %s pages=%d chars=%s elapsed=%ss skipped=%s' % (
                    k, len(futs), os.path.basename(r['part']), r['pages'], r.get('chars', ''), r.get('elapsed', ''), r['skipped']), flush=True)
            except Exception as e:
                failed += 1
                print('FAILED', repr(e), traceback.format_exc(), flush=True)
    print('DONE pages=%d failed=%d wall=%ss' % (done_pages, failed, round(time.time() - t0, 1)), flush=True)
    return 0

if __name__ == '__main__':
    sys.exit(main())

