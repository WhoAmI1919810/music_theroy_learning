const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sources = require(path.join(root, "app", "data", "sources.js"));
const theory = require(path.join(root, "app", "data", "theory-data.js"));
const mechanisms = require(path.join(root, "app", "data", "mechanisms.js"));

const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

test("every citation has a unique archive anchor", () => {
  for (const claim of sources.CLAIMS) {
    for (const citation of claim.citations) {
      const archiveFile = "docs/books/" + citation.book + ".html";
      assert.ok(exists(archiveFile), claim.id + " missing archive " + archiveFile);
      const archive = read(archiveFile);
      const anchor = "cite-" + claim.id + "-p" + String(citation.pdfPage).padStart(4, "0");
      assert.ok(archive.includes('id="' + anchor + '"'), claim.id + " missing anchor " + anchor);
    }
  }
});

test("manual links point to claim-level anchors", () => {
  const manual = read("docs/配器法手册.html");
  for (const claim of sources.CLAIMS) {
    for (const citation of claim.citations) {
      const href = "books/" + citation.book + ".html#cite-" + claim.id +
        "-p" + String(citation.pdfPage).padStart(4, "0");
      assert.ok(manual.includes('href="' + href + '"'), claim.id + " missing manual link " + href);
    }
  }
});

test("every citation carries a chapter, page and quoted source", () => {
  for (const claim of sources.CLAIMS) {
    assert.ok(claim.citations.length > 0, claim.id + " has no citation");
    for (const citation of claim.citations) {
      assert.ok(citation.chapter && citation.chapter.trim(), claim.id + " missing chapter");
      assert.ok(citation.pdfPage > 0, claim.id + " missing PDF page");
      assert.ok(citation.quote && citation.quote.trim(), claim.id + " missing source quote");
    }
  }
});

test("mechanism evidence labels are explicit", () => {
  const validPeriods = new Set(["all", "classical", "expanded", "modern"]);
  for (const mechanism of mechanisms.MECHANISMS) {
    assert.ok(["direct", "derived"].includes(mechanism.evidence), mechanism.id + " has invalid evidence label");
    assert.ok(validPeriods.has(mechanism.period), mechanism.id + " has invalid period");
  }
});

test("every rendered page image exists", () => {
  for (const book of sources.BOOKS) {
    const file = "docs/books/" + book.id + ".html";
    if (!exists(file)) continue;
    const archive = read(file);
    const matches = [...archive.matchAll(/src="(\.\.\/assets\/sources\/[^"]+\.jpg)"/g)];
    for (const match of matches) {
      assert.ok(exists(path.join("docs", "books", match[1])), book.id + " broken image " + match[1]);
    }
  }
});

test("manual figures and images resolve locally", () => {
  const manual = read("docs/配器法手册.html");
  const sources = [...manual.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(sources.length >= 3, "manual should contain figures");
  for (const source of sources) {
    if (/^https?:/i.test(source)) continue;
    assert.ok(exists(path.join("docs", source)), "missing manual image " + source);
  }
  for (const figure of ["instrument-ranges.svg", "doubling-structure.svg", "transfer-overlap.svg"]) {
    assert.ok(manual.includes("assets/figures/" + figure), "manual missing figure " + figure);
  }
});

test("every mechanism has a crop for its first reference", () => {
  const manifestFile = "docs/assets/sources/snippets/manifest.json";
  assert.ok(exists(manifestFile), "missing snippet manifest");
  const manifest = JSON.parse(read(manifestFile));
  for (const mechanism of mechanisms.MECHANISMS) {
    const claim = sources.CLAIM_MAP[mechanism.claims[0]];
    assert.ok(claim, mechanism.id + " has no first claim");
    const citation = claim.citations[0];
    const key = claim.id + "|" + citation.book + "|" + citation.pdfPage;
    assert.ok(manifest[key], mechanism.id + " missing snippet " + key);
    assert.ok(exists(path.join("docs", manifest[key].path)), mechanism.id + " missing snippet file");
  }
});

test("manual uses current book and period wording", () => {
  const manual = read("docs/配器法手册.html");
  assert.ok(!/7 本教材|7 本配器法教材/.test(manual), "manual still counts books instead of volumes");
  assert.ok(!/1914|1918/.test(manual), "manual still contains obsolete period boundary");
  assert.ok(manual.includes("约 1820–1945"), "manual missing expanded-period range");
});

test("no page renders the same claim twice", () => {
  for (const book of sources.BOOKS) {
    const file = "docs/books/" + book.id + ".html";
    if (!exists(file)) continue;
    const archive = read(file);
    const pages = archive.split('<article class="book-page"').slice(1);
    for (const page of pages) {
      const pageMatch = page.match(/id="p(\d{4})"/);
      const ids = [...page.matchAll(/<li id="(cite-[^"]+)"/g)].map((match) => match[1]);
      assert.equal(new Set(ids).size, ids.length, book.id + " p." + (pageMatch && pageMatch[1]) + " repeats a claim");
    }
  }
});

test("historical periods are explicit and all claims exist", () => {
  assert.deepEqual(theory.PERIODS.map((period) => period.id), ["classical", "expanded", "modern"]);
  for (const period of theory.PERIODS) {
    assert.ok(period.range.includes("约"), period.id + " needs an approximate date range");
    assert.ok(period.changes.length >= 3, period.id + " needs concrete changes");
    for (const claimId of period.claims) {
      assert.ok(sources.CLAIM_MAP[claimId], period.id + " missing claim " + claimId);
    }
  }
});

test("author prose avoids antithesis templates and opaque metaphors", () => {
  const antithesis = /不是[^。；\n]{0,80}而是|并非[^。；\n]{0,80}而是/;
  const metaphors = /一个中心|两种光照|光照|上膛|结账|迷路|照亮|钉住|色块|必须回家|音程账本|一转身|长出来|身份证|地板不动|换轨|远行|发牌|杠杆|缝线|出生证明|骨架|像一个|仿佛|好比|犹如|接缝|厚度|呼吸点|色彩音|平衡\s*=\s*音区\s*×/;
  const check = (label, text) => {
    assert.ok(!antithesis.test(text), label + " still uses an antithesis template");
    assert.ok(!metaphors.test(text), label + " still uses an opaque metaphor");
  };

  for (const period of theory.PERIODS) {
    check(period.id + " summary", period.summary);
    check(period.id + " changes", period.changes.join("；"));
  }
  for (const node of theory.NODES) {
    check(node.id + " short", node.short);
    check(node.id + " principle", node.principle);
    check(node.id + " operation", node.operation.join("；"));
    check(node.id + " application", node.application);
    check(node.id + " failure", node.failure);
  }
  for (const mechanism of mechanisms.MECHANISMS) {
    for (const field of ["title", "principle", "check", "use", "limit"]) {
      check(mechanism.id + " " + field, mechanism[field]);
    }
  }
  for (const claim of sources.CLAIMS) check(claim.id + " claim", claim.claim);

  const markdown = read("docs/配器法理论体系.md")
    .replace(/<!-- AUTO:[A-Z_]+:START -->[\s\S]*?<!-- AUTO:[A-Z_]+:END -->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "");
  check("manual markdown", markdown);

  const html = read("docs/配器法手册.html")
    .replace(/<pre>[\s\S]*?<\/pre>/g, " ")
    .replace(/<code>[\s\S]*?<\/code>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  check("rendered manual", html);
});
