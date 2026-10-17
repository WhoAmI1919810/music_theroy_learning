const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const appJs = path.join(root, 'app', 'js');
const D = require(path.join(appJs, 'theory-data.js'));
const E = require(path.join(appJs, 'engine.js'));

const sourceMapPath = path.join(root, 'evidence', 'source-map.json');
const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
const galleryPath = path.join(root, 'evidence', 'example-gallery.json');
const gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf8'));
const bookAnnotationsPath = path.join(root, 'evidence', 'book-annotations.json');
const bookAnnotations = JSON.parse(fs.readFileSync(bookAnnotationsPath, 'utf8'));
const booksMeta = JSON.parse(fs.readFileSync(path.join(root, 'corpus', 'books.json'), 'utf8'));
const theoryIds = new Set(D.THEORY_MAP.map((node) => node.id));
const externalOutcomes = new Set([
  'analysis', 'chromaticMediant', 'filmMusic', 'jazz',
  'modalModulation', 'postTonal', 'tritoneSub'
]);

function normalized(text) {
  return text.replace(/\s+/g, '');
}

function allReverseAnnotations() {
  const rows = [];
  for (const [book, pages] of Object.entries(bookAnnotations.books)) {
    for (const [page, items] of Object.entries(pages)) {
      for (const item of items) rows.push({ ...item, book, page: Number(page) });
    }
  }
  return rows;
}

function ocrPageCache() {
  const pagesByBook = new Map();
  return function getPage(book, page) {
    if (!pagesByBook.has(book)) {
      const file = path.join(root, 'corpus', 'ocr', book + '.jsonl');
      assert.ok(fs.existsSync(file), 'missing OCR file for ' + book);
      const pages = new Map();
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        if (row.page != null) pages.set(row.page, row.text || '');
      }
      pagesByBook.set(book, pages);
    }
    return pagesByBook.get(book).get(page);
  };
}

test('generates modulation routes for all sixteen target modes without crashing', () => {
  const targetTonics = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db',
    'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A'];
  assert.equal(D.MODES.length, 16);
  for (let index = 0; index < D.MODES.length; index += 1) {
    const mode = D.MODES[index];
    const routes = E.modulationRoutes('C', 'major', targetTonics[index], mode.id, { limit: 3 });
    assert.ok(Array.isArray(routes), 'routes should be an array for ' + mode.id);
    assert.ok(routes.length > 0, 'routes should not be empty for ' + mode.id);
    for (const route of routes) {
      assert.ok(Array.isArray(route.steps) && route.steps.length > 0,
        'route should contain steps for ' + mode.id);
    }
  }
});

test('matches the published archive manifest without raw PDFs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'public-deploy.json'), 'utf8'));
  assert.equal(manifest.mode, 'public-deploy');
  assert.equal(manifest.bookCount, 15);
  assert.equal(manifest.pageCount, 194);
  assert.equal(manifest.books.length, manifest.bookCount);

  const manual = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  const linkedPages = new Map();
  for (const match of manual.matchAll(/href="books\/([^"#]+)\.html#([^"]+)"/g)) {
    const page = match[2].match(/p(\d{4})/);
    if (!page) continue;
    if (!linkedPages.has(match[1])) linkedPages.set(match[1], new Set());
    linkedPages.get(match[1]).add(Number(page[1]));
  }

  for (const book of manifest.books) {
    const archiveFile = path.join(root, book.html);
    assert.ok(fs.existsSync(archiveFile), 'missing published archive ' + book.html);
    const document = fs.readFileSync(archiveFile, 'utf8');
    const pages = [...document.matchAll(/<section class="book-page" id="p(\d{4})"/g)]
      .map((match) => Number(match[1]));
    assert.deepEqual(pages, book.pages, book.id + ' published page list mismatch');

    const expected = linkedPages.get(book.id);
    assert.ok(expected, book.id + ' is not linked from the manual');
    assert.equal(expected.size, pages.length, book.id + ' manual citation count mismatch');
    for (const page of pages) {
      assert.ok(expected.has(page), book.id + ' page ' + page + ' is not cited by the manual');
      const tag = 'p' + String(page).padStart(4, '0');
      assert.ok(fs.existsSync(path.join(root, 'docs', 'assets', 'books', book.id, tag + '.jpg')),
        book.id + ' page ' + page + ' is missing its image');
    }
  }
});

test('keeps the theory graph a valid acyclic node network', () => {
  assert.equal(D.THEORY_MAP.length, 28);
  assert.equal(theoryIds.size, D.THEORY_MAP.length);
  const byId = new Map(D.THEORY_MAP.map((node) => [node.id, node]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) assert.fail('cycle detected at ' + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of byId.get(id).prerequisites) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  }
  for (const node of D.THEORY_MAP) {
    assert.ok(Number.isInteger(node.layer) && node.layer >= 0);
    for (const prerequisite of node.prerequisites) {
      assert.ok(theoryIds.has(prerequisite), node.id + ' has unknown prerequisite ' + prerequisite);
      assert.ok(byId.get(prerequisite).layer <= node.layer,
        node.id + ' must follow prerequisite layer for ' + prerequisite);
    }
    for (const outcome of node.enables) {
      assert.ok(theoryIds.has(outcome) || externalOutcomes.has(outcome),
        node.id + ' enables unknown outcome ' + outcome);
    }
    visit(node.id);
  }
});

test('classifies the corpus into three overlapping historical periods', () => {
  assert.deepEqual(D.PERIODS.map((period) => period.id),
    ['commonPractice', 'expandedTonality', 'modernPostTonal']);
  const nodeIds = new Set(D.THEORY_MAP.map((node) => node.id));
  const bookIds = new Set(D.TEXTBOOKS.map((book) => book.id));
  const profiles = new Map(sourceMap.bookProfiles.map((profile) => [profile.book, profile]));
  const getPage = ocrPageCache();
  for (const period of D.PERIODS) {
    assert.ok(period.name && period.span && period.tagline);
    for (const id of period.nodes) assert.ok(nodeIds.has(id), period.id + ' has unknown node ' + id);
    for (const id of period.books) assert.ok(bookIds.has(id), period.id + ' has unknown book ' + id);
    assert.ok(Array.isArray(period.basis) && period.basis.length > 0,
      period.id + ' needs a historical source basis');
    for (const ref of period.basis) {
      const profile = profiles.get(ref.book);
      assert.ok(profile, period.id + ' cites book without a profile: ' + ref.book);
      assert.ok(Number.isInteger(ref.page) && ref.page >= 1 && ref.page <= profile.pages,
        period.id + ' cites page outside ' + ref.book);
      const text = getPage(ref.book, ref.page);
      assert.ok(normalized(text).includes(normalized(ref.quote)),
        period.id + ' quote not found on ' + ref.book + ':' + ref.page);
    }
  }
  assert.equal(new Set(D.PERIODS.flatMap((period) => period.nodes)).size, D.THEORY_MAP.length);
  assert.equal(new Set(D.PERIODS.flatMap((period) => period.books)).size, D.TEXTBOOKS.length);
});

test('curates twenty-four concise examples balanced across the three periods', () => {
  assert.equal(gallery.version, 1);
  assert.deepEqual(gallery.stageOrder,
    ['commonPractice', 'expandedTonality', 'modernPostTonal']);
  assert.equal(gallery.examples.length, 24);
  assert.equal(new Set(gallery.examples.map((item) => item.id)).size, 24);
  const stageCounts = Object.fromEntries(gallery.stageOrder.map((stage) => [stage, 0]));
  const bookIds = new Set(booksMeta.books.map((book) => book.id));
  const usedBooks = new Set();
  for (const item of gallery.examples) {
    assert.match(item.id, /^[CEM][0-9]{2}$/);
    assert.ok(Object.hasOwn(stageCounts, item.stage), item.id + ' has unknown stage');
    assert.equal(item.id[0], { commonPractice: 'C', expandedTonality: 'E', modernPostTonal: 'M' }[item.stage],
      item.id + ' does not match its stage prefix');
    stageCounts[item.stage] += 1;
    assert.ok(['repertoire', 'textbookModel'].includes(item.kind), item.id + ' has invalid kind');
    assert.ok(bookIds.has(item.book), item.id + ' has unknown book');
    usedBooks.add(item.book);
    for (const field of ['title', 'work', 'exampleLabel', 'bookPoint', 'lever', 'reading', 'use']) {
      assert.ok(typeof item[field] === 'string' && item[field].trim(), item.id + ' needs ' + field);
    }
    for (const field of ['bookPoint', 'lever', 'reading', 'use']) {
      assert.ok(item[field].length <= 80, item.id + ' ' + field + ' is too long for a lever card');
    }
    assert.ok(Array.isArray(item.nodes) && item.nodes.length > 0, item.id + ' needs theory nodes');
    for (const node of item.nodes) assert.ok(theoryIds.has(node), item.id + ' has unknown node ' + node);
    assert.equal(item.image, 'assets/examples/' + item.id + '.jpg');
    assert.ok(Array.isArray(item.crop) && item.crop.length === 4);
    assert.ok(item.crop.every((value) => typeof value === 'number' && value >= 0 && value <= 1));
    assert.ok(item.crop[0] < item.crop[2] && item.crop[1] < item.crop[3]);
  }
  for (const stage of gallery.stageOrder) {
    assert.equal(stageCounts[stage], 8, stage + ' should have eight examples');
    assert.ok(gallery.stageNotes[stage], stage + ' needs a short reading note');
  }
  assert.ok(usedBooks.size >= 10, 'gallery should span at least ten textbooks');
});

test('verifies every gallery page, OCR needle, and rendered image asset', () => {
  const books = new Map(booksMeta.books.map((book) => [book.id, book]));
  const getPage = ocrPageCache();
  for (const item of gallery.examples) {
    const book = books.get(item.book);
    assert.ok(Number.isInteger(item.page) && item.page >= 1 && item.page <= book.pages,
      item.id + ' cites a page outside ' + item.book);
    if (item.pageEnd != null) {
      assert.ok(Number.isInteger(item.pageEnd) && item.pageEnd >= item.page && item.pageEnd <= book.pages,
        item.id + ' has an invalid pageEnd');
    }
    const text = getPage(item.book, item.page);
    assert.ok(typeof text === 'string', item.id + ' cites missing OCR page');
    assert.ok(normalized(text).includes(normalized(item.ocrNeedle)),
      item.id + ' OCR needle not found on ' + item.book + ':' + item.page);
    const image = path.join(root, 'docs', item.image);
    assert.ok(fs.existsSync(image), item.id + ' image is missing');
    assert.ok(fs.statSync(image).size > 20 * 1024, item.id + ' image is too small');
  }
});

test('maps every theory node to at least one direct source claim', () => {
  assert.ok(sourceMap.claims.length >= 64);
  assert.ok(Array.isArray(sourceMap.bookProfiles));
  assert.equal(new Set(sourceMap.claims.map((claim) => claim.id)).size, sourceMap.claims.length);
  assert.equal(new Set(sourceMap.bookProfiles.map((profile) => profile.book)).size,
    sourceMap.bookProfiles.length);
  assert.equal(sourceMap.bookProfiles.length, D.TEXTBOOKS.length);
  assert.equal(new Set(sourceMap.bookProfiles.map((profile) => profile.book)).size,
    new Set(D.TEXTBOOKS.map((book) => book.id)).size);
  for (const claim of sourceMap.claims) {
    assert.ok(theoryIds.has(claim.node), 'unknown evidence node ' + claim.node);
    assert.equal(claim.confidence, 'direct');
    assert.ok(Array.isArray(claim.books) && claim.books.length > 0);
  }
  for (const node of D.THEORY_MAP) {
    assert.ok(sourceMap.claims.some((claim) => claim.node === node.id),
      'missing direct evidence for node ' + node.id);
  }
});

test('gives every theory node principle, operations, applications, and named sources', () => {
  for (const node of D.THEORY_MAP) {
    assert.ok(node.principle && node.principle.trim(), node.id + ' needs a principle');
    assert.ok(Array.isArray(node.operations) && node.operations.length > 0,
      node.id + ' needs at least one operation');
    assert.ok(Array.isArray(node.applications) && node.applications.length > 0,
      node.id + ' needs at least one application');
    assert.ok(Array.isArray(node.sources) && node.sources.length > 0,
      node.id + ' needs at least one source label');
  }
});

test('cites every unique textbook in at least one direct claim', () => {
  const citedBooks = new Set();
  for (const claim of sourceMap.claims) {
    for (const citation of claim.books) citedBooks.add(citation.book);
  }
  for (const profile of sourceMap.bookProfiles) {
    assert.ok(citedBooks.has(profile.book), 'no direct claim cites ' + profile.book);
  }
});

test('exports a per-mode workbench with concrete next steps and target reinterpretations', () => {
  const raw = execFileSync(process.execPath, [path.join(root, 'tools', 'export_docs_data.js')], {
    cwd: root, encoding: 'utf8'
  });
  const data = JSON.parse(raw);
  assert.equal(data.modeActions.length, D.MODES.length);
  const heptatonic = data.modeActions.filter((mode) => mode.heptatonic);
  assert.equal(heptatonic.length, 11);
  assert.equal(heptatonic.reduce((sum, mode) => sum + mode.chords.length, 0), 77);
  for (const mode of heptatonic) {
    assert.equal(mode.chords.length, 7, mode.id + ' should expose seven degree chords');
    assert.ok(mode.chords.some((chord) => chord.targets.length > 0),
      mode.id + ' should expose at least one cross-mode target');
    for (const chord of mode.chords) {
      assert.ok(chord.next.length > 0, mode.id + ' ' + chord.roman + ' needs a next-step option');
      assert.ok(chord.targets.every((target) => target.label && target.roman),
        mode.id + ' ' + chord.roman + ' has an incomplete target');
    }
  }
});

test('verifies every cited page and excerpt against merged OCR', () => {
  const getPage = ocrPageCache();
  const profiles = new Map(sourceMap.bookProfiles.map((profile) => [profile.book, profile]));
  for (const claim of sourceMap.claims) {
    for (const citation of claim.books) {
      const profile = profiles.get(citation.book);
      assert.ok(profile, 'missing book profile for ' + citation.book);
      assert.ok(Number.isInteger(citation.page) && citation.page >= 1 && citation.page <= profile.pages,
        claim.id + ' cites page outside ' + citation.book);
      const text = getPage(citation.book, citation.page);
      assert.ok(typeof text === 'string', claim.id + ' cites missing OCR page ' + citation.book + ':' + citation.page);
      assert.ok(normalized(text).includes(normalized(citation.quote)),
        claim.id + ' quote not found on ' + citation.book + ':' + citation.page);
    }
  }
});

test('keeps the browser evidence bundle synchronized with its JSON source', () => {
  const browserBundle = require(path.join(root, 'evidence', 'source-map.js'));
  assert.deepEqual(browserBundle, sourceMap);
});

test('renders twenty-four local figure cards with captions into the manual', () => {
  const manual = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  assert.equal((manual.match(/<figure class="example-figure">/g) || []).length, 24);
  assert.equal((manual.match(/<figcaption>/g) || []).length, 24);
  assert.ok(!/<img[^>]+src="https?:/i.test(manual), 'manual must not load remote images');
  const figurePattern = /<figure class="example-figure"><a[^>]+><img[^>]+width="(\d+)" height="(\d+)"[^>]+src="([^"]+)"[^>]*><\/a><figcaption>([^<]*)<\/figcaption><\/figure>/g;
  const rendered = [...manual.matchAll(figurePattern)];
  assert.equal(rendered.length, 24);
  const ids = new Set();
  for (const [, width, height, src, caption] of rendered) {
    assert.match(src, /^assets\/examples\/[CEM][0-9]{2}\.jpg$/);
    assert.ok(Number(width) > 0 && Number(height) > 0, 'figure must reserve its intrinsic size: ' + src);
    const imagePath = path.join(root, 'docs', src);
    assert.ok(fs.existsSync(imagePath), 'missing rendered figure image ' + src);
    assert.ok(fs.statSync(imagePath).size > 20 * 1024, 'rendered figure image too small ' + src);
    const id = path.basename(src, '.jpg');
    assert.ok(caption.includes(id), 'caption should identify ' + id);
    assert.ok(caption.includes('PDF p.'), 'caption should carry a source page for ' + id);
    assert.ok(!ids.has(id), 'duplicate figure ' + id);
    ids.add(id);
  }
  for (const stage of ['13.1 古典与共同实践', '13.2 调性扩张与半音化', '13.3 现代与后调性']) {
    assert.ok(manual.includes(stage), 'manual is missing ' + stage);
  }
  for (const id of gallery.examples.map((item) => item.id)) {
    assert.ok(ids.has(id), 'manual is missing ' + id);
  }
});

test('links every textbook citation to an exact quote anchor', () => {
  const manual = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  assert.ok(manual.includes('html{scroll-behavior:auto}'),
    'manual should jump immediately instead of smooth-scrolling across the whole atlas');
  assert.ok(manual.includes('href="books/index.html"'), 'manual needs a textbook-library link');
  assert.ok(fs.existsSync(path.join(root, 'docs', 'books', 'index.html')),
    'textbook-library index is missing');

  const pageHref = (book, page) => 'books/' + book + '.html#p' +
    String(page).padStart(4, '0');
  const refHref = (book, anchor) => 'books/' + book + '.html#' + anchor;
  const annotation = (book, page, kind, id, textNeedle) => {
    const items = (bookAnnotations.books[book] || {})[String(page)] || [];
    return items.find((item) => item.kind === kind && item.id === id &&
      (!textNeedle || item.text.includes(textNeedle)));
  };
  const expected = new Map();
  const expectPage = (book, page, label) => expected.set(pageHref(book, page), label);
  const expectRef = (book, anchor, label) => expected.set(refHref(book, anchor), label);

  for (const claim of sourceMap.claims) {
    for (const citation of claim.books) {
      const item = annotation(citation.book, citation.page, 'claim', claim.id);
      assert.ok(item, claim.id + ' is missing its exact page annotation');
      expectRef(citation.book, item.anchor, claim.id);
    }
  }
  for (const period of D.PERIODS) {
    for (const basis of period.basis) {
      const item = annotation(basis.book, basis.page, 'period', period.id, basis.quote);
      assert.ok(item, period.id + ' basis is missing its exact page annotation');
      expectRef(basis.book, item.anchor, period.id + ' basis');
    }
  }
  for (const item of gallery.examples) {
    const anno = annotation(item.book, item.page, 'example', item.id);
    assert.ok(anno, item.id + ' is missing its exact page annotation');
    expectRef(item.book, anno.anchor, item.id + ' gallery source');
  }
  for (const profile of sourceMap.bookProfiles) {
    for (const page of profile.keyPages) {
      expectPage(profile.book, page, profile.book + ' representative page');
    }
  }

  for (const [href, label] of expected) {
    assert.ok(manual.includes('href="' + href + '"'), label + ' is missing ' + href);
  }

  const documents = new Map();
  const renderedLinks = [...manual.matchAll(/href="(books\/[^"#]+\.html)#([^"]+)"/g)];
  assert.ok(renderedLinks.length >= expected.size, 'manual is missing textbook citations');
  for (const [, file, anchor] of renderedLinks) {
    const absolute = path.join(root, 'docs', file);
    assert.ok(fs.existsSync(absolute), 'missing textbook archive ' + file);
    if (!documents.has(file)) documents.set(file, fs.readFileSync(absolute, 'utf8'));
    assert.ok(documents.get(file).includes('id="' + anchor + '"'),
      file + ' is missing anchor ' + anchor);
  }
  assert.ok(manual.includes('href="books/tonal_20c_overview.html#ref-claim-dominant-tritone-resolution-p0230"'),
    'the manual should link the exact V7 tritone citation');
  assert.ok(manual.includes('href="books/sangtong_chromatic.html#ref-period-commonpractice-2-p0009"'),
    'the period table should link the exact stage citation');
  assert.ok(manual.includes('href="books/tonal_20c_overview.html#ref-example-c01-p0229"'),
    'the example gallery should link the exact example annotation');
});

test('keeps every published textbook archive anchor jump-ready', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'public-deploy.json'), 'utf8'));
  for (const book of manifest.books) {
    const document = fs.readFileSync(path.join(root, book.html), 'utf8');
    assert.ok(document.includes('html{scroll-behavior:auto}'),
      book.id + ' should jump immediately instead of smooth-scrolling across the whole PDF');
    const dimensioned = [...document.matchAll(
      /<img loading="lazy" decoding="async" width="\d+" height="\d+"/g
    )];
    assert.equal(dimensioned.length, book.pages.length,
      book.id + ' should reserve layout space for every published page image');
    for (const page of book.pages) {
      const tag = 'p' + String(page).padStart(4, '0');
      assert.ok(document.includes('<section class="book-page" id="' + tag + '">'),
        book.id + ' is missing page section ' + tag);
      assert.ok(document.includes('src="../assets/books/' + book.id + '/' + tag + '.jpg"'),
        book.id + ' is missing image source for ' + tag);
    }
  }
});

test('builds reverse references for every sourced manual entry', () => {
  const manual = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  const manualIds = new Set([...manual.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const profiles = new Map(sourceMap.bookProfiles.map((profile) => [profile.book, profile]));
  const rows = allReverseAnnotations();
  const has = (book, page, kind, id) => rows.some((item) =>
    item.book === book && item.page === page && item.kind === kind && item.id === id);

  for (const claim of sourceMap.claims) {
    for (const citation of claim.books) {
      assert.ok(has(citation.book, citation.page, 'claim', claim.id),
        claim.id + ' has no reverse reference on ' + citation.book + ':' + citation.page);
    }
  }
  for (const period of D.PERIODS) {
    for (const basis of period.basis) {
      assert.ok(has(basis.book, basis.page, 'period', period.id),
        period.id + ' basis has no reverse reference on ' + basis.book + ':' + basis.page);
    }
  }
  for (const item of gallery.examples) {
    const end = item.pageEnd || item.page;
    for (let page = item.page; page <= end; page += 1) {
      assert.ok(has(item.book, page, 'example', item.id),
        item.id + ' has no reverse reference on ' + item.book + ':' + page);
    }
  }
  for (const profile of sourceMap.bookProfiles) {
    for (const page of profile.keyPages) {
      assert.ok(has(profile.book, page, 'profile', 'profile-' + profile.book + '-p' +
        String(page).padStart(4, '0')), profile.book + ' representative page has no reverse reference');
    }
  }

  const manualPageLinks = new Set(
    [...manual.matchAll(/href="(books\/[a-z0-9_]+\.html#p\d{4})"/g)].map((match) => match[1])
  );
  for (const href of manualPageLinks) {
    const match = href.match(/^books\/([a-z0-9_]+)\.html#p(\d{4})$/);
    assert.ok(match, 'invalid manual page link ' + href);
    assert.ok(rows.some((item) => item.book === match[1] && item.page === Number(match[2])),
      'manual page link has no reverse annotation: ' + href);
  }

  const claimsById = new Map(sourceMap.claims.map((claim) => [claim.id, claim]));
  const examplesById = new Map(gallery.examples.map((item) => [item.id, item]));
  const periodsById = new Map(D.PERIODS.map((period) => [period.id, period]));
  const profilesByBook = new Map(sourceMap.bookProfiles.map((profile) => [profile.book, profile]));
  for (const item of rows) {
    if (item.kind === 'claim') {
      assert.ok(item.text.includes(claimsById.get(item.id).claim),
        item.id + ' reverse text should carry the distilled claim');
    } else if (item.kind === 'example') {
      const example = examplesById.get(item.id);
      for (const field of ['bookPoint', 'lever', 'reading', 'use']) {
        assert.ok(item.text.includes(example[field]),
          item.id + ' reverse text should carry example ' + field);
      }
    } else if (item.kind === 'period') {
      const period = periodsById.get(item.id);
      assert.ok(item.text.includes(period.tagline),
        item.id + ' reverse text should carry the period conclusion');
      assert.ok(period.basis.some((basis) => basis.book === item.book &&
        basis.page === item.page && item.text.includes(basis.quote)),
      item.id + ' reverse text should carry its source-page basis');
    } else if (item.kind === 'profile') {
      const profile = profilesByBook.get(item.book);
      assert.ok(item.text.includes(profile.role),
        item.book + ' reverse text should explain the profile role');
    }
  }

  const proseAnchors = new Set([...manual.matchAll(/<a class="anchor" id="(cite-[^"]+)"><\/a>/g)]
    .map((match) => match[1]));
  const proseRows = rows.filter((item) => item.kind === 'prose');
  assert.ok(proseAnchors.size > 0, 'the manual should contain prose citation anchors');
  assert.equal(proseRows.length, proseAnchors.size,
    'every prose citation anchor needs exactly one reverse reference');
  for (const item of proseRows) {
    assert.ok(proseAnchors.has(item.id), 'orphan reverse prose reference ' + item.id);
    assert.ok(manual.includes('id="' + item.id + '"'), 'missing prose anchor ' + item.id);
  }

  for (const item of rows) {
    const profile = profiles.get(item.book);
    assert.ok(profile, 'reverse reference cites unknown book ' + item.book);
    assert.ok(item.page >= 1 && item.page <= profile.pages,
      item.book + ' reverse reference page is outside the book');
    for (const field of ['kind', 'id', 'label', 'text', 'href']) {
      assert.ok(typeof item[field] === 'string' && item[field].trim(),
        item.book + ':' + item.page + ' reverse reference needs ' + field);
    }
    const prefix = '../和声学手册.html#';
    assert.ok(item.href.startsWith(prefix), 'reverse reference needs a manual link: ' + item.href);
    assert.ok(manualIds.has(item.href.slice(prefix.length)),
      'reverse reference targets a missing manual anchor: ' + item.href);
  }
});

test('renders reverse manual links on every published textbook page', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'public-deploy.json'), 'utf8'));
  for (const book of manifest.books) {
    const annotations = bookAnnotations.books[book.id] || {};
    const html = fs.readFileSync(path.join(root, book.html), 'utf8');
    for (const page of book.pages) {
      const tag = 'p' + String(page).padStart(4, '0');
      const items = annotations[String(page)] || [];
      assert.ok(items.length > 0, book.id + ':' + page + ' has no reverse references');
      const sectionMatch = html.match(new RegExp(
        '<section class="book-page" id="' + tag + '">([\\s\\S]*?)</section>'
      ));
      assert.ok(sectionMatch, book.id + ' is missing page section ' + tag);
      const section = sectionMatch[1];
      assert.ok(section.includes('id="manual-refs-' + tag + '"'),
        book.id + ':' + page + ' does not render manual references');
      assert.equal((section.match(/class="manual-ref-item"/g) || []).length, items.length,
        book.id + ':' + page + ' reverse-reference count mismatch');
      for (const item of items) {
        assert.ok(section.includes('href="' + item.href + '"'),
          book.id + ':' + page + ' is missing ' + item.href);
      }
    }
  }
});

test('keeps explanatory prose free of antithesis templates and named metaphors', () => {
  const antithesis = /不是[^。；\n]{0,80}而是|并非[^。；\n]{0,80}而是/;
  const metaphors = /一个中心，两种光照|两种光照|光照|支点|上膛|结账|迷路|照亮|钉住|色块|必须回家|音程账本|一转身|长出来|身份证|地板不动|换轨|远行|发牌|杠杆|缝线|出生证明|像[^。；\n]{0,20}(?:一样|似的)/;
  const check = (label, text) => {
    assert.ok(!antithesis.test(text), label + ' still uses an antithesis template');
    assert.ok(!metaphors.test(text), label + ' still uses an opaque metaphor');
  };

  for (const [stage, note] of Object.entries(gallery.stageNotes)) check('gallery stage ' + stage, note);
  for (const item of gallery.examples) {
    for (const field of ['title', 'bookPoint', 'lever', 'reading', 'use']) {
      check(item.id + ' ' + field, item[field]);
    }
  }
  for (const claim of sourceMap.claims) check(claim.id, claim.claim);
  for (const node of D.THEORY_MAP) {
    check(node.id + ' principle', node.principle);
    check(node.id + ' operations', node.operations.join('；'));
  }
  for (const period of D.PERIODS) {
    check(period.id + ' note', [period.tagline, period.note].filter(Boolean).join('；'));
  }

  const markdown = fs.readFileSync(path.join(root, 'docs', '和声学理论体系.md'), 'utf8');
  const prose = markdown
    .replace(/<!-- AUTO:[A-Z_]+:START -->[\s\S]*?<!-- AUTO:[A-Z_]+:END -->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '');
  check('manual prose', prose);

  const html = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  const renderedProse = html
    .replace(/<pre>[\s\S]*?<\/pre>/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  check('rendered manual prose', renderedProse);
});

test('keeps prose citations linked without dropping textbook names', () => {
  const markdown = fs.readFileSync(path.join(root, 'docs', '和声学理论体系.md'), 'utf8');
  const prose = markdown.replace(
    /<!-- AUTO:[A-Z_]+:START -->[\s\S]*?<!-- AUTO:[A-Z_]+:END -->/g,
    ''
  );
  assert.equal((prose.match(/PDF p\.\d+/g) || []).length, 0,
    'prose citations should link every PDF page');
  assert.ok(prose.includes(
    '柴可夫斯基《和声学指南》PDF [p.8](books/tchaikovsky_guide.html#ref-prose-cite-tchaikovsky_guide-p0008-1-p0008)'
  ), 'citation linking must preserve the textbook name');
});

test('puts eight testable principles and three stage-variable rows near the top', () => {
  const markdown = fs.readFileSync(path.join(root, 'docs', '和声学理论体系.md'), 'utf8');
  assert.ok(markdown.includes('### 0.3 八条硬原理'));
  assert.equal((markdown.match(/^\| [1-8] \| /gm) || []).length, 8,
    'the quick reference should contain exactly eight principles');
  assert.ok(markdown.includes('| 历史阶段 | 大致时间 | 新增的可控变量 | 和声结果 | 未改变的条件 |'),
    'the stage table should compare changed and unchanged conditions');
  for (const period of D.PERIODS) {
    assert.ok(period.changes.length >= 3, period.id + ' needs explicit changed variables');
    assert.ok(period.consequences.length >= 3, period.id + ' needs explicit harmonic consequences');
    assert.ok(period.unchanged.length >= 3, period.id + ' needs explicit unchanged conditions');
  }
  assert.ok(!markdown.includes('支点'), 'example cards should use concrete mechanisms, not 支点');
});

test('keeps generated manual output free of internal build markers', () => {
  const manual = fs.readFileSync(path.join(root, 'docs', '和声学手册.html'), 'utf8');
  assert.ok(!manual.includes('AUTO:'));
  assert.ok(manual.includes('古典与共同实践'));
  assert.ok(manual.includes('现代与后调性'));
  assert.ok(manual.includes('华萃康'));
  assert.ok(manual.includes('无调性、泛调性和声技法'));
});
