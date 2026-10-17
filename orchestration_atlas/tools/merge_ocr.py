# -*- coding: utf-8 -*-
import os, json, glob, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '_work')
PARTS = os.path.join(WORK, 'ocr_parts')
OCR = os.path.join(ROOT, 'corpus', 'ocr')
TEXT = os.path.join(ROOT, 'corpus', 'text')
os.makedirs(OCR, exist_ok=True); os.makedirs(TEXT, exist_ok=True)

with open(os.path.join(ROOT, 'corpus', 'books.json'), encoding='utf-8-sig') as fh:
    meta = json.load(fh)
index = []
for b in meta['books']:
    bid = b['id']
    pages = {}
    existing = os.path.join(OCR, bid + '.jsonl')
    if os.path.exists(existing):
        try:
            for line in open(existing, encoding='utf-8'):
                if not line.strip(): continue
                row = json.loads(line)
                if row.get('type') == 'page' and row.get('page') is not None:
                    pages[row['page']] = row
        except Exception as e:
            print('WARN existing', existing, e)
    for fn in sorted(glob.glob(os.path.join(PARTS, bid + '__*.jsonl'))):
        try:
            for line in open(fn, encoding='utf-8'):
                if not line.strip(): continue
                row = json.loads(line)
                if row.get('type') == 'page':
                    p = row.get('page')
                    if p is None: continue
                    old = pages.get(p)
                    # prefer higher-resolution OCR, then confidence, then text length
                    key = (row.get('scale', 0), row.get('mean_conf', 0), len(row.get('text', '')))
                    old_key = (old.get('scale', 0), old.get('mean_conf', 0), len(old.get('text', ''))) if old else None
                    if old is None or key > old_key:
                        pages[p] = row
        except Exception as e:
            print('WARN part', fn, e)
    rows = [pages[p] for p in sorted(pages)]
    with open(os.path.join(OCR, bid + '.jsonl'), 'w', encoding='utf-8', newline='\n') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    with open(os.path.join(TEXT, bid + '.txt'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('# %s\n\n' % b['title'])
        for r in rows:
            fh.write('\n===== PDF PAGE %d =====\n' % r['page'])
            fh.write(r.get('text','') + '\n')
    chars = sum(len(r.get('text','')) for r in rows)
    confs = [r.get('mean_conf',0) for r in rows if r.get('n_lines',0)]
    index.append({'id':bid,'title':b['title'],'pages_total':b['pages'],'pages_ocr':len(rows),
                  'chars':chars,'mean_conf':round(sum(confs)/len(confs),3) if confs else 0,
                  'complete':len(rows)>=b['pages'],'kind':b.get('kind')})
    print('%-24s %4d/%4d pages %8d chars conf=%s' % (bid, len(rows), b['pages'], chars, index[-1]['mean_conf']))
with open(os.path.join(ROOT, 'corpus', 'index.json'), 'w', encoding='utf-8') as fh:
    json.dump(index, fh, ensure_ascii=False, indent=2)
print('wrote', os.path.join(ROOT,'corpus','index.json'))
