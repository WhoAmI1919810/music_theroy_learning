#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the offline manual and the browser-embedded evidence map.

The prose lives in docs/和声学理论体系.md. Sections between AUTO markers are
replaced from the application engine and evidence/source-map.json, so the
manual cannot silently drift away from the program.
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
EVIDENCE = os.path.join(ROOT, 'evidence')
MANUAL_MD = os.path.join(DOCS, '和声学理论体系.md')
MANUAL_HTML = os.path.join(DOCS, '和声学手册.html')
SOURCE_JSON = os.path.join(EVIDENCE, 'source-map.json')
SOURCE_JS = os.path.join(EVIDENCE, 'source-map.js')
EXAMPLE_JSON = os.path.join(EVIDENCE, 'example-gallery.json')
BOOK_ANNOTATIONS = os.path.join(EVIDENCE, 'book-annotations.json')

KIND_LABELS = {
    'repertoire': '作品片段',
    'textbookModel': '教材模型',
}

AUTO_BLOCK = re.compile(
    r'(<!-- AUTO:[A-Z_]+:START -->.*?<!-- AUTO:[A-Z_]+:END -->)', re.S
)
PAGE_LIST = r'PDF\s*p\.\d+(?:\s*[–-]\s*\d+)?(?:\s*、\s*p\.\d+(?:\s*[–-]\s*\d+)?)*'
PAGE_TOKEN = re.compile(r'p\.(\d+)(?:\s*[–-]\s*\d+)?')


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


def image_size(src):
    from PIL import Image
    with Image.open(os.path.join(DOCS, src)) as image:
        return image.size


def run_export():
    proc = subprocess.run(
        ['node', os.path.join(ROOT, 'tools', 'export_docs_data.js')],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        check=False
    )
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode('utf-8', 'replace'))
    return json.loads(proc.stdout.decode('utf-8'))


def cell(value):
    return str(value).replace('|', '\\|').replace('\r', ' ').replace('\n', '<br>')


def table(headers, rows):
    out = ['| ' + ' | '.join(cell(x) for x in headers) + ' |',
           '| ' + ' | '.join(['---'] * len(headers)) + ' |']
    out.extend('| ' + ' | '.join(cell(x) for x in row) + ' |' for row in rows)
    return '\n'.join(out)


def book_page_href(book_id, page):
    return 'books/%s.html#p%04d' % (book_id, int(page))


def book_page_link(book_id, page, label, page_end=None):
    page_text = 'PDF p.%d' % int(page)
    if page_end is not None and int(page_end) != int(page):
        page_text += '–%d' % int(page_end)
    return '[%s，%s](%s)' % (label, page_text, book_page_href(book_id, page))


def anchor_id(prefix, value):
    slug = re.sub(r'[^0-9A-Za-z_-]+', '-', str(value)).strip('-').lower()
    return '%s-%s' % (prefix, slug)


def ref_anchor(kind, identifier, page):
    """Stable anchor for one exact reference on a textbook page."""
    return anchor_id('ref-%s' % kind, '%s-p%04d' % (identifier, int(page)))


def claim_anchor(claim_id):
    return anchor_id('claim', claim_id)


def example_anchor(example_id):
    return anchor_id('example', example_id)


def prose_anchor(book_id, page, occurrence):
    return 'cite-%s-p%04d-%d' % (book_id, int(page), int(occurrence))


def book_ref_href(book_id, page, kind, identifier):
    return 'books/%s.html#%s' % (book_id, ref_anchor(kind, identifier, page))


def book_ref_link(book_id, page, label, kind, identifier, page_end=None):
    page_text = 'PDF p.%d' % int(page)
    if page_end is not None and int(page_end) != int(page):
        page_text += '–%d' % int(page_end)
    return '[%s，%s](%s)' % (
        label, page_text, book_ref_href(book_id, page, kind, identifier)
    )


def book_aliases(data, source_map):
    aliases = {}
    for book in data.get('textbooks', []):
        aliases[book.get('short', '')] = book['id']
        aliases[book.get('title', '')] = book['id']
    for profile in source_map.get('bookProfiles', []):
        book_id = profile['book']
        aliases[profile.get('short', '')] = book_id
        title = profile.get('title', '')
        aliases[title] = book_id
        if '《' in title:
            author = title.split('《', 1)[0].strip()
            if author:
                aliases.setdefault(author, book_id)
        title_match = re.search(r'《[^》]+》', title)
        if title_match:
            aliases[title_match.group(0)] = book_id
    aliases.update({
        '《概述》': 'tonal_20c_overview',
        '《色彩和声》': 'huacui_color',
    })
    return {key: value for key, value in aliases.items() if key}


def linkify_book_pages(markdown, aliases):
    if not aliases:
        return markdown
    alias_pattern = '|'.join(
        re.escape(alias) for alias in sorted(aliases, key=len, reverse=True)
    )
    citation = re.compile(
        r'(?:(?P<alias>%s)(?P<gap>\s*))?(?P<pages>%s)' % (alias_pattern, PAGE_LIST)
    )
    current_book = {'id': None}

    def link_pages(pages):
        book_id = current_book['id']
        if not book_id:
            return pages

        def replace_page(match):
            return '[%s](%s)' % (
                match.group(0), book_page_href(book_id, match.group(1))
            )

        return PAGE_TOKEN.sub(replace_page, pages)

    def link_citations(part):
        protected = []

        def stash(match):
            protected.append(match.group(0))
            return '\x00PROTECTED%d\x00' % (len(protected) - 1)

        part = re.sub(r'```.*?```', stash, part, flags=re.S)
        part = re.sub(r'`[^`\n]+`', stash, part)
        part = re.sub(r'\[[^\]]+\]\([^)]+\)', stash, part)

        def replace_citation(match):
            alias = match.group('alias')
            if alias:
                current_book['id'] = aliases[alias]
            return '%s%s%s' % (
                match.group('alias') or '',
                match.group('gap') or '',
                link_pages(match.group('pages'))
            )

        part = citation.sub(replace_citation, part)
        for index, original in enumerate(protected):
            part = part.replace('\x00PROTECTED%d\x00' % index, original)
        return part

    chunks = AUTO_BLOCK.split(markdown)
    return ''.join(
        link_citations(chunk) if index % 2 == 0 else chunk
        for index, chunk in enumerate(chunks)
    )


def citation_snippet(line):
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'^\s*(?:[-*+]|\d+[.)])\s*', '', text)
    text = re.sub(r'\s+', ' ', text.strip(' >'))
    return text[:177] + '…' if len(text) > 180 else text


def annotate_static_citations(markdown):
    output = []
    entries = {}
    counts = {}
    in_auto = False
    exact_pattern = re.compile(
        r'books/([a-z0-9_]+)\.html#ref-prose-([A-Za-z0-9._-]+)-p(\d{4})'
    )
    page_pattern = re.compile(r'books/([a-z0-9_]+)\.html#p(\d{4})')
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith('<!-- ANCHOR:cite-'):
            continue
        if re.match(r'^<!-- AUTO:[A-Z_]+:START -->$', stripped):
            in_auto = True
        elif re.match(r'^<!-- AUTO:[A-Z_]+:END -->$', stripped):
            in_auto = False
        elif not in_auto:
            refs = []
            for match in exact_pattern.finditer(line):
                refs.append((
                    match.start(), match.group(1), int(match.group(3)),
                    match.group(2), None
                ))
            for match in page_pattern.finditer(line):
                refs.append((
                    match.start(), match.group(1), int(match.group(2)),
                    None, match.group(0)
                ))
            refs.sort(key=lambda item: item[0])
            if refs:
                snippet = citation_snippet(line)
                rewritten = line
                for _, book_id, page, existing_anchor, old_href in refs:
                    if existing_anchor:
                        anchor = existing_anchor
                        target = ref_anchor('prose', anchor, page)
                    else:
                        key = (book_id, page)
                        counts[key] = counts.get(key, 0) + 1
                        anchor = prose_anchor(book_id, page, counts[key])
                        target = ref_anchor('prose', anchor, page)
                    entries[anchor] = {
                        'book': book_id,
                        'page': page,
                        'kind': 'prose',
                        'id': anchor,
                        'label': '手册正文引用',
                        'text': snippet,
                        'href': '../和声学手册.html#' + anchor,
                        'anchor': target,
                    }
                    output.append('<!-- ANCHOR:%s -->' % anchor)
                    if old_href:
                        new_href = 'books/%s.html#%s' % (book_id, target)
                        rewritten = rewritten.replace(old_href, new_href, 1)
                line = rewritten
        output.append(line)
    rebuilt = '\n'.join(output)
    if markdown.endswith('\n'):
        rebuilt += '\n'
    return rebuilt, list(entries.values())


def mode_rows(data):
    rows = []
    for mode in data['modes']:
        if mode['heptatonic']:
            chords = '；'.join('%s %s' % (x['roman'], '·'.join(x['notes'])) for x in mode['triads'])
        else:
            chords = '无七声三度叠置库存；由音阶子集生成 %d 个三/七和弦' % mode['subsetCount']
        rows.append([
            '%s (`%s`)' % (mode['name'], mode['id']),
            ' '.join(mode['scale']),
            mode['mood'],
            chords,
            mode['catalogCount']
        ])
    return rows


def cadence_rows(data):
    return [[x['name'], x['formula'], x['function'], x['rule']] for x in data['cadences']]


def mode_action_rows(data):
    rows = []
    for mode in data.get('modeActions', []):
        if not mode.get('heptatonic') or not mode.get('chords'):
            continue
        for chord in mode['chords']:
            next_text = '；'.join(
                '%s(%s)' % (item['roman'], '·'.join(item['notes']))
                for item in chord.get('next', [])
            ) or '—'
            target_labels = []
            for item in chord.get('targets', []):
                marks = []
                if item.get('isPivot'):
                    marks.append('中介')
                if item.get('category') == 'borrowed':
                    marks.append('借')
                suffix = '（%s）' % '·'.join(marks) if marks else ''
                target_labels.append('%s %s%s' % (item['label'], item['roman'], suffix))
            target_text = '；'.join(target_labels) or '—'
            rows.append([
                '%s (`%s`)' % (mode['name'], mode['id']),
                '%s %s' % (chord['roman'], '·'.join(chord['notes'])),
                chord['functionLabel'],
                next_text,
                target_text
            ])
    return rows


def route_rows(data):
    rows = []
    mode_labels = {mode['id']: mode.get('short', mode['id']) for mode in data['modes']}
    for item in data['routes']:
        for index, route in enumerate(item['routes'][:2], 1):
            path = ' → '.join('%s(%s)' % (x['roman'], '·'.join(x['notes'])) for x in route['steps'])
            source_label = item.get('sourceLabel') or '%s %s' % (
                item['sourceTonic'], mode_labels.get(item['sourceMode'], item['sourceMode'])
            )
            target_label = item.get('targetLabel') or '%s %s' % (
                item['targetTonic'], mode_labels.get(item['targetMode'], item['targetMode'])
            )
            rows.append([
                '%s → %s' % (source_label, target_label),
                item['relation']['label'],
                '#%d %s' % (index, route['recipe']),
                path,
                '%.3f' % route['score']
            ])
    return rows


def node_rows(data):
    titles = {x['id']: x['title'] for x in data['theory']}
    outcomes = data.get('outcomeLabels', {})
    labels = dict(titles)
    labels.update(outcomes)
    rows = []
    for node in data['theory']:
        rows.append([
            'L%d' % node.get('layer', 0),
            '%s (`%s`)' % (node['title'], node['id']),
            '、'.join(labels.get(x, x) for x in node.get('prerequisites', [])) or '无',
            '、'.join(labels.get(x, x) for x in node.get('enables', [])) or '无',
            node.get('principle', ''),
            '；'.join(node.get('operations', [])) or '—',
            '；'.join(node.get('applications', [])) or '—'
        ])
    return rows


def period_rows(data):
    rows = []
    for period in data.get('periods', []):
        rows.append([
            '%s `%s`' % (period['name'], period['id']),
            period['span'],
            '；'.join(period.get('changes', [period['tagline']])),
            '；'.join(period.get('consequences', [])),
            '；'.join(period.get('unchanged', []))
        ])
    return rows


def period_basis_rows(data):
    books = {x['id']: x['short'] for x in data['textbooks']}
    rows = []
    for period in data.get('periods', []):
        for index, ref in enumerate(period.get('basis', []), 1):
            identifier = '%s-%d' % (period['id'], index)
            rows.append([
                period['name'],
                books.get(ref['book'], ref['book']),
                '[PDF p.%s](%s)' % (
                    ref['page'],
                    book_ref_href(ref['book'], ref['page'], 'period', identifier)
                ),
                ref['quote']
            ])
    return rows


def book_rows(source_map, books_meta):
    profiles = {x['book']: x for x in source_map.get('bookProfiles', [])}
    rows = []
    for book in books_meta['books']:
        profile = profiles.get(book['id'], {})
        key_pages = '、'.join(
            '[p.%s](%s)' % (x, book_page_href(book['id'], x))
            for x in profile.get('keyPages', [])
        ) or '待补'
        rows.append([
            profile.get('short', book['id']),
            profile.get('title', book['title']),
            profile.get('role', book.get('kind', '')),
            key_pages,
            profile.get('status', 'pending')
        ])
    return rows


def evidence_block(source_map, data):
    titles = {x['id']: x['title'] for x in data['theory']}
    books = {x['book']: x for x in source_map.get('bookProfiles', [])}
    by_node = {}
    for claim in source_map['claims']:
        by_node.setdefault(claim['node'], []).append(claim)
    out = []
    for node in data['theory']:
        node_id = node['id']
        out.append('### %s · `%s`' % (titles.get(node_id, node['title']), node_id))
        claims = by_node.get(node_id, [])
        if not claims:
            out.append('尚无直接证据。')
            continue
        for claim in claims:
            out.append('<!-- ANCHOR:%s -->' % claim_anchor(claim['id']))
            out.append('- **%s**：%s' % (claim['id'], claim['claim']))
            for ref in claim['books']:
                profile = books.get(ref['book'], {})
                label = profile.get('short', ref['book'])
                out.append('  - %s：`%s`' % (
                    book_ref_link(
                        ref['book'], ref['page'], label, 'claim', claim['id']
                    ),
                    ref['quote']
                ))
    return '\n'.join(out)


def example_gallery_block(gallery, data, source_map):
    profiles = {x['book']: x for x in source_map.get('bookProfiles', [])}
    periods = {x['id']: x for x in data.get('periods', [])}
    by_stage = {}
    for item in gallery['examples']:
        by_stage.setdefault(item['stage'], []).append(item)

    out = []
    for index, stage_id in enumerate(gallery['stageOrder'], 1):
        period = periods.get(stage_id, {})
        out.append('### 13.%d %s · %s' % (
            index, period.get('name', stage_id), period.get('span', '')
        ))
        note = gallery.get('stageNotes', {}).get(stage_id)
        if note:
            out.append('> ' + note)
        for item in by_stage.get(stage_id, []):
            profile = profiles.get(item['book'], {})
            book_label = profile.get('short', item['book'])
            page_label = 'PDF p.%s' % item['page']
            if item.get('pageEnd') and item['pageEnd'] != item['page']:
                page_label += '–%s' % item['pageEnd']
            source_link = book_ref_link(
                item['book'], item['page'], book_label, 'example', item['id'],
                item.get('pageEnd')
            )
            kind_label = KIND_LABELS.get(item['kind'], item['kind'])
            nodes = '、'.join('`%s`' % node for node in item['nodes'])
            alt = '%s：%s（%s，%s，%s）' % (
                item['id'], item['title'], book_label, page_label, item['exampleLabel']
            )
            out.append('<!-- ANCHOR:%s -->' % example_anchor(item['id']))
            out.append('#### %s｜%s' % (item['id'], item['title']))
            out.append('![%s](%s)' % (alt, item['image']))
            out.append('- **机制**：%s' % item['lever'])
            out.append('- **读谱位置**：%s' % item['reading'])
            out.append('- **操作**：%s' % item['use'])
            out.append('> 来源：%s，%s｜%s（%s）。关联：%s' % (
                source_link, item['exampleLabel'], item['work'], kind_label, nodes
            ))
    return '\n'.join(out)


def build_book_annotations(data, source_map, gallery, prose_entries):
    titles = {x['id']: x['title'] for x in data['theory']}
    periods = {x['id']: x for x in data.get('periods', [])}
    books = {}
    seen = set()

    def add(book_id, page, item):
        key = (book_id, int(page), item['kind'], item['id'])
        if key in seen:
            return
        seen.add(key)
        books.setdefault(book_id, {}).setdefault(str(int(page)), []).append(item)

    for claim in source_map['claims']:
        for ref in claim['books']:
            add(ref['book'], ref['page'], {
                'kind': 'claim',
                'id': claim['id'],
                'anchor': ref_anchor('claim', claim['id'], ref['page']),
                'label': '%s · %s' % (titles.get(claim['node'], claim['node']), claim['id']),
                'text': '手册提炼：%s' % claim['claim'],
                'href': '../和声学手册.html#' + claim_anchor(claim['id']),
            })

    for period in data.get('periods', []):
        for index, ref in enumerate(period.get('basis', []), 1):
            identifier = '%s-%d' % (period['id'], index)
            add(ref['book'], ref['page'], {
                'kind': 'period',
                'id': period['id'],
                'anchor': ref_anchor('period', identifier, ref['page']),
                'label': '历史阶段依据 · %s' % period['name'],
                'text': '阶段结论：%s\n原文依据：%s' % (
                    period.get('tagline', ''), ref['quote']
                ),
                'href': '../和声学手册.html#period-basis',
            })

    for item in gallery['examples']:
        start = int(item['page'])
        end = int(item.get('pageEnd') or start)
        for page in range(start, end + 1):
            add(item['book'], page, {
                'kind': 'example',
                'id': item['id'],
                'anchor': ref_anchor('example', item['id'], page),
                'label': '手册案例 %s · %s' % (item['id'], item['title']),
                'text': '%s｜%s\n原书要点：%s\n机制：%s\n读谱：%s\n用法：%s' % (
                    item['exampleLabel'], item['work'], item['bookPoint'],
                    item['lever'], item['reading'], item['use']
                ),
                'href': '../和声学手册.html#' + example_anchor(item['id']),
            })

    for entry in prose_entries:
        add(entry['book'], entry['page'], {
            key: entry[key] for key in ('kind', 'id', 'anchor', 'label', 'text', 'href')
        })

    priorities = {'claim': 0, 'example': 1, 'period': 2, 'prose': 3, 'profile': 4}
    for profile in source_map.get('bookProfiles', []):
        book_id = profile['book']
        for page in profile.get('keyPages', []):
            add(book_id, page, {
                'kind': 'profile',
                'id': 'profile-%s-p%04d' % (book_id, int(page)),
                'anchor': ref_anchor('profile', 'profile-%s' % book_id, page),
                'label': '教材代表页 · %s' % profile.get('short', book_id),
                'text': '手册将本页列为《%s》代表页；该书定位：%s' % (
                    profile.get('short', book_id), profile.get('role', '')
                ),
                'href': '../和声学手册.html#book-profiles',
            })

    for book_pages in books.values():
        for page in book_pages:
            book_pages[page].sort(key=lambda item: priorities.get(item['kind'], 9))

    return {
        'version': 1,
        'note': 'Reverse references from source-textbook pages to the claims, examples, period evidence, prose summaries, or representative-page entries in the harmony manual.',
        'books': {book: dict(sorted(pages.items(), key=lambda item: int(item[0])))
                  for book, pages in sorted(books.items())},
    }


def replace_marker(text, name, value):
    pattern = re.compile(
        r'<!-- AUTO:%s:START -->.*?<!-- AUTO:%s:END -->' % (re.escape(name), re.escape(name)),
        re.S
    )
    block = '<!-- AUTO:%s:START -->\n%s\n<!-- AUTO:%s:END -->' % (name, value, name)
    updated, count = pattern.subn(lambda _: block, text)
    if count != 1:
        raise RuntimeError('marker AUTO:%s not found exactly once' % name)
    return updated


def render_manual(data, source_map, books_meta, gallery):
    with open(MANUAL_MD, encoding='utf-8') as handle:
        text = handle.read()
    text = linkify_book_pages(text, book_aliases(data, source_map))
    text = replace_marker(text, 'MODES', table(
        ['调式', 'C 主音音阶', '色彩/中心感', '调内三和弦库存（以 C 为主音）', '完整库存数'],
        mode_rows(data)
    ))
    text = replace_marker(text, 'NODES', table(
        ['层', '节点', '先修', '后续', '一句话原理', '操作', '应用'], node_rows(data)
    ))
    text = replace_marker(text, 'PERIODS', table(
        ['历史阶段', '大致时间', '新增的可控变量', '和声结果', '未改变的条件'], period_rows(data)
    ))
    text = replace_marker(text, 'PERIOD_BASIS', '<!-- ANCHOR:period-basis -->\n' + table(
        ['历史阶段', '教材', '页码', '原文依据'], period_basis_rows(data)
    ))
    text = replace_marker(text, 'CADENCES', table(
        ['终止式', '公式', '功能', '判据'], cadence_rows(data)
    ))
    text = replace_marker(text, 'MODE_ACTIONS', table(
        ['调式（C 主音）', '和弦', '功能', '同调式直接连接', '可转目标（同一音集的重释）'],
        mode_action_rows(data)
    ))
    text = replace_marker(text, 'ROUTES', table(
        ['路线', '关系判定', '方案', '和弦步骤（音名）', '启发式得分'], route_rows(data)
    ))
    text = replace_marker(text, 'BOOKS', '<!-- ANCHOR:book-profiles -->\n' + table(
        ['简称', '教材', '在本体系中的角色', '代表页', '状态'], book_rows(source_map, books_meta)
    ))
    text = replace_marker(text, 'EXAMPLES', example_gallery_block(gallery, data, source_map))
    text = replace_marker(text, 'EVIDENCE', evidence_block(source_map, data))
    text, prose_entries = annotate_static_citations(text)
    with open(MANUAL_MD, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)
    return text, prose_entries


def inline_md(text):
    code_tokens = []
    def stash(match):
        code_tokens.append(match.group(1))
        return '\x00CODE%d\x00' % (len(code_tokens) - 1)
    text = re.sub(r'`([^`]+)`', stash, text)
    text = html.escape(text, quote=False)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    for index, token in enumerate(code_tokens):
        text = text.replace('\x00CODE%d\x00' % index, '<code>%s</code>' % html.escape(token))
    return text


def md_to_html(markdown):
    lines = markdown.splitlines()
    out = []
    toc = []
    heading_index = 0
    paragraph = []
    in_code = False
    code_lines = []
    list_kind = None
    list_items = []

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            out.append('<p>%s</p>' % inline_md(' '.join(x.strip() for x in paragraph)))
            paragraph = []

    def flush_list():
        nonlocal list_kind, list_items
        if list_items:
            tag = 'ol' if list_kind == 'ol' else 'ul'
            out.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline_md(x) for x in list_items), tag))
        list_kind = None
        list_items = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            out.append('<pre><code>%s</code></pre>' % html.escape('\n'.join(code_lines)))
        code_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith('```'):
            if in_code:
                flush_code()
                in_code = False
            else:
                flush_paragraph(); flush_list()
                in_code = True
            i += 1
            continue
        if in_code:
            code_lines.append(line)
            i += 1
            continue
        anchor = re.match(r'^<!-- ANCHOR:([A-Za-z0-9._-]+) -->$', stripped)
        if anchor:
            flush_paragraph(); flush_list()
            out.append('<a class="anchor" id="%s"></a>' % html.escape(anchor.group(1), quote=True))
            i += 1
            continue
        if stripped.startswith('<!--') and stripped.endswith('-->'):
            flush_paragraph(); flush_list()
            i += 1
            continue
        if not stripped:
            flush_paragraph(); flush_list()
            i += 1
            continue
        heading = re.match(r'^(#{1,4})\s+(.*)$', stripped)
        if heading:
            flush_paragraph(); flush_list()
            level = len(heading.group(1))
            heading_index += 1
            anchor = 'h-%d' % heading_index
            title = inline_md(heading.group(2))
            out.append('<h%d id="%s">%s</h%d>' % (level, anchor, title, level))
            if level in (2, 3):
                toc.append((level, anchor, re.sub(r'<[^>]+>', '', title)))
            i += 1
            continue
        image = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)\s*$', stripped)
        if image:
            flush_paragraph(); flush_list()
            alt, src = image.groups()
            width, height = image_size(src)
            out.append(
                '<figure class="example-figure"><a href="%s" target="_blank" rel="noopener" title="打开原尺寸图">'
                '<img loading="lazy" decoding="async" width="%d" height="%d" src="%s" alt="%s"></a>'
                '<figcaption>%s</figcaption></figure>' % (
                    html.escape(src, quote=True),
                    width,
                    height,
                    html.escape(src, quote=True),
                    html.escape(alt, quote=True),
                    inline_md(alt),
                )
            )
            i += 1
            continue
        if stripped.startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{3,}', lines[i + 1]):
            flush_paragraph(); flush_list()
            def parse_row(row):
                row = row.strip()
                if row.startswith('|'):
                    row = row[1:]
                if row.endswith('|'):
                    row = row[:-1]
                return [x.strip() for x in re.split(r'(?<!\\)\|', row)]
            headers = parse_row(lines[i])
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append(parse_row(lines[i]))
                i += 1
            out.append('<div class="table-wrap"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
                ''.join('<th>%s</th>' % inline_md(x) for x in headers),
                ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % inline_md(x) for x in row) for row in rows)
            ))
            continue
        unordered = re.match(r'^[-*]\s+(.*)$', stripped)
        ordered = re.match(r'^\d+[.)]\s+(.*)$', stripped)
        if unordered or ordered:
            flush_paragraph()
            kind = 'ol' if ordered else 'ul'
            if list_kind != kind:
                flush_list()
                list_kind = kind
            content = (ordered or unordered).group(1)
            if stripped.startswith('  - '):
                content = '· ' + content
            list_items.append(content)
            i += 1
            continue
        if stripped.startswith('> '):
            flush_paragraph(); flush_list()
            out.append('<blockquote>%s</blockquote>' % inline_md(stripped[2:]))
            i += 1
            continue
        if re.match(r'^---+$', stripped):
            flush_paragraph(); flush_list()
            out.append('<hr>')
            i += 1
            continue
        paragraph.append(stripped)
        i += 1
    flush_paragraph(); flush_list(); flush_code()

    toc_html = ''.join(
        '<a class="toc-l%d" href="#%s">%s</a>' % (level, anchor, html.escape(title))
        for level, anchor, title in toc
    )
    return '\n'.join(out), toc_html


HTML_CSS = r'''
:root{--bg:#0d131c;--panel:#141d29;--panel2:#182333;--text:#e8edf4;--muted:#9aabc0;--gold:#efb45b;--teal:#61c7bd;--line:#2a394b;--max:860px}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:radial-gradient(circle at 15% -10%,#2b2632 0,transparent 32%),var(--bg);color:var(--text);font:16px/1.78 "Noto Serif SC","Source Han Serif SC","Songti SC",serif}
a{color:var(--gold);text-decoration:none}a:hover{text-decoration:underline}a.anchor{display:block;height:0;scroll-margin-top:24px;visibility:hidden}.layout{display:grid;grid-template-columns:220px minmax(0,var(--max));gap:46px;justify-content:center;max-width:1280px;margin:0 auto;padding:28px}
aside{position:sticky;top:calc(var(--music-site-nav-height,46px) + 18px);align-self:start;max-height:calc(100vh - var(--music-site-nav-height,46px) - 36px);overflow:auto;background:transparent;border:0;border-top:1px solid var(--line);padding:13px 0 0;backdrop-filter:none}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:16px}.brand b{font:700 15px/1.2 ui-sans-serif,sans-serif;letter-spacing:.04em}.mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#f0bd6c,#8d6230);display:grid;place-items:center;color:#20180f;font:800 18px ui-sans-serif,sans-serif}
nav{display:flex;flex-direction:column;gap:5px}.toc-l2,.toc-l3{display:block;color:var(--muted);padding:4px 6px;border-radius:5px;font:13px/1.45 ui-sans-serif,sans-serif}.toc-l3{padding-left:18px;font-size:12px;opacity:.8}.toc-l2:hover,.toc-l3:hover{background:var(--panel2);color:var(--text);text-decoration:none}
.back{display:inline-block;margin-top:16px;font:12px ui-sans-serif,sans-serif;color:var(--teal)}
main{min-width:0;background:transparent;border:0;border-radius:0;padding:10px 0 80px;box-shadow:none}
h1,h2,h3,h4{font-family:"Noto Sans SC","Source Han Sans SC","Microsoft YaHei",sans-serif;line-height:1.35}h1{font-size:34px;margin:0 0 10px;background:linear-gradient(120deg,#fff,#f2c77d);-webkit-background-clip:text;background-clip:text;color:transparent}h2{font-size:25px;margin:54px 0 16px;padding-top:18px;border-top:1px solid var(--line)}h3{font-size:18px;margin:30px 0 10px;color:#f1d3a1}h4{font-size:15px;margin:24px 0 8px;color:var(--teal)}
p{margin:11px 0}.muted,blockquote{color:var(--muted)}blockquote{margin:16px 0;padding:4px 0 4px 14px;border-left:2px solid var(--gold);background:transparent}hr{border:0;border-top:1px solid var(--line);margin:34px 0}
code{font:0.88em/1.4 "Cascadia Code","SFMono-Regular",Consolas,monospace;background:#0a1018;border:1px solid #273546;border-radius:4px;padding:1px 5px;color:#f1c98f}
pre{background:#080d13;border:1px solid var(--line);border-radius:10px;padding:15px;overflow:auto}pre code{border:0;background:none;padding:0;color:#cfe0f2}
.table-wrap{overflow:auto;margin:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}table{border-collapse:collapse;width:100%;min-width:620px;font:13px/1.6 ui-sans-serif,"Microsoft YaHei",sans-serif}th,td{padding:9px 11px;border-bottom:1px solid var(--line);border-right:1px solid rgba(42,57,75,.55);vertical-align:top;text-align:left}th{background:transparent;color:#f2d5a4;position:sticky;top:var(--music-site-nav-height,46px)}tr:last-child td{border-bottom:0}td:last-child,th:last-child{border-right:0}tbody tr:nth-child(even){background:rgba(255,255,255,.012)}
.example-figure{margin:16px 0;padding:12px;background:#f7f4ed;border:1px solid #3a4b5e;border-radius:12px;break-inside:avoid;page-break-inside:avoid}.example-figure a{display:block;cursor:zoom-in}.example-figure img{display:block;width:100%;height:auto;background:#fff;border-radius:6px}.example-figure figcaption{margin-top:8px;color:#526173;font:12px/1.5 ui-sans-serif,"Microsoft YaHei",sans-serif;text-align:center}
ul,ol{padding-left:26px}li{margin:5px 0}.tag{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(97,199,189,.12);color:var(--teal);font:11px ui-sans-serif,sans-serif}
@media(max-width:900px){.layout{display:block;padding:12px}aside{position:relative;top:0;max-height:none;overflow:visible;margin-bottom:18px;padding-bottom:12px}.toc-l2{display:inline-block;margin:2px}.toc-l3{display:none}main{padding:15px 0 60px;border-radius:0}h1{font-size:27px}h2{font-size:22px}.example-figure{padding:7px;border-radius:8px}.example-figure figcaption{font-size:11px}}
@media print{aside{display:none}.layout{display:block;max-width:none;padding:0}main{border:0;box-shadow:none;background:#fff;color:#111;padding:0}h1,h2,h3,h4{color:#111;-webkit-text-fill-color:#111}a{color:#333}th{background:#eee;color:#111}.table-wrap{overflow:visible}table{min-width:0}body{background:#fff}.example-figure{background:#fff;border:1px solid #bbb;padding:4px}.example-figure img{max-height:245mm}.example-figure figcaption{color:#333}}
'''


def write_html(markdown, data):
    body, toc = md_to_html(markdown)
    visual_data = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    document = '''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>和声学理论手册 · Harmony Atlas</title><style>%s</style><link rel="stylesheet" href="manual-visuals.css"></head>
<body><div class="layout"><aside><div class="brand"><div class="mark">H</div><b>和声学理论手册</b></div><nav>%s</nav><a class="back" href="../app/index.html">← 返回推演台</a></aside><main>%s</main></div><script type="application/json" id="manual-visual-data">%s</script><script src="manual-visuals.js"></script></body></html>''' % (HTML_CSS, toc, body, visual_data)
    with open(MANUAL_HTML, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(document)


def write_source_js(source_map):
    payload = json.dumps({
        'version': source_map['version'],
        'note': source_map['note'],
        'claims': source_map['claims'],
        'bookProfiles': source_map['bookProfiles']
    }, ensure_ascii=False, separators=(',', ':'))
    text = '''/* Generated by tools/build_docs.py from evidence/source-map.json. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HarmonySources=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return %s;});\n''' % payload
    with open(SOURCE_JS, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)


def main():
    os.makedirs(DOCS, exist_ok=True)
    os.makedirs(EVIDENCE, exist_ok=True)
    data = run_export()
    source_map = read_json(SOURCE_JSON)
    books_meta = read_json(os.path.join(ROOT, 'corpus', 'books.json'))
    gallery = read_json(EXAMPLE_JSON)
    markdown, prose_entries = render_manual(data, source_map, books_meta, gallery)
    annotations = build_book_annotations(data, source_map, gallery, prose_entries)
    write_html(markdown, data)
    write_source_js(source_map)
    write_json(BOOK_ANNOTATIONS, annotations)
    print('manual markdown:', MANUAL_MD)
    print('manual html:    ', MANUAL_HTML)
    print('evidence js:    ', SOURCE_JS)
    print('book notes:     ', BOOK_ANNOTATIONS)
    print('claims=%d modes=%d routes=%d examples=%d' % (
        len(source_map['claims']), len(data['modes']), len(data['routes']), len(gallery['examples'])
    ))
    print('annotated pages=%d annotations=%d' % (
        sum(len(pages) for pages in annotations['books'].values()),
        sum(len(items) for pages in annotations['books'].values() for items in pages.values())
    ))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('build_docs failed:', exc, file=sys.stderr)
        raise
