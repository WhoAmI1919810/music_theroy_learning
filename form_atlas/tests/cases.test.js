"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence/cases.json"), "utf8")).cases;
const books = JSON.parse(fs.readFileSync(path.join(ROOT, "corpus/books.json"), "utf8")).books;
const forms = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence/theory.json"), "utf8")).forms;

const bookById = Object.fromEntries(books.map((book) => [book.id, book]));
const formById = Object.fromEntries(forms.map((form) => [form.id, form]));

test("case library covers every core form with concrete works", () => {
  assert.ok(cases.length >= 16);
  const covered = new Set(cases.map((item) => item.form));
  for (const form of forms) {
    if (form.id === "cycle") continue;
    assert.ok(covered.has(form.id), "form has no case: " + form.id);
  }
});

test("case structures and tonal paths are diagram-ready", () => {
  for (const item of cases) {
    assert.ok(formById[item.form], "unknown form: " + item.id);
    assert.ok(item.structure.length >= 2, "structure too short: " + item.id);
    assert.ok(item.structure.every((segment) => segment.label && Number(segment.weight) > 0), "bad strip segment: " + item.id);
    assert.ok(item.analysis.length > 60, "analysis too thin: " + item.id);
    assert.ok(item.cues.length >= 2, "missing listening cues: " + item.id);
    assert.ok(item.tonalPath.length >= 2, "missing tonal path: " + item.id);
  }
});

test("case citations stay inside supplied textbook editions", () => {
  for (const item of cases) {
    assert.ok(item.sources.length >= 1, "missing textbook source: " + item.id);
    for (const source of item.sources) {
      const book = bookById[source.book];
      assert.ok(book, "unknown source book: " + source.book);
      assert.ok(Number.isInteger(source.page) && source.page >= 1 && source.page <= book.pages, "page outside book: " + item.id);
      assert.ok(source.label && source.label.trim(), "source label missing: " + item.id);
    }
  }
});

test("form pages reference only existing cases", () => {
  const ids = new Set(cases.map((item) => item.id));
  for (const form of forms) {
    for (const id of form.cases || []) assert.ok(ids.has(id), "form references missing case: " + id);
  }
});
