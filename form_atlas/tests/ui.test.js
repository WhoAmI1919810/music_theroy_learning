"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app/css/style.css"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "app/js/app.js"), "utf8");
const nav = fs.readFileSync(path.resolve(ROOT, "../site-nav.js"), "utf8");
const home = fs.readFileSync(path.resolve(ROOT, "../index.html"), "utf8");

test("app is responsive and shares the fixed site navigation", () => {
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /data-site-nav/);
  assert.match(html, /data-site-theme-css/);
  assert.match(html, /data-site-theme-init/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.map-stage\{position:relative;overflow:auto/);
  assert.match(nav, /position:sticky/);
  assert.match(nav, /label: "曲式"/);
});

test("theory map, form strips, cases and source coverage are present", () => {
  assert.match(html, /id="conceptMap"/);
  assert.match(html, /id="mapDetail"/);
  assert.match(html, /id="formGrid"/);
  assert.match(html, /id="caseGrid"/);
  assert.match(html, /id="coverageTable"/);
  assert.match(html, /id="claimList"/);
  assert.match(js, /function renderStrip/);
  assert.match(js, /function showCase/);
  assert.match(js, /function renderSources/);
});

test("analysis canvas records evidence instead of pretending to generate a form", () => {
  assert.match(html, /id="analysisSteps"/);
  assert.match(html, /id="materialNotes"/);
  assert.match(html, /id="tonalNotes"/);
  assert.match(js, /form-atlas-analysis/);
  assert.ok(!/自动判曲式|一键生成曲式/.test(html + js));
});

test("home page exposes four systems and the form entry", () => {
  assert.match(home, /四套系统/);
  assert.match(home, /form_atlas\/app\//);
  assert.match(home, /曲式理论地图/);
  assert.match(home, /勋伯格《和声的结构功能》/);
});
