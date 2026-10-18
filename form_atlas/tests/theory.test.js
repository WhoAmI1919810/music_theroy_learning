"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const theory = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence/theory.json"), "utf8"));
const books = JSON.parse(fs.readFileSync(path.join(ROOT, "corpus/books.json"), "utf8")).books;
const sourceMap = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence/source-map.json"), "utf8"));

const bookIds = new Set(books.map((book) => book.id));
const claimIds = new Set(sourceMap.claims.map((claim) => claim.id));
const nodeIds = new Set(theory.nodes.map((node) => node.id));
const formIds = new Set(theory.forms.map((form) => form.id));

test("concept graph is connected to valid nodes", () => {
  assert.ok(theory.nodes.length >= 14, "expected a substantial concept map");
  assert.ok(theory.edges.length >= 18, "expected explicit relations between concepts");
  for (const edge of theory.edges) {
    assert.ok(nodeIds.has(edge.from), "unknown source node: " + edge.from);
    assert.ok(nodeIds.has(edge.to), "unknown target node: " + edge.to);
  }
  for (const node of theory.nodes) {
    assert.ok(theory.layers.some((layer) => layer.id === node.layer), "unknown layer: " + node.layer);
    assert.ok(node.summary && node.test && node.question && node.error, "incomplete node: " + node.id);
  }
});

test("every form has a testable definition, diagram and citations", () => {
  assert.equal(theory.forms.length, 10);
  for (const form of theory.forms) {
    assert.ok(form.definition.length > 30, "definition too thin: " + form.id);
    assert.ok(form.structure.length >= 1, "missing structure: " + form.id);
    assert.ok(form.tests.length >= 2, "missing boundary tests: " + form.id);
    assert.ok(form.errors.length >= 1, "missing common error: " + form.id);
    assert.ok(form.claims.length >= 1, "missing textbook claims: " + form.id);
    for (const claimId of form.claims) assert.ok(claimIds.has(claimId), "unknown claim: " + claimId);
  }
});

test("claims cite all provided books and never invent pages", () => {
  assert.ok(sourceMap.claims.length >= 14);
  const usedBooks = new Set();
  for (const claim of sourceMap.claims) {
    assert.ok(claim.books.length >= 2, "claim needs multiple textbook witnesses: " + claim.id);
    for (const source of claim.books) {
      const book = books.find((item) => item.id === source.book);
      assert.ok(book, "unknown book: " + source.book);
      assert.ok(Number.isInteger(source.page) && source.page >= 1 && source.page <= book.pages, "bad page: " + claim.id + " p." + source.page);
      assert.ok(source.quote && source.quote.trim().length >= 4, "missing direct quote: " + claim.id);
      usedBooks.add(source.book);
    }
  }
  for (const book of books) assert.ok(usedBooks.has(book.id), "textbook never cited: " + book.id);
});

test("analysis protocol checks material, closure, tonality and naming", () => {
  const text = theory.analysisSteps.map((step) => step.id + step.title + step.detail).join(" ");
  for (const token of ["材料", "终止", "调性", "层级", "命名"]) assert.ok(text.includes(token), "missing analysis dimension: " + token);
  assert.ok(theory.coverageTopics.length >= 10);
  for (const topic of theory.coverageTopics) {
    for (const claimId of topic.claims) assert.ok(claimIds.has(claimId), "coverage references unknown claim: " + claimId);
  }
});

test("book metadata uses real source PDF identities", () => {
  assert.equal(books.length, 7);
  assert.equal(new Set(books.map((book) => book.file)).size, books.length);
  for (const book of books) {
    assert.ok(book.pages > 100, "unexpected page count: " + book.id);
    assert.ok(book.role.length > 20, "missing role description: " + book.id);
  }
  assert.ok(bookIds.size === books.length);
  assert.ok(formIds.size === theory.forms.length);
});
