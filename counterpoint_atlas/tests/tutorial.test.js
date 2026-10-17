"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "tutorial", "index.html"), "utf8");

test("counterpoint tutorial exposes ten lessons and links to the tools", () => {
  for (let lesson = 1; lesson <= 10; lesson += 1) {
    assert.ok(html.includes('id="lesson-' + lesson + '"'), "lesson-" + lesson);
  }
  assert.equal((html.match(/class="lesson"/g) || []).length, 10);
  assert.ok(html.includes('href="../app/#species"'));
  assert.ok(html.includes('href="../app/#canon"'));
  assert.ok(html.includes('href="../app/#fugue"'));
  assert.ok(html.includes('href="../docs/复调音乐手册.html#invertible"'));
  assert.ok(html.includes('href="../docs/books/yang_species.html#claim-species.first-boundaries"'));
});

test("tutorial is reachable from the app, manual and evidence index", () => {
  const app = fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
  const manual = fs.readFileSync(path.join(ROOT, "docs", "复调音乐手册.html"), "utf8");
  const evidence = fs.readFileSync(path.join(ROOT, "docs", "books", "index.html"), "utf8");
  assert.ok(app.includes('href="../tutorial/"'));
  assert.ok(manual.includes('href="../tutorial/index.html"'));
  assert.ok(evidence.includes('href="../../tutorial/index.html"'));
});
