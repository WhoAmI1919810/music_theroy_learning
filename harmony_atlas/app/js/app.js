/* app.js - offline UI for Harmony Atlas. */
(function () {
  'use strict';

  const D = window.HarmonyData;
  const E = window.HarmonyEngine;
  const P = window.HarmonyPitch;
  const A = window.HarmonyAudio;
  const M = window.HarmonyMidi;
  const S = window.HarmonySources || null;
  const NOTE_OPTIONS = ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B'];
  const LAYER_NAMES = ['基础语法', '调性功能', '扩展功能', '音高组织', '20 世纪', '结构与分析'];
  const CATEGORY_NAMES = {
    diatonic: '调内', secondary: '副属/离调', borrowed: '借用/交替', neapolitan: '拿波里',
    aug6: '增六', tritoneSub: '三全音替代', chromaticMediant: '色彩中介', modal: '调式/对称'
  };
  const $ = (sel, node) => (node || document).querySelector(sel);
  const $$ = (sel, node) => Array.from((node || document).querySelectorAll(sel));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const pretty = (value) => P.prettyAccidental(String(value == null ? '' : value));
  const uniq = (arr) => Array.from(new Set(arr));
  const refAnchor = (kind, id, page) => 'ref-' + kind + '-' +
    String(id).toLowerCase().replace(/[^0-9a-z_-]+/g, '-').replace(/^-+|-+$/g, '') +
    '-p' + String(page).padStart(4, '0');
  const noteLabel = (pc, flat) => pretty(P.enharmonicName(pc, flat == null ? state.preferFlats : flat));

  const state = {
    tonic: 'C', mode: 'major', progression: [], selectedKey: null,
    catalogFilter: 'all', includeSevenths: true, includeChromatic: true, nextFilter: 'functional',
    targetTonic: 'G', targetMode: 'major', librarySevenths: true, libraryCategory: 'all', librarySearch: '',
    radarScope: 'near',
    setPcs: [0, 4, 7], neo: { rootPc: 0, quality: 'maj', ops: [] }, activeTab: 'studio',
    theoryNode: null, periodFilter: null, playing: false, preferFlats: false, setPreferFlats: false
  };
  const setNoteLabel = (pc) => noteLabel(pc, state.setPreferFlats || state.preferFlats);
  let catalog = [];
  let libraryCatalog = [];
  let nextItems = [];
  let detailConnections = [];
  let detailInterpretations = [];
  let radarTargets = [];
  let routes = [];
  let mapResizeTimer = null;
  let toastTimer = null;
  let playbackToken = 0;

  function catalogOptions() {
    return {
      sevenths: state.includeSevenths,
      secondary: state.includeChromatic,
      borrowed: state.includeChromatic,
      chromatic: state.includeChromatic
    };
  }

  function keyLabel() {
    return P.prettyAccidental(state.tonic) + ' ' + E.getMode(state.mode).short;
  }

  function populateSelect(select, values, selected) {
    select.innerHTML = values.map((item) => {
      const value = typeof item === 'string' ? item : item.value;
      const label = typeof item === 'string' ? pretty(item) : item.label;
      return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function initHeader() {
    populateSelect($('#tonic'), NOTE_OPTIONS, state.tonic);
    populateSelect($('#mode'), D.MODES.map((m) => ({ value: m.id, label: m.name })), state.mode);
    populateSelect($('#targetTonic'), NOTE_OPTIONS, state.targetTonic);
    populateSelect($('#targetMode'), D.MODES.map((m) => ({ value: m.id, label: m.name })), state.targetMode);
    $('#tonic').addEventListener('change', (e) => {
      state.tonic = e.target.value;
      state.preferFlats = state.tonic.includes('b');
      refreshAll();
    });
    $('#mode').addEventListener('change', (e) => {
      state.mode = e.target.value;
      refreshAll();
    });
    $('#targetTonic').addEventListener('change', (e) => {
      state.targetTonic = e.target.value;
      renderModulation();
    });
    $('#targetMode').addEventListener('change', (e) => {
      state.targetMode = e.target.value;
      renderModulation();
    });
    $('#keyReadout').textContent = keyLabel();
  }

  function refreshAll() {
    catalog = E.buildCatalog(state.tonic, state.mode, catalogOptions());
    $('#keyReadout').textContent = keyLabel();
    renderPalette();
    renderProgression();
    renderNext();
    renderDetail();
    renderPiano();
    renderModulation();
    renderLibrary();
    renderModeGallery();
  }

  function categoryClass(category) {
    if (category === 'secondary') return 'cat-secondary';
    if (category === 'borrowed') return 'cat-borrowed';
    if (category === 'neapolitan' || category === 'aug6' || category === 'tritoneSub' || category === 'chromaticMediant') return 'cat-chromatic';
    if (category === 'modal') return 'cat-modal';
    return 'cat-diatonic';
  }

  function chordTitle(chord) {
    const notes = chord.noteNames.map(pretty).join('–');
    return chord.roman + ' · ' + notes + ' · ' + chord.quality.name;
  }

  function filteredCatalog() {
    if (state.catalogFilter === 'all') return catalog;
    if (state.catalogFilter === 'chromatic') return catalog.filter((c) => ['neapolitan','aug6','tritoneSub','chromaticMediant'].includes(c.category));
    if (state.catalogFilter === 'modal') return catalog.filter((c) => c.category === 'modal');
    return catalog.filter((c) => c.category === state.catalogFilter);
  }

  function renderPalette() {
    const items = filteredCatalog();
    $('#catalogCount').textContent = items.length + ' 个和弦';
    if (!items.length) {
      $('#palette').innerHTML = '<div class="next-empty">当前筛选下没有和弦。可打开“变化和弦”或切换筛选。</div>';
      return;
    }
    const groups = {};
    items.forEach((chord) => {
      const cat = chord.category || 'chromatic';
      (groups[cat] || (groups[cat] = [])).push(chord);
    });
    const order = ['diatonic','secondary','borrowed','neapolitan','aug6','tritoneSub','chromaticMediant','modal'];
    const html = order.filter((cat) => groups[cat] && groups[cat].length).map((cat) => {
      const cards = groups[cat].map((chord) => {
        const selected = state.selectedKey === chord.key;
        return '<button class="chord-card ' + categoryClass(cat) + (selected ? ' is-selected' : '') + '" data-chord-key="' + esc(chord.key) + '" title="' + esc(chordTitle(chord)) + '">' +
          '<span class="numeral">' + esc(pretty(chord.roman)) + '</span>' +
          '<span class="chord-mini"><strong>' + esc(chord.noteNames.map(pretty).join(' · ')) + '</strong><span>' + esc(chord.quality.name) + '</span></span>' +
        '</button>';
      }).join('');
      return '<div class="palette-group"><div class="palette-group-head">' + esc(CATEGORY_NAMES[cat] || cat) + '</div><div class="palette-items">' + cards + '</div></div>';
    }).join('');
    $('#palette').innerHTML = html;
    $$('#palette [data-chord-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chord = catalog.find((c) => c.key === btn.dataset.chordKey);
        if (!chord) return;
        selectChord(chord);
        addToProgression(chord);
      });
      btn.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const chord = catalog.find((c) => c.key === btn.dataset.chordKey);
        if (chord) selectChord(chord);
      });
    });
  }

  function findChordByKey(key) {
    return catalog.find((c) => c.key === key) || libraryCatalog.find((c) => c.key === key) ||
      detailConnections.find((c) => c.key === key) || state.progression.find((c) => c.key === key) || null;
  }

  function selectChord(chord) {
    state.selectedKey = chord ? chord.key : null;
    $$('#palette .chord-card').forEach((el) => el.classList.toggle('is-selected', !!chord && el.dataset.chordKey === chord.key));
    renderDetail();
    renderPianoHighlight();
  }

  function addToProgression(chord) {
    if (!chord) return;
    state.progression.push(chord);
    state.selectedKey = chord.key;
    renderProgression();
    renderNext();
    renderPianoHighlight();
    const box = $('#progression');
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }

  function removeProgressionAt(index) {
    state.progression.splice(index, 1);
    renderProgression();
    renderNext();
    renderPianoHighlight();
  }

  function renderProgression() {
    const box = $('#progression');
    if (!state.progression.length) {
      box.innerHTML = '<div class="progression-empty"><div><div style="font-family:var(--serif);font-size:30px;color:var(--gold)">♩</div>从左侧点选和弦，或使用右侧推荐<br><span class="muted">系统会实时给功能、声部与解决理由</span></div></div>';
    } else {
      box.innerHTML = state.progression.map((chord, i) => {
        return '<div class="prog-item" data-prog="' + i + '">' +
          '<button class="prog-main" data-select-prog="' + i + '" title="选择并查看 ' + esc(chordTitle(chord)) + '">' +
            '<span class="prog-index">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="prog-roman">' + esc(pretty(chord.roman)) + '</span>' +
            '<span class="prog-notes">' + esc(chord.noteNames.map(pretty).join(' · ')) + '</span>' +
          '</button>' +
          '<button class="prog-remove" data-remove-prog="' + i + '" aria-label="移除">×</button>' +
        '</div>';
      }).join('');
    }
    $('#progressionCount').textContent = state.progression.length ? state.progression.length + ' 个和弦' : '';
    $$('#progression [data-select-prog]').forEach((btn) => btn.addEventListener('click', () => {
      const chord = state.progression[Number(btn.dataset.selectProg)];
      if (chord) selectChord(chord);
    }));
    $$('#progression [data-remove-prog]').forEach((btn) => btn.addEventListener('click', () => removeProgressionAt(Number(btn.dataset.removeProg))));
    renderAnalysis();
  }

  function renderAnalysis() {
    if (!state.progression.length) {
      $('#analysis').innerHTML = '';
      $('#progressionHint').textContent = '建议从 I 开始，再尝试 ii–V–I 或 IV–V–I。';
      return;
    }
    const result = E.analyzeProgression(state.progression, state.tonic, state.mode);
    const cadenceAt = new Map();
    result.cadences.forEach((c) => {
      const list = cadenceAt.get(c.at) || [];
      list.push(c.name);
      cadenceAt.set(c.at, list);
    });
    $('#analysis').innerHTML = result.rows.map((row, i) => {
      const cad = cadenceAt.get(i);
      return '<span class="analysis-item' + (cad ? ' cadence' : '') + '"><strong>' + esc(pretty(row.roman)) + '</strong> ' + esc(row.function) +
        (cad ? ' · ' + esc(cad.join(' / ')) : '') + '</span>';
    }).join('') + '<span class="analysis-item">功能链 ' + esc(result.rows.map((r) => r.function).join(' → ')) + '</span>';
    const lastCadence = result.cadences[result.cadences.length - 1];
    $('#progressionHint').textContent = lastCadence ? '检测到：' + lastCadence.name + '（第 ' + (lastCadence.at + 1) + ' 个和弦）' : '继续扩展，或回到主功能形成收束。';
  }

  function renderNext() {
    const opts = catalogOptions();
    opts.grouped = true;
    opts.targetKey = state.targetTonic;
    opts.targetMode = state.targetMode;
    const grouped = E.nextCandidates(state.progression, state.tonic, state.mode, opts);
    nextItems = (grouped[state.nextFilter] || []).slice(0, 12);
    const last = state.progression[state.progression.length - 1];
    $('#nextHint').textContent = last ? '从 ' + pretty(last.roman) + ' 出发' : '建立初始中心';
    if (!nextItems.length) {
      $('#nextList').innerHTML = '<div class="next-empty">此分类暂无推荐。换个筛选，或先在中心页添加和弦。</div>';
      return;
    }
    $('#nextList').innerHTML = nextItems.map((item, i) => {
      const chord = item.chord;
      const score = Math.max(0, Math.min(1, Number(item.score) || 0));
      const targetRoman = item.targetRoman && state.nextFilter === 'modulation' ? ' → ' + pretty(item.targetRoman) : '';
      const reasons = (item.reasons || []).slice(0, 2).join(' · ');
      const warning = (item.warnings || [])[0] || '';
      return '<button class="next-item" data-next="' + i + '" title="' + esc(chordTitle(chord)) + '">' +
        '<span class="next-top"><span class="next-roman">' + esc(pretty(chord.roman)) + targetRoman + '</span><span class="next-chord">' + esc(chord.noteNames.map(pretty).join(' · ')) + '</span><span class="next-score"><i style="width:' + Math.round(score * 100) + '%"></i></span></span>' +
        '<span class="next-reason">' + esc(reasons || chord.functionLabel || '可用连接') + '</span>' +
        (warning ? '<span class="next-warning">⚠ ' + esc(warning) + '</span>' : '') +
      '</button>';
    }).join('');
    $$('#nextList [data-next]').forEach((btn) => btn.addEventListener('click', () => {
      const item = nextItems[Number(btn.dataset.next)];
      if (item) { selectChord(item.chord); addToProgression(item.chord); }
    }));
  }

  function renderDetail() {
    const chord = state.selectedKey ? findChordByKey(state.selectedKey) : null;
    if (!chord) {
      $('#detailEmpty').classList.remove('hidden');
      $('#detailContent').classList.add('hidden');
      return;
    }
    $('#detailEmpty').classList.add('hidden');
    $('#detailContent').classList.remove('hidden');
    const fallback = P.enharmonicName(chord.rootPc, state.preferFlats);
    const replacements = chord.roles && chord.roles.length ? chord.roles : [{ roman: chord.roman, function: chord.function, functionLabel: chord.functionLabel, category: chord.category }];
    const tendency = (chord.tendency || []).map((t) => {
      const from = noteLabel(t.pc, true);
      const to = noteLabel(t.resolveTo, true);
      return '<li>' + esc(t.label) + '：' + esc(from) + ' → ' + esc(to) + '</li>';
    }).join('');
    const tagClass = chord.category === 'secondary' ? 'violet' : (chord.category === 'diatonic' ? 'gold' : 'teal');
    const connOpts = catalogOptions();
    connOpts.limit = 16;
    detailConnections = E.nextCandidates([chord], state.tonic, state.mode, connOpts).slice(0, 7);
    detailInterpretations = E.chordInterpretations(chord, state.tonic, state.mode, {
      limit: 8, preferFlats: state.preferFlats
    });
    const interpretations = detailInterpretations.map((item, i) => {
      const role = pretty(item.targetRoman) + ' · ' + (CATEGORY_NAMES[item.targetCategory] || item.targetCategory);
      return '<button class="interpret-item" data-interpret="' + i + '" title="' + esc(item.reasons.join(' · ')) + '">' +
        '<b>' + esc(pretty(item.targetLabel)) + '</b><span>' + esc(role) + '</span>' +
        '<small>' + esc(item.reasons.slice(0, 2).join(' · ')) + '</small>' +
      '</button>';
    }).join('') || '<span class="muted">当前和弦没有可比对的调式重释。</span>';
    const connections = detailConnections.map((item, i) => {
      return '<button class="connection-pill" data-detail-conn="' + i + '">' + esc(pretty(item.chord.roman)) + ' · ' + esc(item.chord.noteNames.map(pretty).join(' ')) + '</button>';
    }).join('') || '<span class="muted">没有足够材料生成连接。</span>';
    $('#detailContent').innerHTML =
      '<div class="detail-hero"><div class="hero-main"><div class="detail-roman">' + esc(pretty(chord.roman)) + '</div>' +
        '<div class="detail-title"><h3>' + esc(chord.noteNames.map(pretty).join(' · ')) + '</h3><p>' + esc(chord.quality.name) + ' · 根音 ' + esc(pretty(fallback)) + ' · ' + esc(CATEGORY_NAMES[chord.category] || chord.category) + '</p></div></div>' +
        '<div class="detail-actions"><button class="small" id="detailPlay">▶ 试听</button><button class="small" id="detailRoll">琶音</button><button class="small primary" id="detailAdd">加入进行</button></div>' +
      '</div>' +
      '<div class="detail-body"><div>' +
        '<h4>原理与应用</h4><p>' + esc(chord.description || chord.functionLabel || '和弦的功能由当前调域与上下文决定。') + '</p>' +
        '<div class="info-list"><div class="info-line"><b>当前功能</b><span>' + esc(chord.function) + ' · ' + esc(chord.functionLabel || '') + '</span></div>' +
        '<div class="info-line"><b>音集</b><span>[' + chord.pcs.join(', ') + '] · ' + chord.pcs.length + ' 音</span></div>' +
        '<div class="info-line"><b>稳定度</b><span>' + Math.round((chord.stability || 0) * 100) + '% · 色彩度 ' + Math.round((chord.color || 0) * 100) + '%</span></div></div>' +
        '<div class="tag-row"><span class="tag ' + tagClass + '">' + esc(chord.functionLabel || chord.function) + '</span>' +
        uniq((chord.tags || []).concat(chord.seventh ? ['七和弦'] : [])).slice(0, 7).map((tag) => '<span class="tag">' + esc(tag) + '</span>').join('') + '</div>' +
      '</div><div>' +
        '<h4>倾向音与解决</h4>' + (tendency ? '<ul class="tendency-list">' + tendency + '</ul>' : '<p>没有必须解决的强倾向音；可用共同音、级进或色彩关系连接。</p>') +
        '<h4>在此调中的其他解释</h4><div class="tag-row">' + replacements.map((r) => '<span class="tag gold">' + esc(pretty(r.roman)) + ' · ' + esc(r.function) + '</span>').join('') + '</div>' +
        '<h4 style="margin-top:12px">跨调式用途 <span class="muted">点击设为目标</span></h4><div class="interpret-list">' + interpretations + '</div>' +
        '<h4 style="margin-top:12px">推荐后续</h4><div class="connection-list">' + connections + '</div>' +
      '</div></div>';
    $('#detailPlay').addEventListener('click', () => playChord(chord));
    $('#detailRoll').addEventListener('click', () => playChord(chord, true));
    $('#detailAdd').addEventListener('click', () => addToProgression(chord));
    $$('#detailContent [data-detail-conn]').forEach((btn) => btn.addEventListener('click', () => {
      const item = detailConnections[Number(btn.dataset.detailConn)];
      if (item) { selectChord(item.chord); addToProgression(item.chord); }
    }));
    $$('#detailContent [data-interpret]').forEach((btn) => btn.addEventListener('click', () => {
      const item = detailInterpretations[Number(btn.dataset.interpret)];
      if (!item) return;
      applyTarget(item.targetTonic, item.targetMode, '已设为 ' + pretty(item.targetLabel) + '，可查看转调路线');
      switchTab('modulate');
    }));
  }

  function playChord(chord, roll) {
    try {
      const notes = A.playChord(chord, { roll: !!roll, duration: 1.5 });
      $('#keyboardReadout').textContent = '正在试听 ' + chord.roman + '：' + chord.noteNames.map(pretty).join(' · ') + '（MIDI ' + notes.join(', ') + '）';
    } catch (error) {
      toast(error.message);
    }
  }

  function renderPiano() {
    const piano = $('#piano');
    const start = 48;
    const end = 72;
    const whites = [];
    for (let midi = start; midi < end; midi++) {
      const pc = midi % 12;
      if (![1,3,6,8,10].includes(pc)) whites.push(midi);
    }
    const whiteWidth = 100 / whites.length;
    let html = '';
    whites.forEach((midi, index) => {
      const pc = midi % 12;
      const name = P.enharmonicName(pc, false);
      const octave = Math.floor(midi / 12) - 1;
      html += '<button class="piano-key white" data-midi="' + midi + '" style="left:' + (index * whiteWidth) + '%;width:' + whiteWidth + '%" aria-label="' + name + octave + '">' +
        '<span class="key-label">' + (pc === 0 ? name + octave : '') + '</span></button>';
    });
    for (let midi = start; midi < end; midi++) {
      const pc = midi % 12;
      if (![1,3,6,8,10].includes(pc)) continue;
      let whiteBefore = 0;
      for (let m = start; m < midi; m++) if (![1,3,6,8,10].includes(m % 12)) whiteBefore++;
      const blackWidth = 4.35;
      html += '<button class="piano-key black" data-midi="' + midi + '" style="left:' + (whiteBefore * whiteWidth - blackWidth / 2) + '%;width:' + blackWidth + '%" aria-label="' + P.enharmonicName(pc, false) + '">' +
        '<span class="key-label">' + P.enharmonicName(pc, false) + '</span></button>';
    }
    piano.innerHTML = html;
    $$('#piano .piano-key').forEach((key) => key.addEventListener('click', () => {
      const midi = Number(key.dataset.midi);
      A.playMidi(midi, 0.9);
      $('#keyboardReadout').textContent = '试听音高：' + P.enharmonicName(midi % 12, false) + (Math.floor(midi / 12) - 1) + '（MIDI ' + midi + '）';
    }));
    renderPianoHighlight();
  }

  function renderPianoHighlight() {
    const chord = state.selectedKey ? findChordByKey(state.selectedKey) : null;
    const pcs = chord ? chord.pcs : state.setPcs;
    $$('#piano .piano-key').forEach((key) => {
      const midi = Number(key.dataset.midi);
      key.classList.toggle('highlight', pcs.includes(midi % 12));
    });
    if (chord) {
      $('#keyboardReadout').textContent = chord.roman + '：' + chord.noteNames.map(pretty).join(' · ') + '｜点击琴键可单独试听';
    }
  }

  function applyTarget(targetTonic, targetMode, message) {
    state.targetTonic = targetTonic;
    state.targetMode = targetMode;
    if ($('#targetTonic')) $('#targetTonic').value = targetTonic;
    if ($('#targetMode')) $('#targetMode').value = targetMode;
    renderModulation();
    if (message) toast(message);
  }

  function renderRadar() {
    if (!$('#targetRadar')) return;
    const last = state.progression[state.progression.length - 1] || null;
    const limit = state.radarScope === 'all' ? 12 : (state.radarScope === 'parallel' ? 10 : 8);
    const opts = {
      scope: state.radarScope,
      limit,
      perTonicLimit: state.radarScope === 'parallel' ? 10 : 3,
      preferFlats: state.preferFlats || state.targetTonic.includes('b')
    };
    radarTargets = E.modulationTargets(state.tonic, state.mode, state.progression, opts);
    $('#radarHint').textContent = last ? '从当前 ' + pretty(last.roman) + ' 反查' : '从主调反查';
    if (!radarTargets.length) {
      $('#targetRadar').innerHTML = '<div class="radar-empty">当前范围没有可解释的目标，换一个范围或先加入和弦。</div>';
      return;
    }
    $('#targetRadar').innerHTML = radarTargets.map((item, i) => {
      const active = item.targetTonic === state.targetTonic && item.targetMode === state.targetMode;
      const role = item.pivotRoman
        ? (last ? pretty(last.roman) + ' = ' + pretty(item.pivotRoman) : '中介和弦')
        : (item.targetTonicRoman ? '目标主和弦 ' + pretty(item.targetTonicRoman) : item.relation.label);
      return '<button class="radar-item' + (active ? ' active' : '') + '" data-radar="' + i + '" title="' + esc(item.reasons.join(' · ')) + '">' +
        '<span class="radar-top"><span class="radar-target">' + esc(pretty(item.targetLabel)) + '</span><span class="radar-score">' + Math.round(item.score * 100) + '</span></span>' +
        '<span class="radar-role">' + esc(role) + '</span>' +
        '<span class="radar-reason">' + esc(item.reasons.slice(0, 2).join(' · ')) + '</span>' +
      '</button>';
    }).join('');
    $$('#targetRadar [data-radar]').forEach((btn) => btn.addEventListener('click', () => {
      const item = radarTargets[Number(btn.dataset.radar)];
      if (item) applyTarget(item.targetTonic, item.targetMode, '目标已设为 ' + pretty(item.targetLabel));
    }));
  }

  function renderModulation() {
    if (!$('#targetTonic')) return;
    $('#targetTonic').value = state.targetTonic;
    $('#targetMode').value = state.targetMode;
    renderRadar();
    const lastChord = state.progression[state.progression.length - 1] || null;
    const relation = E.keyRelation(state.tonic, state.mode, state.targetTonic, state.targetMode);
    const shared = relation.sharedPcs.map((pc) => noteLabel(pc, state.preferFlats || state.targetTonic.includes('b'))).join(' · ');
    const sourceLabel = keyLabel();
    const targetLabel = pretty(state.targetTonic) + ' ' + E.getMode(state.targetMode).short;
    $('#relationLabel').textContent = relation.label;
    $('#relationCard').innerHTML =
      '<div class="relation-title"><strong>' + esc(sourceLabel) + ' → ' + esc(targetLabel) + '</strong><span class="tag ' + (relation.difficulty < 0.45 ? 'teal' : 'gold') + '">' + esc(relation.label) + '</span></div>' +
      '<div class="relation-grid">' +
        '<div class="relation-stat"><span>共同音</span><b>' + relation.sharedCount + ' / ' + E.scale(state.tonic, state.mode).pcs.length + '</b></div>' +
        '<div class="relation-stat"><span>难度</span><b>' + Math.round(relation.difficulty * 100) + '%</b></div>' +
        '<div class="relation-stat" style="grid-column:1/-1"><span>共同音级</span><b>' + esc(shared || '无') + '</b></div>' +
      '</div>' +
      '<div class="mod-start">' + (lastChord ? '当前进行起点：' + esc(pretty(lastChord.roman)) + ' · ' + esc(lastChord.noteNames.map(pretty).join(' · ')) : '当前从主调开始；加入和弦后会按最后一个和弦反查。') + '</div>';
    const pivots = E.commonPivots(state.tonic, state.mode, state.targetTonic, state.targetMode, { limit: 12 });
    if (!pivots.length) {
      $('#pivotList').innerHTML = '<div class="next-empty">两调没有完全同音集的大/小三和弦；可用共同音、半音声部或新调属和弦直接进入。</div>';
    } else {
      $('#pivotList').innerHTML = pivots.map((p) => {
        return '<div class="pivot-item" title="' + esc(p.explanation) + '"><div class="pivot-item-top"><span class="pivot-note">' + esc(p.noteNames.map(pretty).join(' · ')) + '</span><span class="pivot-functions"><b>' + esc(pretty(p.sourceRoman)) + '</b> → <b>' + esc(pretty(p.targetRoman)) + '</b></span></div>' +
          '<div class="pivot-explain">' + esc(p.sourceFunction) + ' 功能 → ' + esc(p.targetFunction) + ' 功能 · 中介评分 ' + Math.round(p.score * 100) + '</div></div>';
      }).join('');
    }
    routes = E.modulationRoutes(state.tonic, state.mode, state.targetTonic, state.targetMode, {
      limit: 9, startChord: lastChord, startKeyLabel: sourceLabel
    });
    if (!routes.length) {
      $('#routeList').innerHTML = '<div class="next-empty">未能生成路线。请检查调式或尝试近关系目标。</div>';
      return;
    }
    $('#routeList').innerHTML = routes.map((route, i) => {
      const steps = route.steps.map((step, j) => {
        const classNames = ['route-step'];
        if (step.category === 'pivot') classNames.push('is-pivot');
        else if (j === 0) classNames.push('is-source');
        if (j === route.steps.length - 1) classNames.push('is-target');
        const roman = step.sourceRoman && step.targetRoman ? pretty(step.sourceRoman) + ' = ' + pretty(step.targetRoman) : pretty(step.roman);
        return '<div class="' + classNames.join(' ') + '"><span class="step-key">' + esc(step.key || '') + '</span><span class="step-roman">' + esc(roman) + '</span><span class="step-notes">' + esc(step.noteNames.map(pretty).join(' · ')) + '</span></div>';
      }).join('');
      return '<article class="route-card" data-route="' + i + '">' +
        '<div class="route-head"><div class="route-title"><span class="tag gold">' + String(i + 1).padStart(2, '0') + '</span><strong>' + esc(route.recipe) + '</strong><span class="route-score">' + Math.round(route.score * 100) + '%</span></div>' +
          '<div class="route-actions"><button class="small" data-play-route="' + i + '">▶ 试听</button><button class="small" data-use-route="' + i + '">写入进行</button></div></div>' +
        '<div class="route-steps">' + steps + '</div>' +
        '<div class="route-foot"><span class="route-explain">' + esc(route.explanation) + '</span></div>' +
      '</article>';
    }).join('');
    $$('#routeList [data-play-route]').forEach((btn) => btn.addEventListener('click', () => playRoute(Number(btn.dataset.playRoute))));
    $$('#routeList [data-use-route]').forEach((btn) => btn.addEventListener('click', () => {
      const route = routes[Number(btn.dataset.useRoute)];
      if (!route) return;
      state.progression = route.steps.map((step) => step.chord);
      renderProgression();
      renderNext();
      toast('已写入 ' + route.recipe + '，可在推演台试听。');
      switchTab('studio');
    }));
  }

  function playRoute(index) {
    const route = routes[index];
    if (!route) return;
    try {
      const chords = route.steps.map((step) => step.chord);
      const token = ++playbackToken;
      A.playProgression(chords, {
        beat: 0.82,
        onStep: (i) => {
          if (token !== playbackToken) return;
          const card = $('#routeList [data-route="' + index + '"] .route-step:nth-child(' + (i + 1) + ')');
          if (card) { card.style.background = 'var(--gold-soft)'; setTimeout(() => { card.style.background = ''; }, 520); }
        },
        onDone: () => { if (token === playbackToken) toast('路线试听结束'); }
      });
      toast('▶ ' + route.recipe + ' · ' + route.steps.map((s) => pretty(s.roman)).join(' → '));
    } catch (error) { toast(error.message); }
  }

  function categoryMatch(chord, category) {
    if (category === 'all') return true;
    if (category === 'chromatic') return ['neapolitan','aug6','tritoneSub','chromaticMediant'].includes(chord.category);
    return chord.category === category;
  }

  function renderLibrary() {
    if (!$('#libraryTable')) return;
    libraryCatalog = E.buildCatalog(state.tonic, state.mode, { sevenths: state.librarySevenths, secondary: true, borrowed: true, chromatic: true });
    const q = state.librarySearch.trim().toLowerCase();
    const list = libraryCatalog.filter((chord) => {
      if (!categoryMatch(chord, state.libraryCategory)) return false;
      if (!q) return true;
      const haystack = [chord.roman, chord.rootName, chord.quality.name, chord.functionLabel, chord.category]
        .concat(chord.noteNames, chord.tags || [], (chord.roles || []).map((r) => r.roman + ' ' + r.functionLabel)).join(' ').toLowerCase();
      return haystack.includes(q);
    });
    const head = '<thead><tr><th>级数</th><th>弦音</th><th>性质</th><th>功能</th><th>类别</th><th style="text-align:right">操作</th></tr></thead>';
    const rows = list.map((chord, i) => {
      const cat = CATEGORY_NAMES[chord.category] || chord.category;
      const tendencies = (chord.tendency || []).map((t) => t.label).slice(0, 1).join('；');
      return '<tr><td class="t-roman">' + esc(pretty(chord.roman)) + '</td><td class="t-notes">' + esc(chord.noteNames.map(pretty).join(' · ')) + '</td>' +
        '<td>' + esc(chord.quality.name) + '</td><td>' + esc(chord.functionLabel || chord.function) + (tendencies ? '<div class="t-cat">' + esc(tendencies) + '</div>' : '') + '</td>' +
        '<td class="t-cat">' + esc(cat) + '</td><td class="t-action"><button class="small" data-lib-select="' + i + '">原理</button><button class="small" data-lib-play="' + i + '">▶</button><button class="small primary" data-lib-add="' + i + '">加入</button></td></tr>';
    }).join('');
    $('#libraryTable').innerHTML = head + '<tbody>' + (rows || '<tr><td colspan="6" class="next-empty">没有匹配结果。</td></tr>') + '</tbody>';
    $$('#libraryTable [data-lib-select]').forEach((btn) => btn.addEventListener('click', () => {
      const chord = list[Number(btn.dataset.libSelect)];
      if (chord) selectChord(chord);
    }));
    $$('#libraryTable [data-lib-play]').forEach((btn) => btn.addEventListener('click', () => {
      const chord = list[Number(btn.dataset.libPlay)];
      if (chord) playChord(chord);
    }));
    $$('#libraryTable [data-lib-add]').forEach((btn) => btn.addEventListener('click', () => {
      const chord = list[Number(btn.dataset.libAdd)];
      if (chord) { selectChord(chord); addToProgression(chord); }
    }));
  }

  function renderModeGallery() {
    if (!$('#modeGallery')) return;
    $('#modeGallery').innerHTML = D.MODES.map((mode) => {
      const scale = E.scale(state.tonic, mode.id);
      return '<button class="mode-card' + (mode.id === state.mode ? ' active' : '') + '" data-mode-id="' + esc(mode.id) + '">' +
        '<strong>' + esc(mode.name) + '</strong><span>' + esc(mode.mood) + '</span>' +
        '<div class="mode-notes">' + esc(scale.notes.map((n) => pretty(n.name)).join(' · ')) + '</div>' +
      '</button>';
    }).join('');
    $$('#modeGallery [data-mode-id]').forEach((btn) => btn.addEventListener('click', () => {
      state.mode = btn.dataset.modeId;
      $('#mode').value = state.mode;
      refreshAll();
    }));
  }

  function parsePcInput(text) {
    const clean = String(text || '').replace(/[\[\](){}]/g, ' ').trim();
    const tokens = clean.split(/[\s,;，；、]+/).filter(Boolean);
    if (!tokens.length) throw new Error('请输入至少一个音级');
    const pcs = tokens.map((token) => {
      if (/^-?\d+$/.test(token)) return P.mod(Number(token), 12);
      return P.pcOf(token);
    });
    return P.uniquePcs(pcs);
  }

  function renderPcPicker() {
    $('#pcPicker').innerHTML = Array.from({ length: 12 }, (_, pc) => {
      const active = state.setPcs.includes(pc);
      return '<button class="pc-chip' + (active ? ' active' : '') + '" data-pc="' + pc + '" title="' + esc(setNoteLabel(pc)) + '">' + esc(setNoteLabel(pc)) + '</button>';
    }).join('');
    $$('#pcPicker [data-pc]').forEach((btn) => btn.addEventListener('click', () => {
      const pc = Number(btn.dataset.pc);
      if (state.setPcs.includes(pc)) state.setPcs = state.setPcs.filter((x) => x !== pc);
      else state.setPcs = P.uniquePcs(state.setPcs.concat(pc));
      $('#pcInput').value = state.setPcs.map((x) => setNoteLabel(x)).join(' ');
      renderPcPicker();
      syncNeoFromSet();
      analyzeCurrentSet();
    }));
  }

  function syncNeoFromSet() {
    if (state.setPcs.length !== 3) return false;
    for (const root of state.setPcs) {
      const rel = state.setPcs.map((pc) => P.mod(pc - root, 12)).sort((a, b) => a - b).join(',');
      if (rel === '0,4,7' || rel === '0,3,7') {
        const quality = rel === '0,4,7' ? 'maj' : 'min';
        const changed = !state.neo || state.neo.rootPc !== root || state.neo.quality !== quality;
        state.neo = { rootPc: root, quality, path: [{ rootPc: root, quality }] };
        if (changed) renderNeo();
        return true;
      }
    }
    return false;
  }

  function analyzeCurrentSet(preserveNeo) {
    const pcs = state.setPcs;
    if (!pcs.length) {
      $('#setResult').innerHTML = '<div class="set-error">请至少选择一个音级。</div>';
      return;
    }
    if (!preserveNeo) syncNeoFromSet();
    const info = E.setClassInfo(pcs);
    const primeKey = info.primeForm.join(',');
    const common = D.COMMON_SET_CLASSES.find((item) => E.primeForm(item.pcs).join(',') === primeKey);
    const complementPcs = info.complement;
    $('#setResult').innerHTML =
      '<div class="set-summary"><div class="set-notes">' + esc(pcs.map((pc) => setNoteLabel(pc)).join(' · ')) + '</div>' +
        '<div class="set-prime">' + (common ? esc(common.name) + ' · ' + esc(common.note) : '音级集合 · 无序') + '</div></div>' +
      '<div class="stat-row">' +
        '<div class="stat-box"><span>常态</span><b>[' + info.normalForm.join(', ') + ']</b></div>' +
        '<div class="stat-box"><span>基本形</span><b>[' + info.primeForm.join(', ') + ']</b></div>' +
        '<div class="stat-box"><span>基数</span><b>' + info.cardinality + ' 音</b></div>' +
        '<div class="stat-box"><span>补集</span><b>' + (complementPcs.length ? complementPcs.length + ' 音 [' + complementPcs.join(', ') + ']' : '空') + '</b></div>' +
      '</div>' +
      '<div class="subsection-head"><h3>音程向量</h3><span class="muted">ic1 → ic6</span></div>' +
      '<div class="vector">' + info.intervalVector.map((n) => '<i>' + n + '</i>').join('') + '</div>' +
      '<div class="tag-row" style="margin-top:9px"><span class="tag teal">移位 12</span><span class="tag teal">倒影 12</span><span class="tag gold">' + esc(common ? common.tag : '集合类') + '</span></div>';
    renderSetRelations(pcs);
  }

  function renderSetRelations(pcs) {
    const target = P.uniquePcs(pcs);
    const scaleMatches = [];
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      const tonicName = P.enharmonicName(tonicPc, false);
      for (const mode of D.MODES) {
        const current = E.scale(tonicName, mode.id);
        if (target.every((pc) => current.pcs.includes(pc))) {
          scaleMatches.push({ tonicPc, tonicName, mode, scale: current });
        }
      }
    }
    const shownScales = scaleMatches.slice(0, 60);
    $('#setScales').innerHTML = shownScales.map((match, i) => {
      return '<button class="chip" data-set-tkey="' + i + '">' + esc(noteLabel(match.tonicPc, match.tonicName.includes('b'))) + ' ' + esc(match.mode.short) +
        '<small>' + esc(match.scale.notes.map((n) => pretty(n.name)).join(' ')) + '</small></button>';
    }).join('') + (scaleMatches.length > shownScales.length ? '<span class="chip-empty">另有 ' + (scaleMatches.length - shownScales.length) + ' 个包含关系…</span>' : '');
    if (!scaleMatches.length) $('#setScales').innerHTML = '<span class="chip-empty">没有七声/五声/对称音阶完整包含这个集合。</span>';
    $$('#setScales [data-set-tkey]').forEach((btn) => btn.addEventListener('click', () => {
      const match = shownScales[Number(btn.dataset.setTkey)];
      if (!match) return;
      state.tonic = match.tonicName;
      state.mode = match.mode.id;
      state.preferFlats = state.tonic.includes('b');
      $('#tonic').value = state.tonic;
      $('#mode').value = state.mode;
      refreshAll();
      toast('已切换到 ' + P.prettyAccidental(state.tonic) + ' ' + match.mode.short);
    }));
    const chords = E.chordsContaining(target, state.tonic, state.mode).slice(0, 24);
    $('#setChords').innerHTML = chords.map((chord, i) => {
      return '<button class="chip" data-set-chord="' + i + '">' + esc(pretty(chord.roman)) + '<small>' + esc(chord.noteNames.map(pretty).join(' · ')) + '</small></button>';
    }).join('') || '<span class="chip-empty">当前调性库存中没有完整包含该集合的和弦。</span>';
    $$('#setChords [data-set-chord]').forEach((btn) => btn.addEventListener('click', () => {
      const chord = chords[Number(btn.dataset.setChord)];
      if (chord) { selectChord(chord); playChord(chord); }
    }));
  }

  function chordFromNeo(node) {
    const rootName = P.enharmonicName(node.rootPc, state.preferFlats);
    return E.makeChord({ rootName, quality: node.quality, roman: P.prettyAccidental(rootName) + (node.quality === 'min' ? 'm' : ''), category:'chromaticMediant' });
  }

  function renderNeo() {
    if (!$('#neoRiemann')) return;
    if (!state.neo.path || !state.neo.path.length) state.neo.path = [{ rootPc: state.neo.rootPc, quality: state.neo.quality }];
    const current = state.neo.path[state.neo.path.length - 1];
    const chord = chordFromNeo(current);
    $('#neoRiemann').innerHTML =
      '<div class="neo-current"><div><strong>' + esc(chord.noteNames.map(pretty).join(' · ')) + '</strong><span>' + (current.quality === 'maj' ? '大三和弦' : '小三和弦') + ' · pc ' + current.rootPc + '</span></div><button class="small primary" id="neoPlay">▶</button></div>' +
      '<div class="neo-ops"><button class="small" data-neo-op="P">P 平行</button><button class="small" data-neo-op="L">L 导音</button><button class="small" data-neo-op="R">R 关系</button><button class="small" id="neoReset">重置</button></div>' +
      '<div class="neo-path">' + state.neo.path.map((node, i) => '<b>' + esc(P.prettyAccidental(P.enharmonicName(node.rootPc, state.preferFlats))) + (node.quality === 'min' ? 'm' : '') + '</b>' + (i < state.neo.path.length - 1 ? '<i>' + esc((state.neo.ops && state.neo.ops[i]) || '→') + '</i>' : '')).join('') + '</div>' +
      '<div class="muted" style="font-size:10px;line-height:1.5">P 保持根音/五音、换三音；L 与 R 分别沿三度轴移动，是调性内部与色彩中介的桥梁。</div>';
    $('#neoPlay').addEventListener('click', () => playChord(chord));
    $$('#neoRiemann [data-neo-op]').forEach((btn) => btn.addEventListener('click', () => {
      const next = E.neoRiemann(current.rootPc, current.quality, btn.dataset.neoOp);
      state.neo.path.push(next);
      (state.neo.ops || (state.neo.ops = [])).push(btn.dataset.neoOp);
      state.setPcs = E.makeChord({ rootName:P.enharmonicName(next.rootPc, false), quality:next.quality }).pcs;
      $('#pcInput').value = state.setPcs.map((pc) => setNoteLabel(pc)).join(' ');
      renderPcPicker();
      renderNeo();
      analyzeCurrentSet(true);
    }));
    $('#neoReset').addEventListener('click', () => {
      const root = state.neo.path[0].rootPc;
      state.neo = { rootPc: root, quality: state.neo.path[0].quality, path: [{ rootPc: root, quality: state.neo.path[0].quality }], ops: [] };
      renderNeo();
    });
  }

  function renderMatrix() {
    const raw = $('#twelveToneRow').value;
    try {
      const pcs = parsePcInput(raw);
      if (pcs.length !== 12) throw new Error('十二音序列必须恰好含 12 个不同音级');
      const matrix = E.twelveToneMatrix(pcs);
      const rowLabels = matrix.map((row) => 'P' + row[0]);
      const colLabels = matrix[0].map((pc) => 'I' + pc);
      $('#matrixResult').innerHTML = '<table class="matrix-table"><thead><tr><th></th>' + colLabels.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' +
        matrix.map((row, i) => '<tr><th>' + esc(rowLabels[i]) + '</th>' + row.map((pc) => '<td>' + pc + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    } catch (error) {
      $('#matrixResult').innerHTML = '<div class="matrix-error">' + esc(error.message) + '</div>';
    }
  }

  function activePeriod() {
    return (D.PERIODS || []).find((period) => period.id === state.periodFilter) || null;
  }

  function renderPeriodBasis(period) {
    const host = $('#periodBasis');
    if (!host) return;
    if (!period) {
      host.innerHTML = '<p class="period-basis-hint">三个阶段按宏观和声语法划分，19 世纪至 20 世纪中叶允许重叠。点击阶段卡可聚焦相关节点并查看教材依据。</p>';
      return;
    }
    const profiles = {};
    ((S && S.bookProfiles) || []).forEach((profile) => { profiles[profile.book] = profile; });
    const refs = (period.basis || []).map((ref, index) => {
      const profile = profiles[ref.book] || {};
      const label = profile.short || ref.book;
      const file = '../docs/books/' + ref.book + '.html#' +
        refAnchor('period', period.id + '-' + (index + 1), ref.page);
      const source = file
        ? '<a href="' + esc(file) + '" target="_blank" rel="noopener">' + esc(label) + ' · PDF p.' + ref.page + ' · 原文定位</a>'
        : esc(label) + ' · PDF p.' + ref.page;
      return '<li>' + source + '　<q>' + esc(ref.quote) + '</q></li>';
    }).join('');
    const variables = '<b>新增变量</b>：' + esc((period.changes || []).join('；')) +
      '<br><b>和声结果</b>：' + esc((period.consequences || []).join('；')) +
      '<br><b>未变条件</b>：' + esc((period.unchanged || []).join('；'));
    host.innerHTML = '<div class="period-basis-card"><div class="period-basis-head"><strong>' + esc(period.name) + '</strong>' +
      '<span class="period-basis-time">' + esc(period.span) + ' · ' + esc(period.tagline) + '</span></div>' +
      '<p>' + esc(period.note) + '</p><p>' + variables + '</p>' +
      (refs ? '<ul class="period-basis-refs">' + refs + '</ul>' : '') + '</div>';
  }

  function renderPeriodTimeline() {
    const host = $('#periodTimeline');
    if (!host) return;
    host.innerHTML = (D.PERIODS || []).map((period) => {
      const active = state.periodFilter === period.id;
      return '<button class="period-card' + (active ? ' active' : '') + '" data-period-id="' + esc(period.id) + '" aria-pressed="' + active + '">' +
        '<span class="period-span">' + esc(period.span) + '</span>' +
        '<strong>' + esc(period.name) + '</strong>' +
        '<p>' + esc(period.tagline) + '</p>' +
        '<span class="period-meta">' + period.nodes.length + ' 个节点 · ' + period.books.length + ' 本参考</span>' +
      '</button>';
    }).join('');
    $$('#periodTimeline [data-period-id]').forEach((btn) => btn.addEventListener('click', () => {
      state.periodFilter = state.periodFilter === btn.dataset.periodId ? null : btn.dataset.periodId;
      renderTheoryMap();
    }));
    renderPeriodBasis(activePeriod());
  }

  function renderTheoryMap() {
    if (!$('#theoryMap')) return;
    renderPeriodTimeline();
    const period = activePeriod();
    const layers = {};
    D.THEORY_MAP.forEach((node) => (layers[node.layer] || (layers[node.layer] = [])).push(node));
    $('#theoryMap').innerHTML = Object.keys(layers).sort((a, b) => Number(a) - Number(b)).map((layer) => {
      return '<div class="map-layer" data-layer="' + layer + '"><div class="map-layer-title"><span>' + esc(LAYER_NAMES[layer] || ('层 ' + layer)) + '</span></div>' +
        layers[layer].map((node) => {
          const periodClass = !period ? '' : (period.nodes.includes(node.id) ? ' period-focus' : ' period-muted');
          return '<button class="theory-node' + (state.theoryNode === node.id ? ' selected' : '') + periodClass + '" data-node-id="' + esc(node.id) + '">' +
          '<span class="node-layer">L' + node.layer + ' · ' + node.prerequisites.length + ' 先修</span><strong>' + esc(node.title) + '</strong>' +
          '<span class="node-links">' + (node.enables.length ? '→ ' + node.enables.length + ' 后续' : '终点节点') + '</span></button>';
        }).join('') + '</div>';
    }).join('<div class="map-layer" aria-hidden="true"></div>');
    $$('#theoryMap [data-node-id]').forEach((btn) => btn.addEventListener('click', () => showMapNode(btn.dataset.nodeId)));
    requestAnimationFrame(drawMapThreads);
  }

  function drawMapThreads() {
    const host = $('#theoryMap');
    if (!host) return;
    const old = $('.map-threads', host);
    if (old) old.remove();
    const hostRect = host.getBoundingClientRect();
    const ns = 'http://www.w3.org/2000/svg';
    const period = activePeriod();
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'map-threads');
    svg.setAttribute('width', host.scrollWidth);
    svg.setAttribute('height', host.scrollHeight);
    svg.setAttribute('viewBox', '0 0 ' + host.scrollWidth + ' ' + host.scrollHeight);
    const nodes = new Map();
    $$('#theoryMap [data-node-id]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      nodes.set(el.dataset.nodeId, {
        left: rect.left - hostRect.left + host.scrollLeft,
        right: rect.right - hostRect.left + host.scrollLeft,
        top: rect.top - hostRect.top + host.scrollTop,
        bottom: rect.bottom - hostRect.top + host.scrollTop
      });
    });
    D.THEORY_MAP.forEach((node) => {
      const target = nodes.get(node.id);
      if (!target) return;
      node.prerequisites.forEach((prereq) => {
        const source = nodes.get(prereq);
        if (!source) return;
        const x1 = source.right;
        const y1 = (source.top + source.bottom) / 2;
        const x2 = target.left;
        const y2 = (target.top + target.bottom) / 2;
        const bend = Math.max(16, (x2 - x1) * 0.45);
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', period
          ? (period.nodes.includes(node.id) && period.nodes.includes(prereq) ? 'rgba(240,180,91,0.38)' : 'rgba(150,174,205,0.07)')
          : 'rgba(150,174,205,0.26)');
        path.setAttribute('stroke-width', '1');
        svg.appendChild(path);
      });
    });
    host.insertBefore(svg, host.firstChild);
  }

  function showMapNode(nodeId) {
    const node = D.THEORY_MAP.find((n) => n.id === nodeId);
    if (!node) return;
    state.theoryNode = nodeId;
    $$('#theoryMap .theory-node').forEach((el) => el.classList.toggle('selected', el.dataset.nodeId === nodeId));
    const isNode = (id) => D.THEORY_MAP.some((x) => x.id === id);
    const title = (id) => {
      const n = D.THEORY_MAP.find((x) => x.id === id);
      return n ? n.title : ((D.OUTCOME_LABELS || {})[id] || id);
    };
    const relationChip = (id) => isNode(id)
      ? '<button class="relation-chip" data-map-rel="' + esc(id) + '">' + esc(title(id)) + '</button>'
      : '<span class="relation-chip external" title="应用结果，不是理论节点">' + esc(title(id)) + '</span>';
    const periods = (D.PERIODS || []).filter((period) => period.nodes.includes(node.id));
    $('#mapDetail').innerHTML = '<div class="map-detail-content"><span class="layer-badge">' + esc(LAYER_NAMES[node.layer] || ('层 ' + node.layer)) + ' · L' + node.layer + '</span>' +
      '<h3>' + esc(node.title) + '</h3>' +
      '<div class="period-chips">' + periods.map((period) => '<button class="period-chip' + (state.periodFilter === period.id ? ' active' : '') + '" data-map-period="' + esc(period.id) + '">' + esc(period.short) + ' · ' + esc(period.span) + '</button>').join('') + '</div>' +
      '<p>' + esc(node.principle) + '</p>' +
      '<h4>操作</h4><ul>' + node.operations.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<h4>应用</h4><div class="tag-row">' + node.applications.map((x) => '<span class="tag gold">' + esc(x) + '</span>').join('') + '</div>' +
      '<h4>先修</h4><div class="relation-chips">' + (node.prerequisites.length ? node.prerequisites.map(relationChip).join('') : '<span class="muted">无：这是起点。</span>') + '</div>' +
      '<h4>后续</h4><div class="relation-chips">' + (node.enables.length ? node.enables.map(relationChip).join('') : '<span class="muted">无：这是终点。</span>') + '</div>' +
      '<h4>教材依据</h4>' + sourceEvidenceHtml(node) + '</div>';
    $$('#mapDetail [data-map-rel]').forEach((btn) => btn.addEventListener('click', () => showMapNode(btn.dataset.mapRel)));
    $$('#mapDetail [data-map-period]').forEach((btn) => btn.addEventListener('click', () => {
      state.periodFilter = state.periodFilter === btn.dataset.mapPeriod ? null : btn.dataset.mapPeriod;
      renderTheoryMap();
      showMapNode(nodeId);
    }));
  }

  function sourceEvidenceHtml(node) {
    if (!S || !Array.isArray(S.claims)) {
      return '<ul class="source-list">' + node.sources.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    }
    const profiles = {};
    (S.bookProfiles || []).forEach((profile) => { profiles[profile.book] = profile; });
    const claims = S.claims.filter((claim) => claim.node === node.id);
    if (!claims.length) return '<p class="source-empty">该节点尚无直接页码证据。</p>';
    return '<ul class="source-list">' + claims.map((claim) => {
      const refs = claim.books.map((ref) => {
        const profile = profiles[ref.book] || {};
        const label = profile.short || ref.book;
        const file = '../docs/books/' + ref.book + '.html#' + refAnchor('claim', claim.id, ref.page);
        const page = '<a href="' + esc(file) + '" target="_blank" rel="noopener">PDF p.' + ref.page + ' · 原文定位</a>';
        return '<div class="source-ref"><span>' + esc(label) + ' · ' + page + '</span><q>' + esc(ref.quote) + '</q></div>';
      }).join('');
      return '<li><b>' + esc(claim.claim) + '</b>' + refs + '<span class="source-id">' + esc(claim.id) + ' · ' + esc(claim.confidence) + '</span></li>';
    }).join('') + '</ul>';
  }

  function playCurrentProgression() {
    if (!state.progression.length) { toast('先加入至少一个和弦。'); return; }
    try {
      const token = ++playbackToken;
      $$('#progression .prog-item').forEach((el) => el.classList.remove('playing'));
      A.playProgression(state.progression, {
        beat: 0.78,
        onStep: (i, chord) => {
          if (token !== playbackToken) return;
          $$('#progression .prog-item').forEach((el) => el.classList.remove('playing'));
          const item = $('#progression .prog-item[data-prog="' + i + '"]');
          if (item) item.classList.add('playing');
          $('#progressionHint').textContent = '正在播放：' + pretty(chord.roman) + ' · ' + chord.noteNames.map(pretty).join(' · ');
        },
        onDone: () => {
          if (token !== playbackToken) return;
          $$('#progression .prog-item').forEach((el) => el.classList.remove('playing'));
          renderAnalysis();
        }
      });
    } catch (error) { toast(error.message); }
  }

  function exportMidi() {
    if (!state.progression.length) { toast('进行为空，无法导出 MIDI。'); return; }
    const bytes = M.buildMidi(state.progression);
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'harmony-' + state.tonic.replace('#', 's') + '-' + state.mode + '.mid';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出 MIDI：' + state.progression.length + ' 个和弦，120 BPM。');
  }

  function toast(message) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function switchTab(name) {
    state.activeTab = name;
    $$('#tabs .tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + name));
    const activeTab = $('#tabs .tab.active');
    if (activeTab) requestAnimationFrame(() => activeTab.scrollIntoView({ block: 'nearest', inline: 'center' }));
    if (name === 'modulate') renderModulation();
    if (name === 'map') requestAnimationFrame(drawMapThreads);
  }

  function initTabs() {
    $$('#tabs .tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  }

  function initStudioEvents() {
    $$('#catalogFilter button').forEach((btn) => btn.addEventListener('click', () => {
      state.catalogFilter = btn.dataset.filter;
      $$('#catalogFilter button').forEach((b) => b.classList.toggle('active', b === btn));
      renderPalette();
    }));
    $('#includeSevenths').addEventListener('change', (e) => { state.includeSevenths = e.target.checked; refreshAll(); });
    $('#includeChromatic').addEventListener('change', (e) => { state.includeChromatic = e.target.checked; refreshAll(); });
    $$('#nextFilter button').forEach((btn) => btn.addEventListener('click', () => {
      state.nextFilter = btn.dataset.next;
      $$('#nextFilter button').forEach((b) => b.classList.toggle('active', b === btn));
      renderNext();
    }));
    $$('#radarScope button').forEach((btn) => btn.addEventListener('click', () => {
      state.radarScope = btn.dataset.scope;
      $$('#radarScope button').forEach((b) => b.classList.toggle('active', b === btn));
      renderRadar();
    }));
    $('#btnUndo').addEventListener('click', () => {
      if (!state.progression.length) { toast('没有可撤销的和弦。'); return; }
      state.progression.pop();
      renderProgression();
      renderNext();
      renderPianoHighlight();
    });
    $('#btnClear').addEventListener('click', () => {
      state.progression = [];
      renderProgression();
      renderNext();
    });
    $('#btnPlayProg').addEventListener('click', playCurrentProgression);
    $('#btnMidi').addEventListener('click', exportMidi);
  }

  function initLibraryEvents() {
    $('#librarySearch').addEventListener('input', (e) => {
      state.librarySearch = e.target.value;
      renderLibrary();
    });
    $('#libraryCategory').addEventListener('change', (e) => {
      state.libraryCategory = e.target.value;
      renderLibrary();
    });
    $('#librarySevenths').addEventListener('change', (e) => {
      state.librarySevenths = e.target.checked;
      renderLibrary();
    });
  }

  function initSetEvents() {
    $('#btnAnalyzeSet').addEventListener('click', () => {
      try {
        const rawInput = $('#pcInput').value;
        state.setPreferFlats = /[b♭]/.test(rawInput);
        state.setPcs = parsePcInput(rawInput);
        if (!state.setPcs.length) throw new Error('至少选择一个音级');
        renderPcPicker();
        analyzeCurrentSet();
        toast('已分析集合 [' + state.setPcs.join(', ') + ']');
      } catch (error) {
        $('#setResult').innerHTML = '<div class="set-error">' + esc(error.message) + '</div>';
      }
    });
    $('#pcInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#btnAnalyzeSet').click();
    });
    $('#btnMatrix').addEventListener('click', renderMatrix);
  }

  function initModalEvents() {
    const open = () => $('#helpModal').classList.remove('hidden');
    const close = () => $('#helpModal').classList.add('hidden');
    $('#btnHelp').addEventListener('click', open);
    $('#btnCloseHelp').addEventListener('click', close);
    $('#helpModal').addEventListener('click', (e) => { if (e.target === $('#helpModal')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function init() {
    if (!D || !E || !P || !A || !M) {
      document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">资源加载失败：请确认 js/ 目录中的 pitch.js、theory-data.js、engine.js、audio.js 与 app.js 均存在。</div>';
      return;
    }
    initHeader();
    initTabs();
    initStudioEvents();
    initLibraryEvents();
    initSetEvents();
    initModalEvents();
    $('#pcInput').value = state.setPcs.map((x) => setNoteLabel(x)).join(' ');
    $('#twelveToneRow').value = 'C C# D D# E F F# G G# A A# B';
    renderPiano();
    renderPcPicker();
    catalog = E.buildCatalog(state.tonic, state.mode, catalogOptions());
    renderPalette();
    renderProgression();
    renderNext();
    renderModulation();
    renderLibrary();
    renderModeGallery();
    renderNeo();
    analyzeCurrentSet();
    renderTheoryMap();
    $('#footerMeta').textContent = '15 本独立教材 · ' + D.THEORY_MAP.length + ' 个理论节点 · 离线运行';
    window.addEventListener('resize', () => {
      clearTimeout(mapResizeTimer);
      mapResizeTimer = setTimeout(drawMapThreads, 160);
    });
    setTimeout(() => { if (state.activeTab === 'map') drawMapThreads(); }, 120);
  }

  init();
})();
