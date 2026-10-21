#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "glossary", "terms.json");
const OUT = path.join(ROOT, "glossary", "index.html");

const THEME_INIT = `<script data-site-theme-init>(function(){var d=document.documentElement;var t='light';try{var s=localStorage.getItem('music-site-theme');if(s==='dark'||s==='light')t=s;}catch(e){}d.setAttribute('data-theme',t);d.style.colorScheme=t;var p=location.pathname;var section='glossary';if(p.indexOf('/harmony_atlas/docs/books/')>=0)section='harmony-books';else if(p.indexOf('/harmony_atlas/docs/')>=0)section='harmony-manual';else if(p.indexOf('/harmony_atlas/app/')>=0)section='harmony-app';else if(p.indexOf('/form_atlas/docs/books/')>=0)section='form-books';else if(p.indexOf('/form_atlas/docs/')>=0)section='form-manual';else if(p.indexOf('/form_atlas/app/')>=0)section='form-app';else if(p.indexOf('/orchestration_atlas/docs/books/')>=0)section='orchestration-books';else if(p.indexOf('/orchestration_atlas/docs/')>=0)section='orchestration-manual';else if(p.indexOf('/orchestration_atlas/app/')>=0)section='orchestration-app';else if(p.indexOf('/counterpoint_atlas/docs/books/')>=0)section='counterpoint-books';else if(p.indexOf('/counterpoint_atlas/docs/')>=0)section='counterpoint-manual';else if(p.indexOf('/counterpoint_atlas/tutorial/')>=0)section='counterpoint-tutorial';else if(p.indexOf('/counterpoint_atlas/app/')>=0)section='counterpoint-app';d.setAttribute('data-site-section',section);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0b1119':'#f5efe4');})();</script>`;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function loadData() {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const subjects = data.subjects;
  const terms = data.terms;
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const termIds = new Set();
  const groups = new Set(subjects.flatMap((subject) => subject.groups.map(([groupId]) => subject.id + "/" + groupId)));
  for (const term of terms) {
    if (termIds.has(term.id)) throw new Error("duplicate glossary id: " + term.id);
    termIds.add(term.id);
    if (!subjectIds.has(term.subject)) throw new Error("unknown glossary subject: " + term.subject);
    if (!groups.has(term.subject + "/" + term.group)) throw new Error("unknown glossary group: " + term.subject + "/" + term.group);
    if (!term.title || !term.definition) throw new Error("incomplete glossary term: " + term.id);
  }
  for (const term of terms) {
    const missing = (term.see || []).filter((id) => !termIds.has(id));
    if (missing.length) throw new Error("missing glossary reference " + term.id + " -> " + missing.join(", "));
  }
  for (const subject of subjects) {
    for (const [groupId] of subject.groups) {
      if (!terms.some((term) => term.subject === subject.id && term.group === groupId)) {
        throw new Error("empty glossary group: " + subject.id + "/" + groupId);
      }
    }
  }
  return data;
}

function renderTerm(term, titleById) {
  const meta = [];
  if (term.en) meta.push('<span class="term-en">' + esc(term.en) + "</span>");
  if (term.aliases && term.aliases.length) meta.push('<span class="term-aliases">另称：' + esc(term.aliases.join(" / ")) + "</span>");
  const note = term.note ? '<p class="term-note">' + esc(term.note) + "</p>" : "";
  const write = term.write ? '<p class="term-practice"><span class="term-label">写法</span>' + esc(term.write) + "</p>" : "";
  const check = term.check ? '<p class="term-check"><span class="term-label">检查</span>' + esc(term.check) + "</p>" : "";
  const example = term.case ? '<p class="term-example"><span class="term-label">例</span>' + esc(term.case) + "</p>" : "";
  const sources = term.sources && term.sources.length
    ? '<p class="term-sources"><span class="term-label">教材原页</span>' + term.sources.map((source) => {
      const title = source.title ? ' title="' + esc(source.title) + '"' : "";
      return '<a href="' + esc(source.href) + '"' + title + '>' + esc(source.label) + "</a>";
    }).join(" · ") + "</p>"
    : "";
  const see = term.see && term.see.length
    ? '<p class="term-see">另见：' + term.see.map((id) => '<a href="#' + esc(id) + '">' + esc(titleById[id]) + "</a>").join(" · ") + "</p>"
    : "";
  return '<article class="term-entry" id="' + esc(term.id) + '" data-subject="' + esc(term.subject) + '">'
    + '<div class="term-name"><h4>' + esc(term.title) + "</h4>" + meta.join("") + "</div>"
    + '<div class="term-copy"><p class="term-definition">' + esc(term.definition) + "</p>" + note + write + check + example + sources + see + "</div>"
    + "</article>";
}

function main() {
  const data = loadData();
  const subjects = data.subjects;
  const terms = data.terms;
  const titleById = Object.fromEntries(terms.map((term) => [term.id, term.title]));
  const counts = Object.fromEntries(subjects.map((subject) => [subject.id, terms.filter((term) => term.subject === subject.id).length]));
  const enrichedCount = terms.filter((term) => term.write || term.check || term.case).length;
  const sourceCount = terms.reduce((total, term) => total + ((term.sources || []).length), 0);

  const filters = ['<button type="button" data-subject-filter="all" aria-pressed="true">全部 ' + terms.length + "</button>"];
  const indexLinks = [];
  for (const subject of subjects) {
    indexLinks.push('<a href="#' + esc(subject.id) + '"><b>' + esc(subject.label) + "</b><span>" + esc(subject.en) + " · " + counts[subject.id] + " 条</span></a>");
    filters.push('<button type="button" data-subject-filter="' + esc(subject.id) + '" aria-pressed="false">' + esc(subject.label) + " " + counts[subject.id] + "</button>");
  }

  const sections = subjects.map((subject, subjectIndex) => {
    const subjectTerms = terms.filter((term) => term.subject === subject.id);
    const links = [];
    if (subject.tutorial) links.push('<a href="' + esc(subject.tutorial) + '">教程</a>');
    links.push('<a href="' + esc(subject.app) + '">推演台</a>');
    links.push('<a href="' + esc(subject.manual) + '">理论手册</a>');
    const groups = subject.groups.map(([groupId, groupLabel]) => {
      const groupTerms = subjectTerms.filter((term) => term.group === groupId);
      return '<section class="term-group" id="' + esc(subject.id) + "-" + esc(groupId) + '">'
        + '<div class="term-group-head"><h3>' + esc(groupLabel) + "</h3><span>" + groupTerms.length + " 条</span></div>"
        + '<div class="term-list">' + groupTerms.map((term) => renderTerm(term, titleById)).join("") + "</div></section>";
    });
    return '<section class="subject-section" id="' + esc(subject.id) + '" data-subject-section="' + esc(subject.id) + '">'
      + '<header class="subject-head"><div><p class="eyebrow">' + String(subjectIndex + 1).padStart(2, "0") + " / " + esc(subject.en.toUpperCase())
      + "</p><h2>" + esc(subject.label) + "</h2><p>" + esc(subject.description) + "</p></div>"
      + '<div class="subject-links">' + links.join("") + "</div></header>" + groups.join("") + "</section>";
  });

  const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b1119">
<meta name="description" content="音乐理论工作台全站名词解释：和声、曲式、配器与复调术语索引，含可执行写法、检查步骤、曲例与教材原页链接。">
<title>名词解释 · 音乐理论工作台</title>
${THEME_INIT}
<link rel="stylesheet" href="../site-theme.css" data-site-theme-css>
<link rel="stylesheet" href="glossary.css">
</head>
<body>
<a class="skip" href="#main">跳到主要内容</a>
<main id="main"><div class="wrap">
<header class="glossary-hero">
<p class="eyebrow">全站名词索引 · GLOSSARY</p>
<h1>名词解释</h1>
<p class="lead">${esc(data.scope)}。解释先给判别条件，再给可执行的写法与排错步骤；有教材原页的条目直接链到扫描页，有作品例证的条目写明段落、乐器与听感。</p>
<ul class="glossary-facts"><li><b>${subjects.length}</b> 个学科</li><li><b>${terms.length}</b> 条术语</li><li><b>${enrichedCount}</b> 条含写法或例证</li><li><b>${sourceCount}</b> 个教材链接</li><li>搜索按 / 聚焦</li></ul>
</header>
<section class="glossary-tools" aria-label="术语筛选">
<label class="term-search"><span>查找名词</span><input id="termSearch" type="search" placeholder="输入中文、英文、缩写或释义关键词…" autocomplete="off" aria-label="搜索术语"></label>
<div class="subject-filters" role="group" aria-label="按学科筛选">${filters.join("")}</div>
<p class="result-count" id="resultCount" aria-live="polite">显示 ${terms.length} / ${terms.length} 个词条</p>
</section>
<nav class="subject-index" aria-label="学科索引">${indexLinks.join("")}</nav>
${sections.join("")}
<footer class="glossary-footer"><p>收词范围：${esc(data.scope)}。教材链接打开该书的引用原页；页码标签优先显示印刷页，无印刷页信息时显示 PDF 物理页。具体和弦拼写、乐器音域与推演参数保留在各科工具中。</p></footer>
</div></main>
<script src="../site-nav.js" data-site-nav></script>
<script src="glossary.js"></script>
</body>
</html>
`;
  fs.writeFileSync(OUT, page, "utf8");
  console.log("glossary page: " + terms.length + " terms -> " + path.relative(ROOT, OUT));
}

main();
