(function () {
  "use strict";

  const instrumentData = window.ORCH_INSTRUMENTS;
  const theory = window.ORCH_THEORY;
  const mechanismData = window.ORCH_MECHANISMS;
  const sourceData = window.ORCH_SOURCES;
  const engine = window.OrchestrationEngine;

  const { INSTRUMENTS, INSTRUMENT_MAP, ENSEMBLES, ROLE_LABELS, DYNAMIC_NAMES } = instrumentData;
  const { PERIODS, LAYERS, NODES, NODE_MAP, GOALS, PRESETS } = theory;
  const { MECHANISMS, MECHANISM_MAP } = mechanismData;
  const { BOOKS, BOOK_MAP, CLAIMS, CLAIM_MAP } = sourceData;

  const FAMILY_COLORS = {
    string: "#2c6c68", woodwind: "#b36b32", brass: "#9b5a24", percussion: "#8b7d49", key: "#6f6292"
  };
  const FAMILY_ORDER = ["string", "woodwind", "brass", "percussion", "key"];
  const FAMILY_LABELS = {
    string: "弦乐", woodwind: "木管", brass: "铜管", percussion: "打击乐", key: "竖琴/键盘"
  };
  const MANUAL_SHIFT_LABELS = { "-12": "低八度", "0": "同度", "12": "高八度" };

  const state = {
    activeTab: "overview",
    selectedPeriod: "classical",
    mapPeriod: "all",
    selectedNode: "spectrum",
    presetId: PRESETS[0].id,
    goal: PRESETS[0].goal,
    ensemble: PRESETS[0].ensemble,
    layers: clone(PRESETS[0].layers),
    selectedPlan: "clear",
    techniqueLayer: "all",
    techniquePeriod: "all",
    techniqueQuery: "",
    selectedBook: "all"
  };

  let analysis = null;
  let analyzeTimer = null;
  let mapResizeTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pageLabel(page) {
    return "PDF p." + page;
  }

  function archiveHref(bookId, page, claimId) {
    const anchor = claimId ? "cite-" + claimId + "-p" + String(page).padStart(4, "0") : "p" + String(page).padStart(4, "0");
    return "../docs/books/" + bookId + ".html#" + anchor;
  }

  function citationHref(citation) {
    return archiveHref(citation.book, citation.pdfPage, citation.claimId);
  }

  function snippetHref(citation) {
    return "../docs/assets/sources/snippets/" + citation.claimId + "-" + citation.book + "-p" + String(citation.pdfPage).padStart(4, "0") + ".jpg";
  }

  function pdfHref(bookId, page) {
    return "../pdf/" + bookId + "#page=" + page;
  }

  function claimsForMechanism(mechanism) {
    return mechanism.claims.map((claimId) => CLAIM_MAP[claimId]).filter(Boolean);
  }

  function citationsForClaims(claimIds) {
    const seen = new Set();
    const output = [];
    for (const claimId of claimIds) {
      const claim = CLAIM_MAP[claimId];
      if (!claim) continue;
      for (const citation of claim.citations) {
        const key = claimId + ":" + citation.book + ":" + citation.pdfPage;
        if (!seen.has(key)) {
          seen.add(key);
          output.push(Object.assign({ claimId }, citation));
        }
      }
    }
    return output;
  }

  function switchTab(tabId, updateHash) {
    state.activeTab = tabId;
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === "panel-" + tabId));
    if (updateHash !== false) history.replaceState(null, "", "#" + tabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (tabId === "map") {
      requestAnimationFrame(() => {
        drawMapEdges(NODES);
      });
    }
  }

  function initTabs() {
    document.getElementById("tabs").addEventListener("click", (event) => {
      const button = event.target.closest(".tab");
      if (button) switchTab(button.dataset.tab);
    });
    document.querySelectorAll("[data-jump]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.jump));
    });
    window.addEventListener("hashchange", () => {
      const requested = (location.hash || "").replace(/^#/, "");
      if (requested && document.getElementById("panel-" + requested)) {
        switchTab(requested, false);
      }
    });
  }

  function initHeader() {
    const ensembleSelect = document.getElementById("ensembleSelect");
    ensembleSelect.innerHTML = Object.entries(ENSEMBLES).map(([id, ensemble]) => '<option value="' + id + '">' + escapeHTML(ensemble.label) + "</option>").join("");
    ensembleSelect.value = state.ensemble;
    ensembleSelect.addEventListener("change", () => {
      state.ensemble = ensembleSelect.value;
      renderLayerEditor();
      analyzeNow();
    });

    const goalSelect = document.getElementById("goalSelect");
    goalSelect.innerHTML = Object.entries(GOALS).map(([id, goal]) => '<option value="' + id + '">' + escapeHTML(goal.label) + "</option>").join("");
    goalSelect.value = state.goal;
    goalSelect.addEventListener("change", () => {
      state.goal = goalSelect.value;
      analyzeNow();
    });
  }

  function renderOverview() {
    const timeline = document.getElementById("periodTimeline");
    timeline.innerHTML = PERIODS.map((period) =>
      '<button class="period-card' + (period.id === state.selectedPeriod ? " active" : "") + '" type="button" data-period="' + period.id + '">' +
        "<b>" + escapeHTML(period.label) + "</b><span>" + escapeHTML(period.range) + "</span><small>" + escapeHTML(period.summary) + "</small></button>"
    ).join("");
    timeline.querySelectorAll("[data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPeriod = button.dataset.period;
        renderOverview();
      });
    });
    renderPeriodDetail();

    const eightIds = ["M11", "M05", "M06", "M13", "M03", "M17", "M19", "M20"];
    document.getElementById("overviewMechanisms").innerHTML = eightIds.map((id) => {
      const mechanism = MECHANISM_MAP[id];
      return '<button class="mini-card" type="button" data-mechanism="' + id + '"><b>' + escapeHTML(mechanism.title) + "</b><span>" + escapeHTML(mechanism.principle) + "</span></button>";
    }).join("");
    document.querySelectorAll("[data-mechanism]").forEach((button) => {
      button.addEventListener("click", () => openMechanism(button.dataset.mechanism));
    });
  }

  function renderPeriodDetail() {
    const period = PERIODS.find((item) => item.id === state.selectedPeriod) || PERIODS[0];
    const sourceLinks = period.claims.map((claimId) => {
      const claim = CLAIM_MAP[claimId];
      if (!claim || !claim.citations.length) return "";
      const citation = claim.citations[0];
      return '<a href="' + citationHref(Object.assign({ claimId: claim.id }, citation)) + '" target="_blank" rel="noopener">' + escapeHTML(BOOK_MAP[citation.book].short) + " " + pageLabel(citation.pdfPage) + "</a>";
    }).filter(Boolean).join(" · ");
    document.getElementById("periodDetail").innerHTML =
      "<p>" + escapeHTML(period.summary) + "</p><ul>" + period.changes.map((change) => "<li>" + escapeHTML(change) + "</li>").join("") + "</ul>" +
      '<p class="footnote">阶段依据：' + sourceLinks + "</p>";
  }

  function initStudio() {
    renderPresetRow();
    renderLayerEditor();
    document.getElementById("addLayerButton").addEventListener("click", addLayer);
    document.getElementById("resetLayersButton").addEventListener("click", () => applyPreset(state.presetId));
    document.getElementById("planTabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-plan]");
      if (!button) return;
      state.selectedPlan = button.dataset.plan;
      renderResult();
    });
    document.getElementById("copyPlanButton").addEventListener("click", copyPlan);
    document.getElementById("downloadPlanButton").addEventListener("click", downloadPlan);
    analyzeNow();
  }

  function renderPresetRow() {
    document.getElementById("presetRow").innerHTML = PRESETS.map((preset) =>
      '<button class="preset-button' + (preset.id === state.presetId ? " active" : "") + '" type="button" data-preset="' + preset.id + '" title="' + escapeHTML(preset.note) + '">' + escapeHTML(preset.label) + "</button>"
    ).join("");
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });
  }

  function applyPreset(presetId) {
    const preset = PRESETS.find((item) => item.id === presetId) || PRESETS[0];
    state.presetId = preset.id;
    state.goal = preset.goal;
    state.ensemble = preset.ensemble;
    state.layers = clone(preset.layers);
    state.selectedPlan = "clear";
    document.getElementById("goalSelect").value = state.goal;
    document.getElementById("ensembleSelect").value = state.ensemble;
    renderPresetRow();
    renderLayerEditor();
    analyzeNow();
  }

  function renderLayerEditor() {
    const editor = document.getElementById("layerEditor");
    document.getElementById("layerCount").textContent = state.layers.length + " 层";
    editor.innerHTML = state.layers.map((layer, index) => layerEditorCard(layer, index)).join("");
    editor.querySelectorAll("[data-layer-field]").forEach((input) => {
      input.addEventListener("input", () => updateLayer(input));
      input.addEventListener("change", () => updateLayer(input));
    });
    editor.querySelectorAll("[data-manual-instrument]").forEach((input) => {
      input.addEventListener("change", () => updateManualVoice(input));
    });
    editor.querySelectorAll("[data-manual-octave]").forEach((select) => {
      select.addEventListener("change", () => updateManualOctave(select));
    });
    editor.querySelectorAll("[data-remove-layer]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.layers.length <= 1) return;
        state.layers.splice(Number(button.dataset.removeLayer), 1);
        state.presetId = "custom";
        renderPresetRow();
        renderLayerEditor();
        analyzeNow();
      });
    });
  }

  function layerEditorCard(layer, index) {
    const roleOptions = Object.entries(ROLE_LABELS).map(([id, label]) => '<option value="' + id + '"' + (layer.role === id ? " selected" : "") + ">" + escapeHTML(label) + "</option>").join("");
    const mode = layer.mode === "manual" ? "manual" : "auto";
    return '<div class="layer-card" data-layer-index="' + index + '">' +
      '<div class="layer-card-head"><span class="role-tag"><i class="role-dot"></i>' + escapeHTML(ROLE_LABELS[layer.role]) + '</span><button class="remove-layer" type="button" data-remove-layer="' + index + '" aria-label="删除此层">×</button></div>' +
      '<div class="field-grid"><label class="mini-field">角色<select data-layer-field="role" data-index="' + index + '">' + roleOptions + '</select></label>' +
      '<label class="mini-field">优先级<select data-layer-field="priority" data-index="' + index + '">' + [1,2,3,4,5].map((n) => '<option value="' + n + '"' + (Number(layer.priority) === n ? " selected" : "") + ">P" + n + "</option>").join("") + "</select></label></div>" +
      '<label class="mini-field mode-field">分配方式<select data-layer-field="mode" data-index="' + index + '"><option value="auto"' + (mode === "auto" ? " selected" : "") + '>自动推荐</option><option value="manual"' + (mode === "manual" ? " selected" : "") + '>手选组合</option></select></label>' +
      '<div class="range-line"><span class="range-label">低</span><input type="range" min="24" max="108" step="1" value="' + layer.lo + '" data-layer-field="lo" data-index="' + index + '" aria-label="最低音"><span>' + engine.midiToName(layer.lo) + '</span></div>' +
      '<div class="range-line"><span class="range-label">高</span><input type="range" min="24" max="108" step="1" value="' + layer.hi + '" data-layer-field="hi" data-index="' + index + '" aria-label="最高音"><span>' + engine.midiToName(layer.hi) + '</span></div>' +
      '<div class="layer-sliders">' +
        sliderField("力度", "dynamic", layer.dynamic, 1, 8, index, DYNAMIC_NAMES[Math.max(0, Math.min(7, layer.dynamic - 1))]) +
        sliderField("密度", "density", layer.density, 0, 5, index, layer.density) +
        sliderField("时长", "duration", layer.duration, 1, 24, index, layer.duration + "s") +
      '</div>' +
      (mode === "manual"
        ? manualPickerHTML(layer, index)
        : '<p class="mode-hint">按角色、音区与目标自动分配；切到手选组合可固定多件乐器。</p>') +
      '</div>';
  }

  function manualPickerHTML(layer, index) {
    const voices = Array.isArray(layer.manualVoices) ? layer.manualVoices : [];
    const selected = new Map(voices.map((voice) => [voice.instrumentId, voice]));
    const ensemble = ENSEMBLES[state.ensemble] || ENSEMBLES.classical;
    const ensembleIds = new Set(ensemble.ids);
    const groups = FAMILY_ORDER.map((family) => {
      const familyInstruments = INSTRUMENTS.filter((instrument) => instrument.family === family);
      if (!familyInstruments.length) return "";
      return '<div class="manual-family"><div class="manual-family-head">' + escapeHTML(FAMILY_LABELS[family] || family) + '</div>' +
        familyInstruments.map((instrument) => manualOptionHTML(instrument, index, selected.get(instrument.id), ensembleIds)).join("") +
        '</div>';
    }).join("");
    return '<div class="manual-picker"><div class="manual-picker-head"><b>手选乐器与八度</b><span class="manual-count" data-manual-count="' + index + '">' + voices.length + ' 件</span></div>' +
      '<p class="manual-help">勾选即采用，不再自动补声部；这些选择在三套方案中保持不变。编制外或超出音域的乐器会保留并给出警告。</p>' +
      '<div class="manual-options">' + groups + '</div></div>';
  }

  function manualOptionHTML(instrument, index, voice, ensembleIds) {
    const checked = Boolean(voice);
    const shift = voice ? voice.octaveShift : 0;
    const outside = !ensembleIds.has(instrument.id);
    const shiftMarkup = instrument.id === "percussion"
      ? '<select class="manual-octave" disabled aria-label="' + escapeHTML(instrument.name + "无固定音高") + '"><option>无音高</option></select>'
      : '<select class="manual-octave" data-manual-octave="' + instrument.id + '" data-index="' + index + '" aria-label="' + escapeHTML(instrument.name + "八度") + '"' + (checked ? "" : " disabled") + '>' +
        (engine.MANUAL_SHIFTS || [-12, 0, 12]).map((value) => '<option value="' + value + '"' + (Number(shift) === value ? " selected" : "") + '>' + MANUAL_SHIFT_LABELS[String(value)] + '</option>').join("") +
        '</select>';
    return '<div class="manual-option' + (outside ? " outside-ensemble" : "") + '">' +
      '<label class="manual-check"><input type="checkbox" data-manual-instrument="' + instrument.id + '" data-index="' + index + '"' + (checked ? " checked" : "") + '><span>' + escapeHTML(instrument.name) + (outside ? '<small>编制外</small>' : '') + '</span></label>' +
      shiftMarkup + '</div>';
  }

  function sliderField(label, field, value, min, max, index, display) {
    return '<label class="slider-field">' + label + '<output>' + escapeHTML(display) + '</output><input type="range" min="' + min + '" max="' + max + '" step="1" value="' + value + '" data-layer-field="' + field + '" data-index="' + index + '"></label>';
  }

  function updateLayer(input) {
    const index = Number(input.dataset.index);
    const field = input.dataset.layerField;
    const layer = state.layers[index];
    if (!layer) return;
    if (field === "mode") {
      const mode = input.value === "manual" ? "manual" : "auto";
      if (mode === "manual" && !Array.isArray(layer.manualVoices)) layer.manualVoices = seedManualVoices(index);
      layer.mode = mode;
    } else if (field === "role") layer.role = input.value;
    else if (field === "priority") layer.priority = Number(input.value);
    else if (field === "dynamic" || field === "density" || field === "duration" || field === "lo" || field === "hi") layer[field] = Number(input.value);
    if (layer.hi < layer.lo) layer.hi = layer.lo;
    state.presetId = "custom";
    document.querySelectorAll(".preset-button").forEach((button) => button.classList.remove("active"));
    renderLayerEditor();
    clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(analyzeNow, 120);
  }

  function seedManualVoices(index) {
    const layer = state.layers[index];
    const plan = currentPlan();
    const planLayer = plan?.layers.find((item) => item.layerId === layer.id);
    if (!planLayer) return [];
    return planLayer.instruments.map((assignment) => ({
      instrumentId: assignment.instrumentId,
      octaveShift: Number(assignment.octaveShift) || 0
    }));
  }

  function updateManualVoice(input) {
    const index = Number(input.dataset.index);
    const instrumentId = input.dataset.manualInstrument;
    const layer = state.layers[index];
    if (!layer || !instrumentId) return;
    if (!Array.isArray(layer.manualVoices)) layer.manualVoices = [];
    const existing = layer.manualVoices.findIndex((voice) => voice.instrumentId === instrumentId);
    const octaveSelect = input.closest(".manual-option")?.querySelector("[data-manual-octave]");
    if (input.checked && existing < 0) {
      const shift = Number(octaveSelect?.value);
      layer.manualVoices.push({ instrumentId, octaveShift: [-12, 0, 12].includes(shift) ? shift : 0 });
    } else if (!input.checked && existing >= 0) {
      layer.manualVoices.splice(existing, 1);
    }
    if (octaveSelect) octaveSelect.disabled = !input.checked;
    updateManualCount(index);
    markCustomAndAnalyze();
  }

  function updateManualOctave(select) {
    const index = Number(select.dataset.index);
    const instrumentId = select.dataset.manualOctave;
    const layer = state.layers[index];
    const voice = layer?.manualVoices?.find((item) => item.instrumentId === instrumentId);
    if (!voice) return;
    const shift = Number(select.value);
    voice.octaveShift = [-12, 0, 12].includes(shift) ? shift : 0;
    markCustomAndAnalyze();
  }

  function updateManualCount(index) {
    const output = document.querySelector('[data-manual-count="' + index + '"]');
    if (output) output.textContent = (state.layers[index]?.manualVoices?.length || 0) + " 件";
  }

  function markCustomAndAnalyze() {
    state.presetId = "custom";
    document.querySelectorAll(".preset-button").forEach((button) => button.classList.remove("active"));
    clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(analyzeNow, 120);
  }

  function addLayer() {
    const base = state.layers[state.layers.length - 1] || { lo: 55, hi: 67 };
    state.layers.push({
      id: "layer-" + Date.now(), role: "harmony", lo: Math.max(24, base.lo - 7), hi: Math.max(24, base.hi - 7),
      dynamic: 3, duration: 8, density: 1, priority: Math.min(5, state.layers.length + 1),
      mode: "auto", manualVoices: []
    });
    state.presetId = "custom";
    renderPresetRow();
    renderLayerEditor();
    analyzeNow();
  }

  function analyzeNow() {
    analysis = engine.analyze({ goal: state.goal, ensemble: state.ensemble, layers: state.layers });
    renderResult();
  }

  function renderResult() {
    if (!analysis) return;
    document.getElementById("planTabs").innerHTML = analysis.plans.map((plan) =>
      '<button class="plan-tab' + (plan.id === state.selectedPlan ? " active" : "") + '" type="button" data-plan="' + plan.id + '"><b>' + escapeHTML(plan.label) + "</b><small>" + plan.metrics.assignedInstruments + " 件乐器 · " + plan.metrics.warningCount + " 项警告</small></button>"
    ).join("");
    const plan = analysis.plans.find((item) => item.id === state.selectedPlan) || analysis.plans[0];
    renderMetrics(plan);
    renderRegisterMap(plan);
    renderDiagnostics(plan);
    renderAssignments(plan);
    document.getElementById("planDescription").textContent = plan.description + (plan.manualLayerCount ? " · 手选层固定 " + plan.manualLayerCount + " 层" : "");
  }

  function renderMetrics(plan) {
    const metrics = plan.metrics;
    document.getElementById("resultSummary").innerHTML = [
      ["独立结构层", metrics.independentLayers],
      ["已分配乐器", metrics.assignedInstruments],
      ["使用组别", metrics.families],
      ["音区跨度", engine.midiToName(metrics.registerLow || 24) + "–" + engine.midiToName(metrics.registerHigh || 108)]
    ].map(([label, value]) => '<div class="metric"><b>' + escapeHTML(value) + '</b><span>' + escapeHTML(label) + "</span></div>").join("");
  }

  function renderRegisterMap(plan) {
    const width = 900, height = 390, left = 96, right = 30, top = 46, bottom = 36;
    const pitchLow = 24, pitchHigh = 108;
    const plotWidth = width - left - right;
    const rowHeight = Math.max(38, Math.min(52, (height - top - bottom) / Math.max(1, plan.layers.length)));
    const xForMidi = (midi) => left + (midi - pitchLow) / (pitchHigh - pitchLow) * plotWidth;
    const parts = [];
    parts.push('<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="配器音区分布图">');
    parts.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="10" fill="#fbf8f1"/>');
    for (let midi = 24; midi <= 108; midi += 12) {
      const x = xForMidi(midi);
      parts.push('<line x1="' + x + '" y1="' + (top - 18) + '" x2="' + x + '" y2="' + (height - bottom + 8) + '" stroke="#e2dacd" stroke-width="1"/>');
      parts.push('<text x="' + x + '" y="' + (top - 24) + '" text-anchor="middle" font-size="9" fill="#7d837f">' + engine.midiToName(midi) + "</text>");
    }
    parts.push('<line x1="' + left + '" y1="' + (height - bottom + 4) + '" x2="' + (width - right) + '" y2="' + (height - bottom + 4) + '" stroke="#cfc4b3"/>');
    plan.layers.forEach((layer, index) => {
      const y = top + index * rowHeight;
      const center = y + rowHeight * 0.42;
      const lowX = xForMidi(layer.range[0]);
      const highX = xForMidi(layer.range[1]);
      parts.push('<text x="14" y="' + (center + 3) + '" font-size="10" font-weight="700" fill="#3f4d4a">' + escapeHTML(layer.roleLabel) + "</text>");
      parts.push('<text x="14" y="' + (center + 16) + '" font-size="8" fill="#858b87">' + escapeHTML(layer.rangeLabel) + "</text>");
      parts.push('<rect x="' + lowX + '" y="' + (center - 8) + '" width="' + Math.max(5, highX - lowX) + '" height="17" rx="7" fill="#e8dfd1" opacity=".9"/>');
      layer.instruments.forEach((assignment, assignmentIndex) => {
        if (assignment.soundingLow == null) return;
        const middle = Math.max(pitchLow, Math.min(pitchHigh, (assignment.soundingLow + assignment.soundingHigh) / 2));
        const x = xForMidi(middle);
        const color = FAMILY_COLORS[assignment.family] || "#777";
        parts.push('<circle cx="' + x + '" cy="' + center + '" r="5.5" fill="' + color + '" stroke="#fffdf7" stroke-width="1.6"><title>' + escapeHTML(assignment.instrument + " · " + assignment.familyLabel) + "</title></circle>");
        if (layer.instruments.length <= 3) {
          parts.push('<text x="' + (x + 8) + '" y="' + (center - 8 + assignmentIndex * 2) + '" font-size="8" fill="' + color + '">' + escapeHTML(INSTRUMENT_MAP[assignment.instrumentId]?.short || "") + "</text>");
        }
      });
    });
    const legendY = height - 14;
    let legendX = left;
    Object.entries({ string: "弦乐", woodwind: "木管", brass: "铜管", percussion: "打击乐", key: "竖琴/键盘" }).forEach(([family, label]) => {
      parts.push('<circle cx="' + legendX + '" cy="' + legendY + '" r="4" fill="' + FAMILY_COLORS[family] + '"/>');
      parts.push('<text x="' + (legendX + 8) + '" y="' + (legendY + 3) + '" font-size="9" fill="#707975">' + label + "</text>");
      legendX += 68;
    });
    parts.push("</svg>");
    document.getElementById("registerMap").innerHTML = parts.join("");
  }

  function renderDiagnostics(plan) {
    const warnings = plan.diagnostics;
    document.getElementById("warningCount").textContent = warnings.filter((item) => item.severity === "warn").length + " 项警告";
    document.getElementById("diagnostics").innerHTML = warnings.length
      ? warnings.map((item) => '<div class="diagnostic ' + (item.severity === "warn" ? "warn" : "") + '"><b>' + escapeHTML(item.title) + "</b><span>" + escapeHTML(item.detail) + "</span></div>").join("")
      : '<div class="diagnostic"><b>未发现显著冲突</b><span>仍需在试奏中检查音准、平衡、换气与厅堂效果。</span></div>';
  }

  function assignmentDetails(assignment) {
    const features = assignment.features || {};
    const pct = (value) => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100) + "%";
    const alternatives = (assignment.alternatives || []).map((item) =>
      '<li><span>' + escapeHTML(item.instrument) + '</span><b>' + Number(item.score).toFixed(3) + '</b><small>' + escapeHTML(item.reason || "") + '</small></li>'
    ).join("");
    return '<details class="candidate-details"><summary>评分与备选</summary>' +
      '<div class="feature-grid"><span>舒适音区<b>' + pct(features.comfort) + '</b></span><span>角色适配<b>' + pct(features.roleFit) + '</b></span><span>力度余量<b>' + pct(features.dynamicFit) + '</b></span><span>敏捷度<b>' + pct(features.agilityFit) + '</b></span><span>持续力<b>' + pct(features.sustainFit) + '</b></span><span>掩蔽惩罚<b>' + pct(features.maskingPenalty) + '</b></span></div>' +
      (alternatives ? '<div class="candidate-list"><b>同层备选</b><ol>' + alternatives + '</ol></div>' : '') +
      '<p class="score-note">' + (assignment.manual ? "手选乐器不参与自动排名；这些指标只用于核对音区、角色与持续能力。" : "相对分只用于同一结构层的候选比较，不是作品质量分。") + '</p></details>';
  }

  function renderAssignments(plan) {
    document.getElementById("assignments").innerHTML = plan.layers.map((layer) => {
      const chips = layer.instruments.map((assignment) => {
        const shift = assignment.octaveShift ? " · " + (assignment.octaveShift > 0 ? "+" : "") + assignment.octaveShift + " 半音" : "";
        return '<div class="instrument-chip ' + layer.role + (assignment.manual ? " manual" : "") + '"><b>' + escapeHTML(assignment.instrument) + "</b><span>" + escapeHTML(assignment.familyLabel + shift) + "</span><span>" + escapeHTML(assignment.reason) + "</span>" + assignmentDetails(assignment) + "</div>";
      }).join("") || '<span class="muted">没有可用乐器</span>';
      return '<div class="assignment-row"><div class="assignment-label"><b>' + escapeHTML(layer.roleLabel) + "</b><span>" + escapeHTML(layer.rangeLabel + " · " + layer.dynamic + " · P" + layer.priority) + "</span><span>" + escapeHTML(layer.doubling) + "</span></div><div class=\"assignment-instruments\">" + chips + "</div></div>";
    }).join("");
  }

  function currentPlan() {
    return analysis?.plans.find((item) => item.id === state.selectedPlan) || analysis?.plans[0];
  }

  async function copyPlan() {
    const plan = currentPlan();
    if (!plan) return;
    const markdown = engine.planToMarkdown({ input: analysis.input, plans: [plan] });
    try {
      await navigator.clipboard.writeText(markdown);
      flashButton("copyPlanButton", "已复制");
    } catch (error) {
      console.warn(error);
    }
  }

  function downloadPlan() {
    const plan = currentPlan();
    if (!plan) return;
    const markdown = engine.planToMarkdown({ input: analysis.input, plans: [plan] });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "配器推演-" + plan.id + ".md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function flashButton(id, text) {
    const button = document.getElementById(id);
    const original = button.textContent;
    button.textContent = text;
    setTimeout(() => { button.textContent = original; }, 1100);
  }

  function initMap() {
    const filter = document.getElementById("periodFilter");
    filter.innerHTML = '<button class="filter-button active" data-map-period="all" type="button">全部阶段</button>' + PERIODS.map((period) =>
      '<button class="filter-button" data-map-period="' + period.id + '" type="button">' + escapeHTML(period.label) + "</button>"
    ).join("");
    filter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-map-period]");
      if (!button) return;
      state.mapPeriod = button.dataset.mapPeriod;
      filter.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
      renderMap();
    });
    window.addEventListener("resize", () => {
      clearTimeout(mapResizeTimer);
      mapResizeTimer = setTimeout(() => {
        if (state.activeTab === "map") drawMapEdges(NODES);
      }, 80);
    });
    renderMap();
  }

  function mapFocusSet() {
    if (state.mapPeriod === "all") return null;
    const period = PERIODS.find((item) => item.id === state.mapPeriod);
    return period ? new Set(period.focus) : null;
  }

  function updateMapPeriodNote() {
    const note = document.getElementById("mapPeriodNote");
    if (!note) return;
    if (state.mapPeriod === "all") {
      note.textContent = "全部阶段：显示 " + NODES.length + " 个节点和全部先修关系。选择某一阶段只会压暗次要节点，不删除通用原理。";
      return;
    }
    const period = PERIODS.find((item) => item.id === state.mapPeriod);
    if (period) note.textContent = period.focusNote;
  }

  function drawMapEdges(mapNodes) {
    const map = document.getElementById("theoryMap");
    if (!map) return;
    const mapRect = map.getBoundingClientRect();
    if (!mapRect.width || !mapRect.height) return;
    let svg = map.querySelector(".map-edges");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("map-edges");
      map.prepend(svg);
    }
    const visibleIds = new Set(mapNodes.map((node) => node.id));
    const focusIds = mapFocusSet();
    const paths = [];
    for (const sourceNode of mapNodes) {
      for (const targetId of sourceNode.next) {
        if (!visibleIds.has(targetId)) continue;
        const source = map.querySelector('[data-node="' + sourceNode.id + '"]');
        const target = map.querySelector('[data-node="' + targetId + '"]');
        if (!source || !target) continue;
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const x1 = sourceRect.right - mapRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - mapRect.top;
        const x2 = targetRect.left - mapRect.left;
        const y2 = targetRect.top + targetRect.height / 2 - mapRect.top;
        const bend = Math.max(24, Math.min(74, Math.abs(x2 - x1) * 0.45));
        const highlighted = state.selectedNode === sourceNode.id || state.selectedNode === targetId;
        const dimmed = focusIds && !(focusIds.has(sourceNode.id) && focusIds.has(targetId));
        const classes = [highlighted ? "active" : "", dimmed ? "period-dim" : ""].filter(Boolean).join(" ");
        paths.push('<path d="M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '" class="' + classes + '"/>');
      }
    }
    svg.setAttribute("viewBox", "0 0 " + mapRect.width + " " + mapRect.height);
    svg.innerHTML = '<defs><marker id="map-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke"/></marker></defs>' + paths.join("");
  }

  function renderMap() {
    const focusIds = mapFocusSet();
    const map = document.getElementById("theoryMap");
    map.innerHTML = LAYERS.map((layer) => {
      const nodes = NODES.filter((node) => node.layer === layer.id);
      return '<div class="map-column"><div class="map-column-head"><b>' + escapeHTML(layer.label) + "</b><span>" + escapeHTML(layer.question) + "</span></div>" +
        nodes.map((node) => {
          const connected = node.prereq.includes(state.selectedNode) || node.next.includes(state.selectedNode) ||
            NODE_MAP[state.selectedNode]?.prereq.includes(node.id) || NODE_MAP[state.selectedNode]?.next.includes(node.id);
          const dimmed = focusIds && !focusIds.has(node.id);
          const relation = (node.prereq.length ? "先修：" + node.prereq.map((id) => NODE_MAP[id]?.label || id).join("、") + "。" : "起点。") +
            (node.next.length ? "后续：" + node.next.map((id) => NODE_MAP[id]?.label || id).join("、") + "。" : "");
          return '<button class="node-card' + (node.id === state.selectedNode ? " active" : "") + (connected ? " connected" : "") + (dimmed ? " period-dim" : "") + '" data-layer="' + layer.id + '" data-node="' + node.id + '" type="button" title="' + escapeHTML(relation) + '"><b>' + escapeHTML(node.label) + "</b><span>" + escapeHTML(node.short) + "</span></button>";
        }).join("") + "</div>";
    }).join("");
    map.querySelectorAll("[data-node]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedNode = button.dataset.node;
        renderMap();
        renderNodeDetail(button.dataset.node);
      });
    });
    updateMapPeriodNote();
    requestAnimationFrame(() => drawMapEdges(NODES));
    if (state.selectedNode) renderNodeDetail(state.selectedNode);
  }

  function renderNodeDetail(nodeId) {
    const node = NODE_MAP[nodeId];
    if (!node) return;
    const mechanisms = node.mechanisms.map((id) => MECHANISM_MAP[id]).filter(Boolean);
    const citations = citationsForClaims(node.claims);
    const prereqLabels = node.prereq.map((id) => NODE_MAP[id]?.label || id);
    const nextLabels = node.next.map((id) => NODE_MAP[id]?.label || id);
    document.getElementById("mapDetail").innerHTML =
      '<p class="eyebrow">' + escapeHTML(LAYERS.find((layer) => layer.id === node.layer)?.label || "") + "</p>" +
      "<h3>" + escapeHTML(node.label) + "</h3>" +
      '<div class="causal-line"><span>前置</span><b>' + escapeHTML(prereqLabels.join("、") || "起点") + '</b><i>→</i><span>本节点</span><b>' + escapeHTML(node.label) + '</b><i>→</i><span>通向</span><b>' + escapeHTML(nextLabels.join("、") || "终点") + "</b></div>" +
      "<p>" + escapeHTML(node.principle) + "</p>" +
      "<h4>操作</h4><ul>" + node.operation.map((item) => "<li>" + escapeHTML(item) + "</li>").join("") + "</ul>" +
      "<h4>使用场景</h4><p>" + escapeHTML(node.application) + "</p>" +
      "<h4>常见失败</h4><p>" + escapeHTML(node.failure) + "</p>" +
      (node.prereq.length ? "<h4>先修</h4><div class=\"detail-actions\">" + node.prereq.map((id) => '<button class="detail-chip" type="button" data-detail-node="' + id + '">' + escapeHTML(NODE_MAP[id]?.label || id) + "</button>").join("") + "</div>" : "") +
      (node.next.length ? "<h4>后续</h4><div class=\"detail-actions\">" + node.next.map((id) => '<button class="detail-chip" type="button" data-detail-node="' + id + '">' + escapeHTML(NODE_MAP[id]?.label || id) + "</button>").join("") + "</div>" : "") +
      (mechanisms.length ? "<h4>相关机制</h4><div class=\"detail-actions\">" + mechanisms.map((item) => '<button class="detail-chip" type="button" data-detail-mechanism="' + item.id + '">' + escapeHTML(item.id + " " + item.title) + "</button>").join("") + "</div>" : "") +
      (citations.length ? "<h4>教材依据</h4><div class=\"detail-actions\">" + citations.map((citation) => '<a class="detail-chip" href="' + citationHref(citation) + '" target="_blank" rel="noopener">' + escapeHTML(BOOK_MAP[citation.book].short) + " " + pageLabel(citation.pdfPage) + "</a>").join("") + "</div>" : "");
    document.querySelectorAll("[data-detail-node]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedNode = button.dataset.detailNode;
        renderMap();
      });
    });
    document.querySelectorAll("[data-detail-mechanism]").forEach((button) => {
      button.addEventListener("click", () => openMechanism(button.dataset.detailMechanism));
    });
  }

  function openMechanism(mechanismId) {
    switchTab("techniques");
    state.techniqueLayer = "all";
    state.techniqueQuery = "";
    document.getElementById("techniqueSearch").value = "";
    renderTechniques();
    const card = document.querySelector('[data-technique-card="' + mechanismId + '"]');
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.outline = "2px solid #bb5d2b";
      setTimeout(() => { card.style.outline = ""; }, 1800);
    }
  }

  function initTechniques() {
    const layerFilter = document.getElementById("techniqueLayerFilter");
    layerFilter.innerHTML = '<button class="filter-button active" data-tech-layer="all" type="button">全部层</button>' + LAYERS.map((layer) =>
      '<button class="filter-button" data-tech-layer="' + layer.id + '" type="button">' + escapeHTML(layer.label) + "</button>"
    ).join("");
    layerFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tech-layer]");
      if (!button) return;
      state.techniqueLayer = button.dataset.techLayer;
      layerFilter.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
      renderTechniques();
    });
    const periodFilter = document.getElementById("techniquePeriodFilter");
    periodFilter.innerHTML = '<button class="filter-button active" data-tech-period="all" type="button">全部阶段</button>' + PERIODS.map((period) =>
      '<button class="filter-button" data-tech-period="' + period.id + '" type="button">' + escapeHTML(period.label) + "</button>"
    ).join("");
    periodFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tech-period]");
      if (!button) return;
      state.techniquePeriod = button.dataset.techPeriod;
      periodFilter.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
      renderTechniques();
    });
    document.getElementById("techniqueSearch").addEventListener("input", (event) => {
      state.techniqueQuery = event.target.value.trim().toLowerCase();
      renderTechniques();
    });
    renderTechniques();
  }

  function renderTechniques() {
    const list = MECHANISMS.filter((mechanism) => {
      const layerOkay = state.techniqueLayer === "all" || mechanism.layer === state.techniqueLayer;
      const periodOkay = state.techniquePeriod === "all" || mechanism.period === "all" || mechanism.period === state.techniquePeriod;
      const haystack = [mechanism.title, mechanism.principle, mechanism.check, mechanism.use, mechanism.limit].join(" ").toLowerCase();
      return layerOkay && periodOkay && (!state.techniqueQuery || haystack.includes(state.techniqueQuery));
    });
    document.getElementById("techniqueGrid").innerHTML = list.length ? list.map((mechanism) => {
      const citations = citationsForClaims(mechanism.claims);
      const periodLabel = mechanism.period === "all" ? "通用" : PERIODS.find((period) => period.id === mechanism.period)?.label || mechanism.period;
      const evidenceLabel = mechanism.evidence === "direct" ? "教材直接陈述" : "教材定义与声学推论";
      const preview = citations[0] ? '<a class="technique-preview" href="' + citationHref(citations[0]) + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="' + snippetHref(citations[0]) + '" alt="' + escapeHTML(BOOK_MAP[citations[0].book].short + " PDF p." + citations[0].pdfPage + " 局部影印") + '"><span>打开原文锚点</span></a>' : "";
      return '<article class="technique-card" data-technique-card="' + mechanism.id + '"><div class="technique-card-head"><span class="mechanism-id">' + mechanism.id + '</span><span class="technique-badges"><span class="meta-pill evidence-' + escapeHTML(mechanism.evidence) + '">' + evidenceLabel + '</span><span class="meta-pill">' + escapeHTML(periodLabel) + '</span></span></div>' +
        "<h3>" + escapeHTML(mechanism.title) + "</h3><p>" + escapeHTML(mechanism.principle) + "</p>" +
        '<div class="technique-meta"><span class="meta-pill">' + escapeHTML(LAYERS.find((layer) => layer.id === mechanism.layer)?.label || mechanism.layer) + "</span></div>" + preview +
        '<div class="technique-extra"><div><b>检查</b><span>' + escapeHTML(mechanism.check) + "</span></div><div><b>用法</b><span>" + escapeHTML(mechanism.use) + "</span></div><div><b>边界</b><span>" + escapeHTML(mechanism.limit) + "</span></div></div>" +
        '<div class="technique-links">' + citations.slice(0, 3).map((citation) => '<a href="' + citationHref(citation) + '" target="_blank" rel="noopener">' + escapeHTML(BOOK_MAP[citation.book].short) + " " + pageLabel(citation.pdfPage) + "</a>").join("") + "</div></article>";
    }).join("") : '<div class="panel empty-state"><div class="empty-mark">⌕</div><h3>没有匹配的机制</h3><p>换一个关键词，或清空知识层与阶段筛选。</p></div>';
  }

  function initSources() {
    renderSourceStats();
    renderBookList();
    renderClaims();
  }

  function renderSourceStats() {
    const citations = CLAIMS.reduce((sum, claim) => sum + claim.citations.length, 0);
    const pending = CLAIMS.filter((claim) => claim.category === "pending").length;
    document.getElementById("sourceStats").innerHTML = [
      [BOOKS.length, "教材册"], [CLAIMS.length, "论点"], [citations, "页码依据"], [pending, "待补原文"]
    ].map(([value, label]) => '<div class="source-stat"><b>' + value + "</b><span>" + label + "</span></div>").join("");
  }

  function renderBookList() {
    const list = document.getElementById("bookList");
    list.innerHTML = '<button class="book-button' + (state.selectedBook === "all" ? " active" : "") + '" type="button" data-book="all"><b>全部教材</b><span>按论点浏览</span></button>' +
      BOOKS.map((book) => {
        const count = CLAIMS.filter((claim) => claim.citations.some((citation) => citation.book === book.id)).length;
        return '<button class="book-button' + (state.selectedBook === book.id ? " active" : "") + '" type="button" data-book="' + book.id + '"><b>' + escapeHTML(book.short) + "</b><span>" + escapeHTML(book.role) + " · " + count + " 条依据</span></button>";
      }).join("");
    list.querySelectorAll("[data-book]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedBook = button.dataset.book;
        renderBookList();
        renderClaims();
      });
    });
  }

  function renderClaims() {
    const claims = CLAIMS.filter((claim) => state.selectedBook === "all" || claim.citations.some((citation) => citation.book === state.selectedBook));
    const container = document.getElementById("claimList");
    container.innerHTML = claims.map((claim) => {
      const statusClass = claim.category === "pending" ? "pending" : claim.category;
      const statusText = claim.category === "direct" ? "直接依据" : claim.category === "derived" ? "体系推论" : "待补原文";
      return '<article class="claim-card"><div class="claim-card-head"><div><span class="mechanism-id">' + escapeHTML(claim.id) + "</span><h3>" + escapeHTML(claim.claim) + '</h3></div><span class="claim-status ' + statusClass + '">' + statusText + "</span></div>" +
        claim.citations.map((citation) => {
          const book = BOOK_MAP[citation.book];
          const linkedCitation = Object.assign({ claimId: claim.id }, citation);
          return '<div class="citation"><blockquote>“' + escapeHTML(citation.quote) + '”</blockquote><div class="citation-links"><a href="' + citationHref(linkedCitation) + '" target="_blank" rel="noopener">' + escapeHTML(book.short) + " · " + pageLabel(citation.pdfPage) + (citation.printedPage ? "（印刷 p." + citation.printedPage + "）" : "") + '</a><a href="' + pdfHref(citation.book, citation.pdfPage) + '" target="_blank" rel="noopener">打开原 PDF</a><span class="muted">' + escapeHTML(citation.chapter) + '</span></div><details class="citation-preview"><summary>查看局部影印</summary><a href="' + citationHref(linkedCitation) + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="' + snippetHref(linkedCitation) + '" alt="' + escapeHTML(book.short + " PDF p." + citation.pdfPage + " 局部影印") + '"></a></details></div>';
        }).join("") + "</article>";
    }).join("");
  }

  function initHelp() {
    const modal = document.getElementById("helpModal");
    const open = () => modal.classList.remove("hidden");
    const close = () => modal.classList.add("hidden");
    document.getElementById("helpButton").addEventListener("click", open);
    document.getElementById("closeHelpButton").addEventListener("click", close);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  }

  function initFooter() {
    const complete = CLAIMS.filter((claim) => claim.category !== "pending").length;
    document.getElementById("footerMeta").textContent = CLAIMS.length + " 条论点 · " + complete + " 条已有教材原文 · 7 册 / 4 部教材";
  }

  function init() {
    initTabs();
    initHeader();
    renderOverview();
    initStudio();
    initMap();
    initTechniques();
    initSources();
    initHelp();
    initFooter();
    const requested = (location.hash || "").replace(/^#/, "") || new URLSearchParams(location.search).get("tab");
    if (requested && document.getElementById("panel-" + requested)) switchTab(requested, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
