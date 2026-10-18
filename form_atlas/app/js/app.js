(function () {
  "use strict";

  const DATA = window.FORM_ATLAS || {};
  const books = DATA.books || [];
  const claims = DATA.claims || [];
  const nodes = DATA.nodes || [];
  const edges = DATA.edges || [];
  const layers = DATA.layers || [];
  const principles = DATA.principles || [];
  const forms = DATA.forms || [];
  const cases = DATA.cases || [];
  const analysisSteps = DATA.analysisSteps || [];

  const bookById = Object.fromEntries(books.map((book) => [book.id, book]));
  const claimById = Object.fromEntries(claims.map((claim) => [claim.id, claim]));
  const caseById = Object.fromEntries(cases.map((item) => [item.id, item]));
  const formById = Object.fromEntries(forms.map((item) => [item.id, item]));

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function padPage(page) {
    return String(Number(page)).padStart(4, "0");
  }

  function pageHref(bookId, page, ref) {
    const hash = ref ? "#" + ref : "#p" + padPage(page);
    return "../docs/books/" + encodeURIComponent(bookId) + ".html" + hash;
  }

  function pageImage(bookId, page) {
    return "../docs/assets/books/" + encodeURIComponent(bookId) + "/p" + padPage(page) + ".jpg";
  }

  function sourceLink(source, index) {
    const book = bookById[source.book];
    const title = book ? book.short || book.title : source.book;
    const label = source.label || title + " · PDF p." + source.page;
    return '<a class="source-link" href="' + pageHref(source.book, source.page, source.ref) + '"' +
      (index === 0 ? ' data-primary="true"' : '') + '>' + escapeHtml(label) + ' ↗</a>';
  }

  function claimSources(claimIds) {
    const seen = new Set();
    const out = [];
    (claimIds || []).forEach((claimId) => {
      const claim = claimById[claimId];
      if (!claim) return;
      (claim.books || []).forEach((source) => {
        const key = source.book + ":" + source.page;
        if (!seen.has(key)) { seen.add(key); out.push(source); }
      });
    });
    return out;
  }

  function segmentClass(role) {
    const value = String(role || "").toLowerCase();
    if (value === "a" || value === "statement" || value === "principal") return "a";
    if (value === "b" || value === "contrast" || value === "subordinate") return "b";
    if (value === "c" || value === "episode") return "c";
    if (value === "d" || value === "closing") return "d";
    if (value === "development" || value === "transition" || value === "dev") return "dev";
    return "neutral";
  }

  function renderStrip(segments, compact) {
    const list = segments || [];
    return '<div class="strip' + (compact ? "" : "") + '" role="img" aria-label="' +
      escapeHtml(list.map((segment) => segment.label).join(" — ")) + '">' +
      list.map((segment) => {
        const width = Math.max(6, Number(segment.weight || 1));
        return '<div class="strip-seg ' + segmentClass(segment.role) + '" style="flex:' + width + ' 1 0">' +
          '<b>' + escapeHtml(segment.label) + '</b>' +
          (segment.sub ? '<small>' + escapeHtml(segment.sub) + '</small>' : '') + '</div>';
      }).join("") + '</div>';
  }

  function renderFacts() {
    const pages = new Set();
    claims.forEach((claim) => (claim.books || []).forEach((source) => pages.add(source.book + ":" + source.page)));
    cases.forEach((item) => (item.sources || []).forEach((source) => pages.add(source.book + ":" + source.page)));
    const values = {
      books: books.length,
      claims: claims.length,
      pages: pages.size,
      forms: forms.length,
      cases: cases.length
    };
    $$('[data-count]').forEach((element) => {
      element.textContent = values[element.getAttribute('data-count')] || 0;
    });
  }

  function activatePanel(id, updateHash) {
    const available = $$('.tab').map((tab) => tab.dataset.tab);
    if (!available.includes(id)) id = available[0];
    $$('.tab').forEach((tab) => {
      const active = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });
    $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + id));
    if (updateHash !== false) {
      try { history.replaceState(null, '', '#' + id); } catch (error) {}
    }
  }

  function bindTabs() {
    const tabs = $$('.tab');
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activatePanel(tab.dataset.tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        tabs[next].focus();
        activatePanel(tabs[next].dataset.tab);
      });
    });
    activatePanel((location.hash || '#map').slice(1), false);
    window.addEventListener('hashchange', () => activatePanel((location.hash || '#map').slice(1), false));
  }

  function edgePath(from, to) {
    const x1 = Number(from.x), y1 = Number(from.y), x2 = Number(to.x), y2 = Number(to.y);
    if (Math.abs(y1 - y2) < 3) return 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2;
    const bend = Math.max(32, Math.abs(x2 - x1) * .34);
    return 'M' + x1 + ',' + y1 + ' C' + (x1 + bend) + ',' + y1 + ' ' + (x2 - bend) + ',' + y2 + ' ' + x2 + ',' + y2;
  }

  function renderMap() {
    const edgeBox = $('#mapEdges');
    const nodeBox = $('#mapNodes');
    const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
    edgeBox.innerHTML = edges.map((edge) => {
      const from = nodeById[edge.from], to = nodeById[edge.to];
      if (!from || !to) return '';
      const mx = (Number(from.x) + Number(to.x)) / 2;
      const my = (Number(from.y) + Number(to.y)) / 2 - 5;
      return '<g class="edge-group" data-from="' + edge.from + '" data-to="' + edge.to + '">' +
        '<path class="map-edge" d="' + edgePath(from, to) + '"></path>' +
        (edge.label ? '<text class="edge-label" x="' + mx + '" y="' + my + '" text-anchor="middle">' + escapeHtml(edge.label) + '</text>' : '') +
        '</g>';
    }).join('');
    nodeBox.innerHTML = nodes.map((node) => {
      const width = node.width || 142, height = node.height || 54;
      const x = Number(node.x) - width / 2, y = Number(node.y) - height / 2;
      return '<g class="map-node" data-node="' + node.id + '" data-layer="' + node.layer + '" tabindex="0" role="button" aria-label="' + escapeHtml(node.label + "：" + node.summary) + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="10"></rect>' +
        '<text x="' + (x + 12) + '" y="' + (y + 22) + '" font-size="14" font-weight="700">' + escapeHtml(node.label) + '</text>' +
        '<text class="node-en" x="' + (x + 12) + '" y="' + (y + 40) + '">' + escapeHtml(node.en || '') + '</text>' +
        '</g>';
    }).join('');
    $$('.map-node', nodeBox).forEach((element) => {
      element.addEventListener('click', () => selectNode(element.dataset.node));
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(element.dataset.node); }
      });
    });
    const filter = $('#layerFilter');
    filter.innerHTML = '<button class="chip active" type="button" data-layer="all">全部</button>' + layers.map((layer) =>
      '<button class="chip" type="button" data-layer="' + layer.id + '">' + escapeHtml(layer.label) + '</button>'
    ).join('');
    $$('.chip', filter).forEach((button) => button.addEventListener('click', () => filterMap(button.dataset.layer)));
    selectNode(nodes[0] && nodes[0].id, false);
  }

  function selectNode(nodeId, scroll) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    $$('.map-node').forEach((element) => element.classList.toggle('selected', element.dataset.node === nodeId));
    const caseLinks = (node.cases || []).map((id) => caseById[id]).filter(Boolean);
    const citationLinks = claimSources(node.claims || []).slice(0, 8).map((source, index) => sourceLink(source, index)).join('');
    $('#mapDetail').innerHTML = '<span class="en">' + escapeHtml(node.en || '') + '</span><h3>' + escapeHtml(node.label) + '</h3>' +
      '<p>' + escapeHtml(node.summary) + '</p>' +
      '<dl><dt>它回答</dt><dd>' + escapeHtml(node.question || '—') + '</dd>' +
      '<dt>判断条件</dt><dd>' + escapeHtml(node.test || '—') + '</dd>' +
      '<dt>常见误判</dt><dd>' + escapeHtml(node.error || '—') + '</dd></dl>' +
      (caseLinks.length ? '<div class="detail-links">' + caseLinks.map((item) => '<a href="#cases" data-case-jump="' + item.id + '">案例：' + escapeHtml(item.title) + '</a>').join('') + '</div>' : '') +
      (citationLinks ? '<div class="detail-links">' + citationLinks + '</div>' : '');
    $$('[data-case-jump]', $('#mapDetail')).forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      activatePanel('cases');
      showCase(link.dataset.caseJump, true);
    }));
    if (scroll !== false && window.innerWidth < 1030) $('#mapDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('#mapHint').textContent = node.label + ' · ' + (layers.find((layer) => layer.id === node.layer) || {}).label;
  }

  function filterMap(layerId) {
    $$('#layerFilter .chip').forEach((button) => button.classList.toggle('active', button.dataset.layer === layerId));
    $$('.map-node').forEach((element) => element.classList.toggle('muted', layerId !== 'all' && element.dataset.layer !== layerId));
    $$('.edge-group').forEach((element) => {
      const visible = layerId === 'all' || (nodes.find((node) => node.id === element.dataset.from) || {}).layer === layerId ||
        (nodes.find((node) => node.id === element.dataset.to) || {}).layer === layerId;
      element.classList.toggle('muted', !visible);
    });
  }

  function renderPrinciples() {
    $('#principleCards').innerHTML = principles.map((item) =>
      '<article class="power"><b>' + escapeHtml(item.label) + '</b><span>' + escapeHtml(item.operation) + '</span><small>' + escapeHtml(item.effect) + '</small></article>'
    ).join('');
  }

  function renderForms() {
    const filter = $('#formFilter');
    filter.innerHTML = '<button class="chip active" type="button" data-form-filter="all">全部</button>' + forms.map((form) =>
      '<button class="chip" type="button" data-form-filter="' + form.id + '">' + escapeHtml(form.short || form.label) + '</button>'
    ).join('');
    $$('.chip', filter).forEach((button) => button.addEventListener('click', () => filterForms(button.dataset.formFilter)));
    $('#formGrid').innerHTML = forms.map((form) =>
      '<article class="card form-card" data-form-card="' + form.id + '">' +
        '<span class="en">' + escapeHtml(form.en) + '</span><h3>' + escapeHtml(form.label) + '</h3>' +
        renderStrip(form.preview, true) +
        '<p>' + escapeHtml(form.definition) + '</p>' +
        '<button class="open-form" type="button" data-open-form="' + form.id + '">查看判定条件与案例</button>' +
      '</article>'
    ).join('');
    $$('[data-open-form]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.openForm, true)));
    showForm(forms[0] && forms[0].id, false);
  }

  function filterForms(formId) {
    $$('#formFilter .chip').forEach((button) => button.classList.toggle('active', button.dataset.formFilter === formId));
    $$('[data-form-card]').forEach((card) => { card.hidden = formId !== 'all' && card.dataset.formCard !== formId; });
    if (formId !== 'all') showForm(formId, false);
  }

  function showForm(formId, scroll) {
    const form = formById[formId];
    if (!form) return;
    const casesForForm = (form.cases || []).map((id) => caseById[id]).filter(Boolean);
    const sources = claimSources(form.claims || []).map((source, index) => sourceLink(source, index)).join('');
    const tonal = (form.tonality || []).map((step) => '<div class="tonal-step ' + (step.state || '') + '"><b>' + escapeHtml(step.label) + '</b><span>' + escapeHtml(step.note || '') + '</span></div>').join('');
    $('#formDetail').hidden = false;
    $('#formDetail').innerHTML = '<div class="form-detail-head"><div><span class="en">' + escapeHtml(form.en) + '</span><h2>' + escapeHtml(form.label) + '</h2></div><button class="close-detail" type="button" data-close-form>收起</button></div>' +
      '<div class="big-strip">' + renderStrip(form.structure) + '</div>' +
      '<div class="form-detail-grid"><div>' +
        '<div class="detail-block"><h4>定义</h4><p>' + escapeHtml(form.definition) + '</p></div>' +
        '<div class="detail-block" style="margin-top:11px"><h4>判定条件</h4><ul>' + (form.tests || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul></div>' +
        '<div class="detail-block" style="margin-top:11px"><h4>容易混淆</h4><ul>' + (form.errors || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul></div>' +
      '</div><div>' +
        '<div class="detail-block"><h4>调性与结构张力</h4><p>' + escapeHtml(form.tonalNote || '—') + '</p>' + (tonal ? '<div class="tonal-track">' + tonal + '</div>' : '') + '</div>' +
        (casesForForm.length ? '<div class="detail-block" style="margin-top:11px"><h4>对应案例</h4><ul>' + casesForForm.map((item) => '<li><a href="#cases" data-form-case="' + item.id + '">' + escapeHtml(item.composer + '《' + item.title + '》') + '</a></li>').join('') + '</ul></div>' : '') +
        (sources ? '<div class="detail-block" style="margin-top:11px"><h4>教材依据</h4><div class="case-sources">' + sources + '</div></div>' : '') +
      '</div></div>';
    $$('[data-form-case]', $('#formDetail')).forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault(); activatePanel('cases'); showCase(link.dataset.formCase, true);
    }));
    const close = $('[data-close-form]', $('#formDetail'));
    if (close) close.addEventListener('click', () => { $('#formDetail').hidden = true; });
    if (scroll) {
      activatePanel('forms');
      $('#formDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderCaseFilters() {
    const tools = $('.case-tools');
    forms.filter((form) => cases.some((item) => item.form === form.id)).forEach((form) => {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.dataset.caseFilter = form.id; chip.textContent = form.short || form.label;
      chip.addEventListener('click', () => filterCases(form.id));
      tools.appendChild(chip);
    });
    $('[data-case-filter="all"]').addEventListener('click', () => filterCases('all'));
    $('#caseSearch').addEventListener('input', updateCaseList);
  }

  let caseFilter = 'all';
  function filterCases(formId) {
    caseFilter = formId;
    $$('[data-case-filter]').forEach((button) => button.classList.toggle('active', button.dataset.caseFilter === formId));
    updateCaseList();
  }

  function updateCaseList() {
    const query = ($('#caseSearch').value || '').trim().toLowerCase();
    $$('.case-card').forEach((card) => {
      const item = caseById[card.dataset.case];
      const formMatch = caseFilter === 'all' || item.form === caseFilter;
      const haystack = [item.title, item.composer, item.work, formById[item.form] && formById[item.form].label].join(' ').toLowerCase();
      card.hidden = !formMatch || (query && !haystack.includes(query));
    });
  }

  function renderCases() {
    renderCaseFilters();
    $('#caseGrid').innerHTML = cases.map((item) => {
      const source = (item.sources || [])[0] || {};
      const form = formById[item.form];
      const image = item.image ? '../docs/assets/cases/' + item.image : pageImage(source.book, source.page);
      return '<article class="card case-card" data-case="' + item.id + '">' +
        '<div class="case-thumb"><img loading="lazy" decoding="async" src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.composer + '《' + item.title + '》教材页') + '"><span class="page-tag">PDF p.' + escapeHtml(source.page) + '</span></div>' +
        '<div class="case-body"><span class="kicker">' + escapeHtml(form ? form.label : item.formLabel || '') + '</span><h3>' + escapeHtml(item.composer + '《' + item.title + '》') + '</h3>' +
        '<p>' + escapeHtml(item.summary) + '</p>' +
        '<div class="case-actions"><button type="button" data-open-case="' + item.id + '">结构分析</button><a href="' + pageHref(source.book, source.page) + '">核对教材页 ↗</a></div></div>' +
        '</article>';
    }).join('');
    $$('[data-open-case]').forEach((button) => button.addEventListener('click', () => showCase(button.dataset.openCase, true)));
  }

  function showCase(caseId, scroll) {
    const item = caseById[caseId];
    if (!item) return;
    const source = (item.sources || [])[0] || {};
    const form = formById[item.form];
    const sources = (item.sources || []).map((entry, index) => sourceLink(entry, index)).join('');
    const tonal = (item.tonalPath || []).map((step) => '<div class="tonal-step ' + (step.state || '') + '"><b>' + escapeHtml(step.label) + '</b><span>' + escapeHtml(step.note || '') + '</span></div>').join('');
    const image = item.image ? '../docs/assets/cases/' + item.image : pageImage(source.book, source.page);
    $('#caseDetail').hidden = false;
    $('#caseDetail').innerHTML = '<div class="form-detail-head"><div><span class="en">' + escapeHtml(form ? form.en : '') + '</span><h2>' + escapeHtml(item.composer + '《' + item.title + '》') + '</h2><p style="margin:5px 0 0;color:var(--theme-muted);font-size:12px">' + escapeHtml(form ? form.label : '') + (item.work ? ' · ' + escapeHtml(item.work) : '') + '</p></div><button class="close-detail" type="button" data-close-case>收起</button></div>' +
      '<div class="big-strip">' + renderStrip(item.structure) + '</div>' +
      (tonal ? '<div class="tonal-track" aria-label="调性路径">' + tonal + '</div>' : '') +
      '<div class="case-detail-grid"><div><a class="case-score-link" href="' + pageHref(source.book, source.page) + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.composer + '《' + item.title + '》教材影印页') + '"><figcaption>教材影印 · ' + escapeHtml((bookById[source.book] || {}).short || source.book) + ' · PDF p.' + escapeHtml(source.page) + ' ↗</figcaption></a></div>' +
      '<div class="case-notes"><p>' + escapeHtml(item.analysis) + '</p><h4>听什么</h4><ul>' + (item.cues || []).map((cue) => '<li>' + escapeHtml(cue) + '</li>').join('') + '</ul>' +
      '<h4>教材依据</h4><div class="case-sources">' + sources + '</div>' +
      (item.relatedClaims && item.relatedClaims.length ? '<h4>对应理论</h4><div class="case-sources">' + item.relatedClaims.map((id) => claimById[id] ? '<a class="source-link" href="#sources" data-claim-jump="' + id + '">' + escapeHtml(claimById[id].short || claimById[id].topic) + '</a>' : '').join('') + '</div>' : '') +
      '</div></div>';
    $$('[data-close-case]', $('#caseDetail')).forEach((button) => button.addEventListener('click', () => { $('#caseDetail').hidden = true; }));
    $$('[data-claim-jump]', $('#caseDetail')).forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault(); activatePanel('sources');
      const target = document.getElementById(link.dataset.claimJump);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    if (scroll) {
      activatePanel('cases');
      $('#caseDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderSources() {
    $('#sourceGrid').innerHTML = books.map((book) => {
      const count = claims.reduce((total, claim) => total + (claim.books || []).filter((source) => source.book === book.id).length, 0);
      const caseCount = cases.reduce((total, item) => total + (item.sources || []).filter((source) => source.book === book.id).length, 0);
      return '<article class="card source-card"><h3>' + escapeHtml(book.title) + '</h3><div class="meta">' + escapeHtml(book.short || book.id) + ' · ' + book.pages + ' 页 · ' + count + ' 条论点引用 · ' + caseCount + ' 个案例页</div>' +
        '<p>' + escapeHtml(book.role) + '</p><div class="detail-links"><a href="../docs/books/' + encodeURIComponent(book.id) + '.html">引用页影印 ↗</a></div></article>';
    }).join('');
    const table = $('#coverageTable');
    const topicRows = DATA.coverageTopics || [];
    table.innerHTML = '<thead><tr><th>理论问题</th>' + books.map((book) => '<th title="' + escapeHtml(book.title) + '">' + escapeHtml(book.short || book.id) + '</th>').join('') + '</tr></thead><tbody>' +
      topicRows.map((topic) => {
        const refs = new Set(claims.filter((claim) => (topic.claims || []).includes(claim.id)).flatMap((claim) => (claim.books || []).map((source) => source.book)));
        return '<tr><td><a href="#topic-' + encodeURIComponent(topic.id) + '">' + escapeHtml(topic.label) + '</a></td>' + books.map((book) =>
          '<td class="' + (refs.has(book.id) ? 'yes' : 'no') + '">' + (refs.has(book.id) ? '●' : '—') + '</td>'
        ).join('') + '</tr>';
      }).join('') + '</tbody>';
    $('#claimList').innerHTML = claims.map((claim) =>
      '<article class="claim" id="' + escapeHtml(claim.id) + '" data-topic="' + escapeHtml((claim.topics || []).join(' ')) + '"><h3>' + escapeHtml(claim.topic) + '</h3><p class="statement">' + escapeHtml(claim.statement) + '</p>' +
      '<ul class="quote-list">' + (claim.books || []).map((source) => {
        const book = bookById[source.book] || { title: source.book };
        return '<li><blockquote>“' + escapeHtml(source.quote) + '”</blockquote><cite>' + escapeHtml(book.title) + ' · <a href="' + pageHref(source.book, source.page, source.ref) + '">PDF p.' + source.page + ' ↗</a></cite></li>';
      }).join('') + '</ul></article>'
    ).join('');
  }

  function loadAnalysis() {
    try { return JSON.parse(localStorage.getItem('form-atlas-analysis') || '{}'); } catch (error) { return {}; }
  }

  function saveAnalysis() {
    const payload = {};
    $$('[data-analysis-check]').forEach((input) => { payload[input.dataset.analysisCheck] = input.checked; });
    payload.workName = $('#workName').value;
    payload.provisionalForm = $('#provisionalForm').value;
    payload.materialNotes = $('#materialNotes').value;
    payload.tonalNotes = $('#tonalNotes').value;
    try { localStorage.setItem('form-atlas-analysis', JSON.stringify(payload)); } catch (error) {}
    updateAnalysisSummary();
  }

  function updateAnalysisSummary() {
    const all = $$('[data-analysis-check]');
    const checked = all.filter((input) => input.checked).length;
    const form = formById[$('#provisionalForm').value];
    const message = checked === 0 ? '尚未勾选检查项。' : checked < all.length ? '已完成 ' + checked + ' / ' + all.length + ' 项：继续补齐终止、调性与材料证据。' : '全部检查项已完成，可以形成分析报告。';
    $('#checkSummary').innerHTML = '<b>' + escapeHtml(form ? form.label : '未选择曲式') + '</b><br>' + escapeHtml(message);
  }

  function renderAnalysis() {
    $('#analysisSteps').innerHTML = analysisSteps.map((step) =>
      '<li class="analysis-step"><div><h3>' + escapeHtml(step.title) + '</h3><p>' + escapeHtml(step.detail) + '</p>' +
      '<label><input type="checkbox" data-analysis-check="' + step.id + '"><span>' + escapeHtml(step.check) + '</span></label></div></li>'
    ).join('');
    $('#provisionalForm').innerHTML = '<option value="">请选择</option>' + forms.map((form) => '<option value="' + form.id + '">' + escapeHtml(form.label) + '</option>').join('');
    const saved = loadAnalysis();
    $$('[data-analysis-check]').forEach((input) => { input.checked = Boolean(saved[input.dataset.analysisCheck]); input.addEventListener('change', saveAnalysis); });
    ['workName', 'materialNotes', 'tonalNotes'].forEach((id) => {
      $('#' + id).value = saved[id] || '';
      $('#' + id).addEventListener('input', saveAnalysis);
    });
    $('#provisionalForm').value = saved.provisionalForm || '';
    $('#provisionalForm').addEventListener('change', saveAnalysis);
    $('#clearAnalysis').addEventListener('click', () => {
      $$('[data-analysis-check]').forEach((input) => { input.checked = false; });
      ['workName', 'materialNotes', 'tonalNotes'].forEach((id) => { $('#' + id).value = ''; });
      $('#provisionalForm').value = '';
      saveAnalysis();
    });
    updateAnalysisSummary();
  }

  function init() {
    renderFacts();
    bindTabs();
    renderMap();
    renderPrinciples();
    renderForms();
    renderCases();
    renderSources();
    renderAnalysis();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
