"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const books = JSON.parse(fs.readFileSync(path.join(ROOT, "corpus", "books.json"), "utf8"));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence", "sources.json"), "utf8"));
const deploy = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence", "public-deploy.json"), "utf8"));
const linkData = require("../app/data/evidence-links.js");

test("corpus counts the new fugue file and deduplicates the copied file", () => {
  assert.equal(books.fileCount, 19);
  assert.equal(books.independentBookCount, 18);
  assert.equal(books.books.length, 18);
  assert.equal(books.duplicates.length, 1);
  assert.equal(books.duplicates[0].file, "姚世泽 巴赫赋格曲的研究(1).pdf");
  assert.equal(books.duplicates[0].sha256, "F6D29DB848768D61C83E03D05BA19D2D34447D9D89F675BA850340ADBDCBCA6B");
  assert.ok(books.books.some((book) => book.id === "higgs" && book.file === "希格斯 赋格曲.PDF"));
});

test("every claim has a manual anchor, a valid cited book and a page in range", () => {
  assert.equal(sources.claims.length, 40);
  const ids = new Set();
  for (const claim of sources.claims) {
    assert.ok(claim.id && !ids.has(claim.id), "duplicate claim " + claim.id);
    ids.add(claim.id);
    assert.ok(claim.manualAnchor);
    assert.ok(claim.citations.length > 0);
    for (const citation of claim.citations) {
      const book = books.books.find((item) => item.id === citation.bookId);
      assert.ok(book, citation.bookId);
      assert.ok(citation.pdfPage >= 1 && citation.pdfPage <= book.pdfPages, claim.id);
      assert.ok(citation.quote && citation.quote.length > 3, claim.id);
    }
  }
});

test("deploy metadata matches the cited page inventory", () => {
  const pages = new Set();
  for (const claim of sources.claims) {
    for (const citation of claim.citations) pages.add(citation.bookId + ":" + citation.pdfPage);
  }
  assert.equal(deploy.citedPageCount, pages.size);
  assert.equal(deploy.claimCount, sources.claims.length);
  assert.equal(deploy.independentBookCount, 18);
  assert.equal(deploy.fileCount, 19);
});

test("all cited evidence pages, scan images and markdown sources exist", () => {
  const cited = new Map();
  for (const claim of sources.claims) {
    for (const citation of claim.citations) {
      if (!cited.has(citation.bookId)) cited.set(citation.bookId, new Set());
      cited.get(citation.bookId).add(citation.pdfPage);
    }
  }
  for (const [bookId, pages] of cited) {
    const htmlPath = path.join(ROOT, "docs", "books", bookId + ".html");
    const mdPath = path.join(ROOT, "docs", "books", bookId + ".md");
    assert.ok(fs.existsSync(htmlPath), htmlPath);
    assert.ok(fs.existsSync(mdPath), mdPath);
    const html = fs.readFileSync(htmlPath, "utf8");
    for (const page of pages) {
      const padded = String(page).padStart(4, "0");
      assert.ok(html.includes('id="p' + padded + '"'), bookId + " p" + page);
      const image = path.join(ROOT, "docs", "assets", "books", bookId, "p" + padded + ".jpg");
      assert.ok(fs.existsSync(image), image);
      assert.ok(fs.statSync(image).size > 1000, image);
    }
  }
});

test("book HTML exposes every claim anchor and the manual exposes every manual anchor", () => {
  const manual = fs.readFileSync(path.join(ROOT, "docs", "复调音乐手册.html"), "utf8");
  for (const claim of sources.claims) {
    const bookHtml = fs.readFileSync(path.join(ROOT, "docs", "books", claim.citations[0].bookId + ".html"), "utf8");
    assert.ok(bookHtml.includes('id="claim-' + claim.id + '"'), claim.id);
    assert.ok(manual.includes('id="' + claim.manualAnchor + '"'), claim.manualAnchor);
    assert.ok(manual.includes("claim-" + claim.id), claim.id);
  }
  assert.ok(manual.includes('id="refs"'));
  assert.ok(manual.length > 30000);
});

test("browser evidence data contains all claims and only existing targets", () => {
  assert.equal(Object.keys(linkData).length, 40);
  for (const claim of sources.claims) {
    const item = linkData[claim.id];
    assert.ok(item);
    assert.equal(item.citations.length, claim.citations.length);
    for (const citation of item.citations) {
      const target = path.resolve(ROOT, "app", citation.href.split("#")[0]);
      assert.ok(fs.existsSync(target), target);
    }
  }
});

test("evidence index and manual source are present", () => {
  const index = fs.readFileSync(path.join(ROOT, "docs", "books", "index.html"), "utf8");
  assert.ok(index.includes("18 本独立教材"));
  assert.ok(index.includes("19 个 PDF 文件"));
  assert.ok(fs.existsSync(path.join(ROOT, "docs", "复调音乐理论体系.md")));
});
