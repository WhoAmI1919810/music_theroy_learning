/* Counterpoint Atlas UI. All calculations run in the browser. */
(function () {
  "use strict";

  const D = window.CP_THEORY;
  const E = window.CounterpointEngine;
  const L = window.CP_EVIDENCE || {};
  const $ = (selector, node) => (node || document).querySelector(selector);
  const $$ = (selector, node) => Array.from((node || document).querySelectorAll(selector));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));

  const TABS = ["periods", "species", "canon", "fugue", "checker"];
  const PERIOD_STEPS = {
    renaissance: [
      "先确认调式、固定调与终止音，不用功能和声反推。",
      "把每个强拍写成可解释的协和音程，再处理弱拍运动。",
      "逐对检查经过、辅助与延留，最后核对平行完全音程。"
    ],
    baroque: [
      "先写主题的调性轮廓与可辨认动机，再决定答题方式。",
      "用主属关系建立呈示部，用间插段完成调性过渡。",
      "逐段检查主题进入、低音功能与不协和解决。"
    ],
    romantic: [
      "先判断复调素材在整体曲式中承担什么结构功能。",
      "把可转位、卡农或赋格段放进主调织体，而不是孤立练习。",
      "用实际作品的半音语法复核声部解决，不机械套用严格规则。"
    ],
    modern: [
      "先定义音高集合、中心音或十二音排列。",
      "再定义音程等级、可接受的平行与不协和解决方式。",
      "最后检查线条辨识度、音区分离、节奏独立与整体结构。"
    ]
  };
  const TRANSFORM_LABELS = {
    none: "原形", inversion: "倒影", retrograde: "逆行", augmentation: "扩大时值"
  };
  const state = {
    activeTab: "periods",
    periodId: "renaissance",
    speciesId: "first",
    speciesResult: null,
    canonResult: null,
    fugueResult: null,
    checkerResult: null
  };

  let audioContext = null;

  function noteName(midi, preferFlats) {
    return midi == null ? "" : E.midiToName(midi, Boolean(preferFlats));
  }

  function firstEvidence(claimId) {
    const item = L[claimId];
    return item && item.citations && item.citations.length ? item.citations[0] : null;
  }

  function sourceChip(claimId, index) {
    const item = L[claimId];
    if (!item || !item.citations || !item.citations.length) return "";
    const citation = item.citations[index || 0];
    return '<a class="source-chip" href="' + esc(citation.href) + '" title="' + esc(citation.quote) + '">' +
      '<span>' + esc(citation.bookTitle) + "</span> p." + esc(citation.pdfPage) + "</a>";
  }

  function evidenceLinks(claimIds, compact) {
    const unique = Array.from(new Set(claimIds || []));
    const chips = unique.map((id) => {
      const item = L[id];
      if (!item) return "";
      return '<div class="evidence-item"><b>' + esc(item.title) + "</b>" +
        '<div class="evidence-chips">' + item.citations.map((citation, index) => sourceChip(id, index)).join("") + "</div></div>";
    }).filter(Boolean).join("");
    if (!chips) return "";
    return '<div class="evidence-links' + (compact ? " compact" : "") + '">' +
      '<div class="evidence-label">教材依据 · 点击进入对应页与论点</div>' + chips + "</div>";
  }

  function manualAnchorFor(claimIds) {
    for (const id of claimIds || []) {
      if (L[id] && L[id].manualAnchor) return L[id].manualAnchor;
    }
    return "periods";
  }

  function manualLink(claimIds, label) {
    const anchor = manualAnchorFor(claimIds);
    return '<a class="manual-link" href="../docs/复调音乐手册.html#' + esc(anchor) + '">' + esc(label || "回手册对应段") + "</a>";
  }

  function statusPill(node, text, tone) {
    if (!node) return;
    node.textContent = text;
    node.className = "status-pill" + (tone ? " " + tone : "");
  }

  function renderIssues(container, issues, emptyText) {
    if (!container) return;
    if (!issues || !issues.length) {
      container.innerHTML = '<div class="empty-state good">' + esc(emptyText || "未发现需要报告的问题。") + "</div>";
      return;
    }
    container.innerHTML = issues.map((issue) => {
      const severity = issue.severity || "info";
      const position = issue.label || (issue.position ? "第 " + issue.position + " 拍" : "全局");
      const voices = issue.voices && issue.voices.length ? issue.voices.join(" / ") : "";
      return '<article class="issue ' + esc(severity) + '">' +
        '<div class="issue-top"><span class="issue-dot"></span><b>' + esc(position) + "</b><span>" + esc(severityLabel(severity)) + "</span></div>" +
        "<p>" + esc(issue.message) + "</p>" +
        (voices || issue.detail ? '<div class="issue-meta">' + esc(voices) + (voices && issue.detail ? " · " : "") + esc(issue.detail || "") + "</div>" : "") +
        "</article>";
    }).join("");
  }

  function severityLabel(severity) {
    return severity === "error" ? "错误" : severity === "warning" ? "需复核" : severity === "ok" ? "通过" : "说明";
  }

  function renderSummary(container, summary) {
    if (!container) return;
    const tone = summary.errors ? "bad" : summary.warnings ? "warn" : "good";
    container.innerHTML = '<div class="summary-card ' + tone + '"><span>错误</span><b>' + summary.errors + '</b></div>' +
      '<div class="summary-card ' + (summary.warnings ? "warn" : "good") + '"><span>需复核</span><b>' + summary.warnings + '</b></div>' +
      '<div class="summary-card ' + tone + ' wide"><span>结论</span><b>' + esc(summary.status) + "</b></div>";
  }

  function renderScoreRows(container, rows, beatsPerBar, emptyText) {
    if (!container) return;
    const total = Math.max(0, ...rows.map((row) => row.marker ? row.marker.length : 0));
    if (!total) {
      container.innerHTML = '<div class="empty-state">' + esc(emptyText || "暂无内容。") + "</div>";
      return;
    }
    container.innerHTML = rows.map((row) => {
      const cells = Array.from({ length: total }, (_, index) => {
        const marker = row.marker && row.marker[index] != null ? row.marker[index] : "";
        const strong = index % beatsPerBar === 0;
        const bar = Math.floor(index / beatsPerBar) + 1;
        const beat = index % beatsPerBar + 1;
        const continuation = marker === "·";
        const rest = marker === "";
        return '<span class="beat' + (strong ? " strong" : "") + (continuation ? " continuation" : "") + (rest ? " rest" : "") +
          '" title="第 ' + bar + " 小节第 " + beat + ' 拍">' + esc(marker || (rest ? "·" : marker)) + "</span>";
      }).join("");
      return '<div class="score-row"><div class="voice-name">' + esc(row.name) + '</div><div class="beat-line">' + cells + "</div></div>";
    }).join("");
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playEvents(events, beatSeconds, wave) {
    const context = ensureAudio();
    if (!context || !events || !events.length) return;
    const start = context.currentTime + 0.06;
    const beat = beatSeconds || 0.22;
    let end = start;
    events.forEach((event) => {
      if (!Number.isFinite(event.midi)) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequency = 440 * Math.pow(2, (event.midi - 69) / 12);
      const at = start + event.start * beat;
      const duration = Math.max(0.12, event.duration * beat * 0.92);
      oscillator.type = wave || "triangle";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + Math.min(0.035, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      end = Math.max(end, at + duration);
    });
    return end;
  }

  function activateTab(name, updateHistory) {
    if (!TABS.includes(name)) name = "periods";
    state.activeTab = name;
    $$("#tabs .tab").forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === "panel-" + name));
    if (updateHistory !== false && window.location.hash !== "#" + name) {
      window.history.replaceState(null, "", "#" + name);
    }
    const activeButton = $('#tabs .tab[data-tab="' + name + '"]');
    if (activeButton && activeButton.scrollIntoView) {
      requestAnimationFrame(() => activeButton.scrollIntoView({ block: "nearest", inline: "center" }));
    }
  }

  function initTabs() {
    $$("#tabs .tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
    window.addEventListener("hashchange", () => activateTab(window.location.hash.slice(1), false));
    const initial = window.location.hash.slice(1);
    activateTab(TABS.includes(initial) ? initial : "periods", false);
  }

  function renderPeriods() {
    const tabs = $("#periodTabs");
    const detail = $("#periodDetail");
    const steps = $("#periodSteps");
    const evidence = $("#periodEvidence");
    if (!tabs || !detail) return;
    tabs.innerHTML = D.PERIODS.map((period) => {
      const active = period.id === state.periodId;
      return '<button class="timeline-item' + (active ? " active" : "") + '" type="button" role="tab" aria-selected="' + active +
        '" data-period="' + esc(period.id) + '"><span>' + esc(period.years) + "</span><b>" + esc(period.label) + "</b></button>";
    }).join("");
    $$("#periodTabs .timeline-item").forEach((button) => button.addEventListener("click", () => {
      state.periodId = button.dataset.period;
      renderPeriods();
    }));
    const period = D.PERIODS.find((item) => item.id === state.periodId) || D.PERIODS[0];
    detail.innerHTML = '<div class="period-title"><span class="period-years">' + esc(period.years) + '</span><h3>' + esc(period.label) +
      '</h3><p class="eyebrow">' + esc(period.eyebrow) + "</p></div>" +
      '<div class="period-block"><h4>当时要解决的问题</h4><p>' + esc(period.problem) + "</p></div>" +
      '<div class="period-block"><h4>规则为什么变了</h4><p>' + esc(period.shift) + "</p></div>" +
      '<div class="period-block"><h4>可操作的判断</h4><ul class="compact-list numbered">' + period.rules.map((rule) => "<li>" + esc(rule) + "</li>").join("") + "</ul></div>" +
      '<div class="period-block"><h4>成为结构手段的技法</h4><div class="tag-list">' + period.techniques.map((item) => '<span class="tag">' + esc(item) + "</span>").join("") + "</div></div>" +
      '<div class="caution"><b>边界</b><p>' + esc(period.caution) + "</p></div>" +
      evidenceLinks(period.claims, true) + manualLink(period.claims, "打开手册中的完整说明");
    if (steps) {
      steps.innerHTML = (PERIOD_STEPS[period.id] || []).map((step) => "<li>" + esc(step) + "</li>").join("");
    }
    if (evidence) evidence.innerHTML = '<b>引用跨度</b><p>' + period.claims.length + " 条论点，均可回到具体教材页。" + "</p>" + manualLink(period.claims, "手册对应章节");
  }

  function initSpecies() {
    const select = $("#cfSelect");
    if (!select) return;
    select.innerHTML = D.CF_PRESETS.map((preset) => '<option value="' + esc(preset.id) + '">' + esc(preset.label) + "</option>").join("");
    const buttons = $("#speciesButtons");
    buttons.innerHTML = D.SPECIES.map((species) => '<button type="button" class="segment' + (species.id === state.speciesId ? " active" : "") + '" data-species="' + esc(species.id) + '">' + esc(species.num) + "</button>").join("");
    $$("#speciesButtons .segment").forEach((button) => button.addEventListener("click", () => {
      state.speciesId = button.dataset.species;
      $$("#speciesButtons .segment").forEach((item) => item.classList.toggle("active", item === button));
      generateSpecies();
    }));
    $("#btnGenerateSpecies").addEventListener("click", generateSpecies);
    $("#btnPlaySpecies").addEventListener("click", () => {
      if (!state.speciesResult) return;
      playEvents(state.speciesResult.cfEvents.concat(state.speciesResult.cpEvents), 0.2, "triangle");
    });
    select.addEventListener("change", generateSpecies);
    generateSpecies();
  }

  function generateSpecies() {
    const species = D.SPECIES.find((item) => item.id === state.speciesId) || D.SPECIES[0];
    const presetId = $("#cfSelect") ? $("#cfSelect").value : D.CF_PRESETS[0].id;
    let result;
    try {
      result = E.generateSpecies(presetId, species.id);
    } catch (error) {
      renderIssues($("#speciesIssues"), [{ severity: "error", message: error.message, label: "生成失败" }]);
      return;
    }
    state.speciesResult = result;
    statusPill($("#speciesStatus"), result.diagnostics.summary.errors ? "有错误" : result.diagnostics.summary.warnings ? "需复核" : "规则通过", result.diagnostics.summary.errors ? "bad" : result.diagnostics.summary.warnings ? "warn" : "good");
    $("#speciesPrinciple").innerHTML = '<div class="principle-head"><span>' + esc(species.num) + '</span><h3>' + esc(species.title) + '</h3><code>' + esc(species.ratio) + "</code></div>" +
      '<p class="principle-rule">' + esc(species.rule) + "</p>" +
      '<div class="why-box"><b>为什么这样写</b><p>' + esc(species.why) + "</p></div>" +
      '<div class="rule-pair"><div><b>强拍</b><span>' + esc(species.strong) + '</span></div><div><b>弱拍</b><span>' + esc(species.weak) + "</span></div></div>" +
      '<div class="check-list"><b>交付前检查</b><ul>' + species.checks.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul></div>" +
      evidenceLinks(species.claims, true) + manualLink(species.claims, "手册中的本类完整规则");
    renderScoreRows($("#speciesScore"), [
      { name: "CF", marker: result.marker.cf },
      { name: "CP", marker: result.marker.cp }
    ], 4, "暂无对位骨架。");
    renderSummary($("#speciesSummary"), result.diagnostics.summary);
    renderIssues($("#speciesIssues"), result.diagnostics.issues, "固定调、强拍骨架与装饰音均通过当前规则。");
    $("#btnPlaySpecies").disabled = false;
  }

  function initCanon() {
    const presetSelect = $("#subjectPreset");
    const subjectInput = $("#canonSubject");
    if (!presetSelect || !subjectInput) return;
    presetSelect.innerHTML = D.SUBJECT_PRESETS.map((preset) => '<option value="' + esc(preset.id) + '">' + esc(preset.label) + "</option>").join("");
    subjectInput.value = D.SUBJECT_PRESETS[0].notes.join(" ");
    presetSelect.addEventListener("change", () => {
      const preset = D.SUBJECT_PRESETS.find((item) => item.id === presetSelect.value);
      if (preset) subjectInput.value = preset.notes.join(" ");
      generateCanon();
    });
    ["#canonDelay", "#canonInterval", "#canonTransform"].forEach((selector) => $(selector).addEventListener("change", generateCanon));
    $("#btnGenerateCanon").addEventListener("click", generateCanon);
    $("#btnPlayCanon").addEventListener("click", () => {
      if (state.canonResult) playEvents(state.canonResult.events, 0.22, "sine");
    });
    $("#canonSources").innerHTML = evidenceLinks(["canon.definition", "canon.process", "canon.interval-adjust", "canon.delay", "canon.overlap"], true);
    generateCanon();
  }

  function generateCanon() {
    const raw = $("#canonSubject") ? $("#canonSubject").value : "";
    const tokens = raw.split(/[\s,|]+/).filter(Boolean);
    const delay = Number($("#canonDelay").value);
    const interval = Number($("#canonInterval").value);
    const transform = $("#canonTransform").value;
    let result;
    try {
      result = E.generateCanon(tokens, { delay, interval, transform, duration: 1 });
    } catch (error) {
      renderIssues($("#canonIssues"), [{ severity: "error", label: "生成失败", message: error.message }]);
      return;
    }
    if (!result.subject.length) {
      renderIssues($("#canonIssues"), [{ severity: "error", label: "主句为空", message: "请输入至少三个可识别的音名或 MIDI 数字。" }]);
      return;
    }
    state.canonResult = result;
    const intervalLabel = $("#canonInterval").selectedOptions[0] ? $("#canonInterval").selectedOptions[0].textContent : String(interval);
    $("#canonMeta").textContent = "应句：" + (TRANSFORM_LABELS[transform] || transform) + " · " + intervalLabel + " · 延迟 " + delay + " 拍";
    renderScoreRows($("#canonScore"), [
      { name: "Dux 主句", marker: result.marker.dux },
      { name: "Comes 应句", marker: result.marker.comes }
    ], 4, "暂无可显示的卡农关系。");
    const summary = result.diagnostics.summary || { errors: 0, warnings: 0, status: "已生成" };
    renderSummary($("#canonSummary"), summary);
    renderIssues($("#canonIssues"), result.diagnostics.issues, "当前时间差与移位关系下，重叠声部未发现结构性冲突。");
    $("#btnPlayCanon").disabled = false;
  }

  function initFugue() {
    const keySelect = $("#fugueKey");
    if (!keySelect) return;
    keySelect.innerHTML = Object.keys(D.KEY_SIGNATURES).map((key) => '<option value="' + esc(key) + '">' + esc(key) + "</option>").join("");
    ["#fugueKey", "#fugueMode", "#fugueVoices", "#fugueAnswer", "#fugueSubject", "#fugueLayout"].forEach((selector) => {
      $(selector).addEventListener("change", planFugue);
    });
    $("#btnPlanFugue").addEventListener("click", planFugue);
    $("#fuguePrinciple").innerHTML = '<p class="eyebrow">先结构，后音符</p><h3>赋格骨架的五个判断</h3>' +
      '<div class="check-list"><ul>' +
      ["主题能否在转调、倒影与密接中保持可辨认？", "答题是真实移位还是需要守调调整？", "所有声部是否在主属范围完成进入？", "间插段是否真正承担转调与动力？", "再现是否回到主调并改变材料关系？"].map((item) => "<li>" + esc(item) + "</li>").join("") +
      "</ul></div>" + evidenceLinks(["fugue.subject-identity", "fugue.tonal-answer", "fugue.exposition-principles", "fugue.episode-function", "fugue.recap"], true) +
      manualLink(["fugue.overall"], "打开赋格章");
    planFugue();
  }

  function planFugue() {
    const settings = {
      key: $("#fugueKey").value,
      mode: $("#fugueMode").value,
      voices: Number($("#fugueVoices").value),
      answerType: $("#fugueAnswer").value,
      subjectType: $("#fugueSubject").value,
      layout: $("#fugueLayout").value
    };
    let result;
    try {
      result = E.planFugue(settings);
    } catch (error) {
      renderIssues($("#fugueIssues"), [{ severity: "error", label: "生成失败", message: error.message }]);
      return;
    }
    state.fugueResult = result;
    const preferFlats = /b/.test(settings.key) || settings.key === "F";
    $("#fugueMeta").textContent = result.subjectNames.length + " 音主题 · " + result.answerNames.length + " 音答题 · 约 " + result.bars + " 小节骨架";
    $("#fugueSubjectLine").innerHTML = '<div class="subject-line"><span class="subject-label">T</span><div class="subject-notes">' +
      result.subject.map((midi) => '<span class="subject-note">' + esc(noteName(midi, preferFlats)) + "</span>").join("") +
      '</div></div><div class="subject-line answer"><span class="subject-label">A</span><div class="subject-notes">' +
      result.answer.map((midi) => '<span class="subject-note">' + esc(noteName(midi, preferFlats)) + "</span>").join("") + "</div></div>";
    const totalBars = Math.max(1, ...result.sections.map((section) => section.end));
    $("#fugueChart").innerHTML = '<div class="chart-scale">' + result.sections.map((section) => {
      const span = Math.max(1, section.end - section.start + 1);
      const width = Math.max(5, span / totalBars * 100);
      const className = section.id.indexOf("stretto") === 0 ? "stretto" : section.id.indexOf("episode") === 0 ? "episode" : section.id.indexOf("middle") === 0 ? "middle" : section.id.indexOf("pedal") === 0 ? "pedal" : section.id.indexOf("recap") === 0 ? "recap" : "exposition";
      return '<div class="chart-part ' + className + '" style="flex:0 0 ' + width.toFixed(2) + '%" title="' + esc(section.note) + '"><b>' + esc(section.label) + "</b><span>" + section.start + "–" + section.end + "</span></div>";
    }).join("") + "</div>";
    const rows = result.entries.map((entry) => {
      const noteText = entry.notes && entry.notes.length ? entry.notes.slice(0, 6).map((midi) => noteName(midi, preferFlats)).join(" ") + (entry.notes.length > 6 ? "…" : "") : "—";
      return "<tr><td>" + esc(entry.section) + "</td><td>" + esc(entry.voice) + "</td><td>" + esc(entry.form) + "</td><td>" + esc(entry.key) + "</td><td>" + entry.bar + "</td><td>" + entry.beats + "</td><td class=note-cell>" + esc(noteText) + "</td></tr>";
    }).join("");
    $("#fugueTable").innerHTML = "<thead><tr><th>段落</th><th>声部</th><th>形式</th><th>调性</th><th>小节</th><th>拍数</th><th>音高轮廓</th></tr></thead><tbody>" + rows + "</tbody>";
    const issues = result.diagnostics.map((item, index) => Object.assign({ label: "结构检查", id: "fugue-check-" + index }, item));
    const errors = issues.filter((item) => item.severity === "error").length;
    const warnings = issues.filter((item) => item.severity === "warning").length;
    renderSummary($("#fugueSummary"), { errors, warnings, status: errors ? "需修改" : warnings ? "可生成，需复核" : "结构可用" });
    renderIssues($("#fugueIssues"), issues, "结构计划未发现硬性冲突。具体音高与纵向音程仍需逐段写作。");
    $("#fugueSubjectLine").setAttribute("aria-label", "主题与答题音高轮廓");
  }

  function initChecker() {
    const input = $("#checkerInput");
    if (!input) return;
    input.value = "S: " + D.CHECK_EXAMPLE.soprano + "\nA: " + D.CHECK_EXAMPLE.alto;
    $("#btnCheck").addEventListener("click", checkVoices);
    $("#btnLoadExample").addEventListener("click", () => {
      input.value = "S: " + D.CHECK_EXAMPLE.soprano + "\nA: " + D.CHECK_EXAMPLE.alto;
      checkVoices();
    });
  }

  function checkVoices() {
    const input = $("#checkerInput");
    const meter = Number($("#checkerMeter").value);
    const style = $("#checkerStyle").value;
    let result;
    try {
      result = E.analyzeCounterpoint(input.value, { beatsPerBar: meter, style });
    } catch (error) {
      renderIssues($("#checkerIssues"), [{ severity: "error", label: "输入错误", message: error.message }]);
      statusPill($("#checkerStatus"), "需修改", "bad");
      return;
    }
    state.checkerResult = result;
    const summary = result.summary;
    statusPill($("#checkerStatus"), summary.status, summary.errors ? "bad" : summary.warnings ? "warn" : "good");
    renderSummary($("#checkerSummary"), summary);
    renderIssues($("#checkerIssues"), result.issues, style === "strict" ? "当前示例未检出强拍不协和、平行五八度或声部交叉。" : "自由模式未检出结构性冲突。");
  }

  function init() {
    if (!D || !E) {
      document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">资源加载失败：请确认 theory-data.js、engine.js、evidence-links.js 与 app.js 均存在。</div>';
      return;
    }
    initTabs();
    renderPeriods();
    initSpecies();
    initCanon();
    initFugue();
    initChecker();
    const footer = $(".footer span");
    if (footer) footer.textContent = "复调推演台 · " + Object.keys(L).length + " 条论点可回查 · 规则筛选器，不冒充完整作曲";
  }

  init();
})();
