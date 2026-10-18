/* engine.js — harmony computation and recommendation engine. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pitch.js'), require('./theory-data.js'));
  else root.HarmonyEngine = factory(root.HarmonyPitch, root.HarmonyData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, D) {
  'use strict';
  const MODES = Object.fromEntries(D.MODES.map(m => [m.id, m]));
  const QUALITIES = D.QUALITIES;
  const ROMAN = ['I','II','III','IV','V','VI','VII','VIII'];
  const ALL_PCS = [0,1,2,3,4,5,6,7,8,9,10,11];
  const mod = P.mod;
  const pcSet = P.uniquePcs;
  const setKey = P.pcSetKey;
  const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
  const PERIOD_ORDER = ['commonPractice', 'expandedTonality', 'modernPostTonal'];
  const PERIOD_META = Object.fromEntries((D.PERIODS || []).map(period => [period.id, period]));
  const SATB_VOICES = ['bass', 'tenor', 'alto', 'soprano'];
  const SATB_VOICE_LABELS = { bass:'B', tenor:'T', alto:'A', soprano:'S' };
  const SATB_RANGES = {
    bass: [40, 60],
    tenor: [48, 67],
    alto: [55, 74],
    soprano: [60, 84]
  };
  const SATB_CENTERS = { bass:48, tenor:57, alto:64, soprano:72 };
  const SATB_MAX_GAPS = { bass:Infinity, tenor:19, alto:12, soprano:12 };
  const INVERSION_LABELS = ['原位', '第一转位', '第二转位', '第三转位'];
  const PERIOD_STYLE_CATEGORIES = {
    commonPractice: ['diatonic', 'secondary', 'neapolitan', 'aug6'],
    expandedTonality: ['diatonic', 'secondary', 'borrowed', 'neapolitan', 'aug6', 'chromaticMediant'],
    modernPostTonal: null
  };
  const DEFAULT_SCORE_WEIGHTS = { flow:0.34, root:0.20, voice:0.20, common:0.10, stability:0.06 };
  const PERIOD_SCORE_WEIGHTS = {
    commonPractice: { flow:0.46, root:0.18, voice:0.16, common:0.07, stability:0.05 },
    expandedTonality: { flow:0.31, root:0.18, voice:0.22, common:0.11, stability:0.06 },
    modernPostTonal: { flow:0.16, root:0.12, voice:0.28, common:0.21, stability:0.10 }
  };
  const PERIOD_SHOWCASE_ORDER = {
    commonPractice: ['diatonic', 'secondary', 'neapolitan', 'aug6'],
    expandedTonality: ['borrowed', 'chromaticMediant', 'neapolitan', 'aug6', 'secondary', 'diatonic'],
    modernPostTonal: ['modal', 'tritoneSub', 'chromaticMediant', 'borrowed', 'neapolitan', 'aug6', 'secondary', 'diatonic']
  };
  const PERIOD_CATEGORY_REASONS = {
    diatonic: {
      commonPractice: '调内三/七和弦是 T–S–D 功能与终止式的基本材料',
      expandedTonality: '仍作为调性骨架，外围可接交替和弦、变和弦和更远的根音关系',
      modernPostTonal: '可保留为调性/调式段落，也可只作为音高材料使用'
    },
    secondary: {
      commonPractice: '副属/副导把目标和弦临时主音化，是共同实践中的局部离调',
      expandedTonality: '局部主音化可推向更远的级数，并可推迟或弱化解决',
      modernPostTonal: '可作为有调性片段中的局部张力，也可被色彩连接吸收'
    },
    borrowed: {
      expandedTonality: '同主音调式交替用特征音改变调式色彩，同时保留主音中心',
      modernPostTonal: '调式交替可与调式音阶、非功能连接和持续音结合'
    },
    neapolitan: {
      commonPractice: '拿波里和弦以 ♭II 取代常规下属，半音下行到属，属共同实践变和弦',
      expandedTonality: '拿波里可脱离标准终止，作为色彩和弦或远关系枢纽',
      modernPostTonal: '可作为半音色彩、调式特征或音高集合的一部分'
    },
    aug6: {
      commonPractice: '增六和弦以 ♭6 与 ♯4 向外扩张到属，是共同实践的属前变和弦',
      expandedTonality: '增六可等音重释、连接远调，并与其他变和弦形成网络',
      modernPostTonal: '可作为半音张力或等音关系材料，但不必按传统方向解决'
    },
    chromaticMediant: {
      expandedTonality: '三度关系的色彩中介弱化功能流，用共同音和声部平滑维持联系',
      modernPostTonal: '三度关系可进一步脱离调性功能，成为独立的和弦色彩组织'
    },
    tritoneSub: {
      modernPostTonal: '三全音替代用 ♭II7 共享 V7 的三全音，属于 20 世纪爵士/流行语法'
    },
    modal: {
      modernPostTonal: '调式/对称音阶用音阶本身限定可用和弦，功能中心可保留、悬置或取消'
    }
  };
  const PERIOD_EXCLUSION_REASONS = {
    borrowed: {
      commonPractice: '本台的“古典”档不收同主音调式交替库存；交替和弦放在“扩张”档。'
    },
    chromaticMediant: {
      commonPractice: '色彩中介主要按三度关系和色彩组织，本台归入“扩张”与“现代”档。'
    },
    tritoneSub: {
      commonPractice: '三全音替代来自 20 世纪爵士/流行和声，不属于共同实践核心。',
      expandedTonality: '本台把爵士三全音替代归入“现代”档。'
    },
    modal: {
      commonPractice: '调式/对称材料不在共同实践的功能库存中。',
      expandedTonality: '本台把调式/对称库存归入“现代”档。'
    }
  };

  function getMode(modeId) {
    const m = MODES[modeId];
    if (!m) throw new Error('unknown mode: ' + modeId);
    return m;
  }
  function getQuality(id) {
    const q = QUALITIES[id];
    if (!q) throw new Error('unknown quality: ' + id);
    return q;
  }
  function normalizePcs(values) {
    return pcSet((values || []).map(value => typeof value === 'string' ? P.pcOf(value) : mod(Number(value), 12)));
  }
  function chordToneRole(chord, pc) {
    if (!chord || !chord.quality) return null;
    pc = typeof pc === 'string' ? P.pcOf(pc) : mod(Number(pc), 12);
    const intervals = chord.quality.intervals || [];
    const noteIndex = chord.notes ? chord.notes.findIndex(note => mod(note.pc, 12) === pc) : -1;
    const index = noteIndex >= 0 ? noteIndex : intervals.findIndex(interval => mod(chord.rootPc + interval, 12) === pc);
    if (index < 0) return null;
    const letterStep = chord.quality.steps && chord.quality.steps[index] != null ? chord.quality.steps[index] : index * 2;
    const degree = letterStep + 1;
    const names = {
      1:'根音', 2:'二音', 3:'三音', 4:'四音', 5:'五音', 6:'六音', 7:'七音',
      8:'八音', 9:'九音', 10:'十音', 11:'十一音', 12:'十二音', 13:'十三音'
    };
    return names[degree] || ('第 ' + degree + ' 音');
  }
  function chordToneRoles(chord, requiredPcs) {
    return normalizePcs(requiredPcs).map(pc => ({ pc, role:chordToneRole(chord, pc) }));
  }
  function periodAssessment(chord) {
    const category = chord && chord.category ? chord.category : 'chromatic';
    return PERIOD_ORDER.map(id => {
      const allowed = PERIOD_STYLE_CATEGORIES[id];
      const applicable = !allowed || allowed.includes(category);
      const period = PERIOD_META[id] || {};
      const categoryReasons = PERIOD_CATEGORY_REASONS[category] || {};
      const exclusions = PERIOD_EXCLUSION_REASONS[category] || {};
      return {
        id,
        short: period.short || id,
        name: period.name || id,
        span: period.span || '',
        applicable,
        reason: applicable
          ? (categoryReasons[id] || '该和弦材料可用于这一时期的和声语法')
          : (exclusions[id] || '该类别不在本档的可选和弦库存中')
      };
    });
  }
  function chordPeriodFits(chord) {
    return periodAssessment(chord).filter(item => item.applicable);
  }
  function periodAllowsChord(periodId, chord) {
    const allowed = PERIOD_STYLE_CATEGORIES[periodId];
    return !allowed || (!!chord && allowed.includes(chord.category));
  }
  function chordIncludesPcs(chord, requiredPcs) {
    const required = normalizePcs(requiredPcs);
    return required.every(pc => chord.pcs.includes(pc));
  }
  function scale(tonicName, modeId) {
    const mode = getMode(modeId);
    const tonic = P.parseNote(tonicName);
    let notes;
    if (mode.intervals.length === 7) {
      notes = P.spellScale(tonic.name, mode.intervals);
    } else {
      const preferFlats = tonic.name.includes('b');
      notes = mode.intervals.map((semi, i) => {
        const pc = mod(tonic.pc + semi, 12);
        const nm = P.enharmonicName(pc, preferFlats);
        return Object.assign(P.parseNote(nm), { degree: i + 1 });
      });
    }
    notes.forEach((n, i) => n.degree = i + 1);
    return { tonic, mode, notes, pcs: notes.map(n => n.pc), label: tonic.name + ' ' + mode.short };
  }
  function qualityFromPcs(rootPc, pcs) {
    const rel = pcSet(pcs.map(pc => mod(pc - rootPc, 12))).sort((a,b)=>a-b);
    const key = rel.join(',');
    for (const q of Object.values(QUALITIES)) {
      const qkey = pcSet(q.intervals.map(x => mod(x,12))).sort((a,b)=>a-b).join(',');
      if (qkey === key) return q;
    }
    if (rel.length === 3) {
      if (rel[1] === 4 && rel[2] === 7) return QUALITIES.maj;
      if (rel[1] === 3 && rel[2] === 7) return QUALITIES.min;
      if (rel[1] === 3 && rel[2] === 6) return QUALITIES.dim;
      if (rel[1] === 4 && rel[2] === 8) return QUALITIES.aug;
    }
    if (rel.length === 4) {
      if (rel[1] === 4 && rel[2] === 7 && rel[3] === 10) return QUALITIES.dom7;
      if (rel[1] === 4 && rel[2] === 7 && rel[3] === 11) return QUALITIES.maj7;
      if (rel[1] === 3 && rel[2] === 7 && rel[3] === 10) return QUALITIES.min7;
      if (rel[1] === 3 && rel[2] === 6 && rel[3] === 10) return QUALITIES.hdim7;
      if (rel[1] === 3 && rel[2] === 6 && rel[3] === 9) return QUALITIES.dim7;
    }
    return { id:'unknown', name:'未知和弦', intervals:rel, steps:rel.map((_,i)=>i*2), symbol:'?', stability:0.5, color:0.5, seventh:rel.length>=4 };
  }
  function romanBase(degree) { return ROMAN[(degree - 1 + 7) % 7]; }
  function romanFor(degree, quality, opts) {
    opts = opts || {};
    let base = romanBase(degree);
    const lower = ['min','min7','hdim7','dim7','dim','mMaj7','madd9','m6'].includes(quality.id);
    if (lower) base = base.toLowerCase();
    let suffix = '';
    if (quality.id === 'dim') suffix = '°';
    if (quality.id === 'hdim7') suffix = 'ø7';
    if (quality.id === 'dim7') suffix = '°7';
    if (quality.id === 'aug') suffix = '+';
    if (quality.id === 'aug7') suffix = '+7';
    if (quality.id === 'augMaj7') suffix = '+maj7';
    if (quality.id === 'dom7') suffix = '7';
    if (quality.id === 'maj7') suffix = 'maj7';
    if (quality.id === 'min7') suffix = '7';
    if (quality.id === 'mMaj7') suffix = '(maj7)';
    if (quality.id === 'sus4') suffix = 'sus4';
    if (quality.id === 'sus2') suffix = 'sus2';
    if (quality.id === 'six') suffix = '6';
    if (quality.id === 'm6') suffix = '6';
    if (quality.id === 'add9' || quality.id === 'madd9') suffix = 'add9';
    if (quality.id === 'dom9') suffix = '9';
    if (quality.id === 'dom7b9') suffix = '7♭9';
    if (quality.id === 'dom7s9') suffix = '7♯9';
    if (quality.id === 'dom7s11') suffix = '7♯11';
    if (opts.inversion === 1) suffix += '6';
    if (opts.inversion === 2) suffix += '6/4';
    return base + suffix;
  }
  function qualitySymbol(q) { return q.symbol || ''; }
  function makeChord(opts) {
    const q = typeof opts.quality === 'string' ? getQuality(opts.quality) : opts.quality;
    const rootName = opts.rootName;
    const notes = opts.notes || P.spellChord(rootName, q.intervals, q.steps).map(n => ({ name:n.name, pc:n.pc }));
    const pcs = pcSet(notes.map(n => n.pc));
    const root = P.parseNote(rootName);
    const inversion = opts.inversion || 0;
    const inversionPc = q.intervals.length > inversion ? q.intervals[inversion] : 0;
    const bass = opts.bassPc == null ? (inversion ? mod(root.pc + inversionPc, 12) : root.pc) : mod(opts.bassPc, 12);
    const chord = {
      id: opts.id || (root.name + qualitySymbol(q) + '@' + (opts.category || 'x')),
      rootName: root.name, rootPc: root.pc, quality: q, pcs,
      notes, noteNames: notes.map(n => n.name), bassPc: bass,
      roman: opts.roman || '', function: opts.function || 'C',
      functionLabel: opts.functionLabel || '', category: opts.category || 'chromatic',
      tags: opts.tags || [], targetPc: opts.targetPc, targetRoman: opts.targetRoman,
      borrowedFrom: opts.borrowedFrom, inversion: inversion,
      description: opts.description || '', tendency: opts.tendency || [],
      resolutions: opts.resolutions || [], difficulty: opts.difficulty == null ? 0 : opts.difficulty,
      stability: q.stability, color: q.color, seventh: q.seventh,
      roles: opts.roles || []
    };
    chord.key = setKey(pcs) + '|' + root.pc + '|' + q.id + '|' + bass;
    if (!chord.roles.length) chord.roles.push({ roman: chord.roman, function: chord.function, functionLabel: chord.functionLabel, category: chord.category, targetPc: chord.targetPc, targetRoman: chord.targetRoman });
    return chord;
  }
  function addChord(list, chord) {
    const existing = list.find(c => c.key === chord.key);
    if (existing) {
      for (const role of chord.roles) {
        if (!existing.roles.some(r => r.roman === role.roman && r.function === role.function && r.category === role.category)) existing.roles.push(role);
      }
      return existing;
    }
    list.push(chord);
    return chord;
  }
  function degreeTone(scaleNotes, degreeIndex) { return scaleNotes[(degreeIndex) % scaleNotes.length]; }
  function diatonicChords(tonicName, modeId, opts) {
    opts = opts || {};
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length !== 7) return [];
    const out = [];
    const withSevenths = opts.sevenths !== false;
    for (let degree = 1; degree <= 7; degree++) {
      const root = s.notes[degree - 1];
      const triadNotes = [0,2,4].map(step => degreeTone(s.notes, degree - 1 + step));
      const triadPcs = triadNotes.map(n => n.pc);
      const triadQ = qualityFromPcs(root.pc, triadPcs);
      const fn = s.mode.functions[degree - 1] || 'C';
      const fnLabel = s.mode.functionNotes[degree - 1] || '';
      const triad = makeChord({
        rootName: root.name, quality: triadQ, notes: triadNotes.map(n => ({ name:n.name, pc:n.pc })),
        roman: romanFor(degree, triadQ), function: fn, functionLabel: fnLabel,
        category: 'diatonic', tags: ['diatonic', modeId, triadQ.id, fn],
        description: modeId + ' 第 ' + degree + ' 级三和弦',
        tendency: tendencyForDiatonic(root, triadQ, degree, s, false),
        resolutions: defaultResolutions(fn), difficulty: 0
      });
      addChord(out, triad);
      if (withSevenths) {
        const seventhNotes = [0,2,4,6].map(step => degreeTone(s.notes, degree - 1 + step));
        const seventhQ = qualityFromPcs(root.pc, seventhNotes.map(n => n.pc));
        const seventh = makeChord({
          rootName: root.name, quality: seventhQ, notes: seventhNotes.map(n => ({ name:n.name, pc:n.pc })),
          roman: romanFor(degree, seventhQ), function: fn, functionLabel: fnLabel,
          category: 'diatonic', tags: ['diatonic', modeId, seventhQ.id, fn, 'seventh'],
          description: modeId + ' 第 ' + degree + ' 级七和弦',
          tendency: tendencyForDiatonic(root, seventhQ, degree, s, true),
          resolutions: defaultResolutions(fn), difficulty: 0
        });
        addChord(out, seventh);
      }
    }
    return out;
  }
  function tendencyForDiatonic(root, quality, degree, s, isSeventh) {
    const out = [];
    if (quality.id === 'dom7') {
      out.push({ type:'leadingTone', pc: mod(root.pc + 4, 12), resolveTo: mod(root.pc + 5, 12), direction:'up', label:'导音上行到主音' });
      out.push({ type:'seventh', pc: mod(root.pc + 10, 12), resolveTo: mod(root.pc + 9, 12), direction:'down', label:'七音下行级进' });
    } else if (quality.id === 'dim7' || quality.id === 'hdim7') {
      out.push({ type:'leadingTone', pc: root.pc, resolveTo: mod(root.pc + 1, 12), direction:'up', label:'导音上行' });
      if (isSeventh) out.push({ type:'seventh', pc: mod(root.pc + (quality.id === 'dim7' ? 9 : 10), 12), resolveTo: mod(root.pc + (quality.id === 'dim7' ? 8 : 9), 12), direction:'down', label:'七音下行' });
    } else if (degree === 7) {
      out.push({ type:'leadingTone', pc: root.pc, resolveTo: mod(root.pc + 1, 12), direction:'up', label:'导音上行' });
    }
    return out;
  }
  function defaultResolutions(fn) {
    if (fn === 'D') return ['T'];
    if (fn === 'S') return ['D','T'];
    if (fn === 'T') return ['S','D','T'];
    return ['T','S','D'];
  }
  function secondaryDominants(tonicName, modeId, opts) {
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length !== 7) return [];
    const base = diatonicChords(tonicName, modeId, { sevenths:false });
    const out = [];
    for (const target of base) {
      if (target.rootPc === s.tonic.pc) continue;
      if (target.quality.id === 'dim' || target.quality.id === 'aug') continue;
      const targetDegree = s.pcs.indexOf(target.rootPc) + 1;
      if (!targetDegree) continue;
      const root = P.spellInterval(target.rootName, 7, 4);
      for (const qid of ['maj','dom7']) {
        const q = getQuality(qid);
        const roman = (qid === 'dom7' ? 'V7/' : 'V/') + target.roman;
        const c = makeChord({
          rootName: root.name, quality: q, roman, function:'D', functionLabel:'副属（局部属功能）',
          category:'secondary', tags:['secondary','dominant',qid,'V/' + target.roman],
          targetPc: target.rootPc, targetRoman: target.roman,
          description:'把 ' + target.roman + ' 级临时当主，用其属和弦建立离调。',
          tendency: qid === 'dom7' ? [
            { type:'leadingTone', pc: mod(root.pc + 4, 12), resolveTo: target.rootPc, direction:'up', label:'副导音解决到临时主音' },
            { type:'seventh', pc: mod(root.pc + 10, 12), resolveTo: mod(target.rootPc + 10, 12), direction:'down', label:'七音下行' }
          ] : [{ type:'leadingTone', pc: mod(root.pc + 4, 12), resolveTo: target.rootPc, direction:'up', label:'副导音解决到临时主音' }],
          resolutions:['target'], difficulty:0.35
        });
        addChord(out, c);
      }
    }
    return out;
  }
  function secondaryLeadingTones(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length !== 7) return [];
    const base = diatonicChords(tonicName, modeId, { sevenths:false });
    const out = [];
    for (const target of base) {
      if (target.rootPc === s.tonic.pc) continue;
      if (target.quality.id === 'dim' || target.quality.id === 'aug') continue;
      const targetDegree = s.pcs.indexOf(target.rootPc) + 1;
      if (!targetDegree) continue;
      const root = P.spellInterval(target.rootName, -1, -1);
      for (const qid of ['dim','dim7']) {
        const q = getQuality(qid);
        const c = makeChord({
          rootName: root.name, quality: q, roman:(qid === 'dim7' ? 'vii°7/' : 'vii°/') + target.roman,
          function:'D', functionLabel:'副导和弦', category:'secondary', tags:['secondary','leadingTone',qid],
          targetPc:target.rootPc, targetRoman:target.roman,
          description:'导音和弦的局部化：vii°/' + target.roman + ' 直接倾向临时主音。',
          tendency:[{type:'leadingTone',pc:root.pc,resolveTo:target.rootPc,direction:'up',label:'导音上行到临时主音'}],
          resolutions:['target'], difficulty:0.45
        });
        addChord(out, c);
      }
    }
    return out;
  }
  function parallelModeId(modeId) {
    const m = getMode(modeId);
    if (m.family === 'major') return 'naturalMinor';
    if (m.family === 'minor') return 'major';
    return m.intervals.includes(4) ? 'naturalMinor' : 'major';
  }
  function nearestDegree(scalePcs, pc) {
    let best = null;
    for (let i = 0; i < scalePcs.length; i++) {
      const d = mod(pc - scalePcs[i], 12);
      const signed = d > 6 ? d - 12 : d;
      if (!best || Math.abs(signed) < Math.abs(best.signed)) best = { degree:i + 1, signed };
    }
    return best;
  }
  function borrowedChords(tonicName, modeId, opts) {
    opts = opts || {};
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length !== 7) return [];
    const pid = parallelModeId(modeId);
    const ps = scale(tonicName, pid);
    const out = [];
    const withSevenths = opts.sevenths !== false;
    for (let degree = 1; degree <= 7; degree++) {
      const root = ps.notes[degree - 1];
      const tri = [0,2,4].map(step => ps.notes[(degree - 1 + step) % 7]);
      const tq = qualityFromPcs(root.pc, tri.map(n => n.pc));
      let prefix = '';
      let romanDegree = degree;
      if (s.mode.family === 'minor') {
        romanDegree = degree;
      } else {
        const letterIndex = s.notes.findIndex(n => n.letter === root.letter);
        if (letterIndex >= 0) {
          const diff = mod(root.pc - s.notes[letterIndex].pc, 12);
          const signed = diff > 6 ? diff - 12 : diff;
          if (signed === -1) prefix = '♭';
          else if (signed === 1) prefix = '♯';
          romanDegree = letterIndex + 1;
        } else {
          const near = nearestDegree(s.pcs, root.pc);
          romanDegree = near ? near.degree : degree;
          if (near && near.signed === -1) prefix = '♭';
          else if (near && near.signed === 1) prefix = '♯';
        }
      }
      const roman = prefix + romanFor(romanDegree, tq);
      const fn = ps.mode.functions[degree - 1] || 'C';
      const fnLabel = '同主音' + ps.mode.short + '借用（' + ps.mode.functionNotes[degree - 1] + '）';
      addChord(out, makeChord({
        rootName: root.name, quality: tq, notes: tri.map(n => ({ name:n.name, pc:n.pc })),
        roman, function: fn, functionLabel: fnLabel, category:'borrowed',
        tags:['borrowed','modalInterchange',pid,tq.id,fn], borrowedFrom: pid,
        description:'从同主音 ' + ps.mode.short + ' 借来的 ' + roman + '，用特征音改变调式色彩。',
        resolutions: defaultResolutions(fn), difficulty:0.3
      }));
      if (withSevenths) {
        const sev = [0,2,4,6].map(step => ps.notes[(degree - 1 + step) % 7]);
        const sq = qualityFromPcs(root.pc, sev.map(n => n.pc));
        addChord(out, makeChord({
          rootName: root.name, quality: sq, notes: sev.map(n => ({ name:n.name, pc:n.pc })),
          roman: prefix + romanFor(romanDegree, sq), function: fn, functionLabel: fnLabel,
          category:'borrowed', tags:['borrowed','modalInterchange',pid,sq.id,fn,'seventh'], borrowedFrom:pid,
          description:'同主音调式借用的七和弦。', resolutions: defaultResolutions(fn), difficulty:0.35
        }));
      }
    }
    return out;
  }
  function neapolitanChords(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length !== 7) return [];
    const d2 = s.notes[1];
    const root = P.spellFromLetter(d2.letter, mod(d2.pc - 1, 12));
    const q = getQuality('maj');
    const notes = P.spellChord(root.name, q.intervals, q.steps);
    const out = [];
    addChord(out, makeChord({
      rootName:root.name, quality:q, notes:notes.map(n=>({name:n.name,pc:n.pc})),
      roman:'♭II', function:'S', functionLabel:'拿波里（下属/属前）', category:'neapolitan',
      tags:['neapolitan','chromatic','subdominant'], description:'降低二级的大三和弦，♭2 级半音下行，强烈导向 V。',
      resolutions:['V','I'], difficulty:0.5
    }));
    const third = notes[1];
    addChord(out, makeChord({
      rootName:root.name, quality:q, notes:notes.map(n=>({name:n.name,pc:n.pc})), bassPc:third.pc,
      roman:'♭II6', function:'S', functionLabel:'拿波里六和弦', category:'neapolitan', inversion:1,
      tags:['neapolitan','chromatic','subdominant','inversion'], description:'拿波里和弦第一转位，低音为 ♭2 级，常用于 ♭II6–V。',
      resolutions:['V','I'], difficulty:0.5
    }));
    return out;
  }
  function augmentedSixths(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    if (!['major','naturalMinor','harmonicMinor','melodicMinor','harmonicMajor'].includes(modeId)) return [];
    const isMajor = s.mode.family === 'major' && modeId !== 'harmonicMajor';
    const d6 = s.notes[5];
    const b6 = P.spellFromLetter(d6.letter, mod(d6.pc - (isMajor ? 1 : 0), 12));
    const tonic = s.notes[0];
    const d4 = s.notes[3];
    const s4 = P.spellFromLetter(d4.letter, mod(d4.pc + 1, 12));
    const d2 = s.notes[1];
    const d3 = s.notes[2];
    const b3 = P.spellFromLetter(d3.letter, mod(tonic.pc + 3, 12));
    const defs = [
      { id:'It+6', names:[b6.name, tonic.name, s4.name], iv:[0,4,9], steps:[0,2,5], label:'意大利增六' },
      { id:'Fr+6', names:[b6.name, tonic.name, d2.name, s4.name], iv:[0,4,6,9], steps:[0,2,3,5], label:'法国增六' },
      { id:'Ger+6', names:[b6.name, tonic.name, b3.name, s4.name], iv:[0,4,7,9], steps:[0,2,4,5], label:'德国增六' }
    ];
    const out = [];
    for (const def of defs) {
      const notes = def.names.map(n => P.parseNote(n));
      addChord(out, makeChord({
        rootName:b6.name, quality:{ id:'aug6', name:def.label, intervals:def.iv, steps:def.steps, symbol:'+6', stability:0.4, color:0.65, seventh:false },
        notes:notes.map(n=>({name:n.name,pc:n.pc})), roman:def.id, function:'S', functionLabel:'增六（属前）',
        category:'aug6', tags:['aug6','chromatic','predominant',def.id],
        description:def.label + '：♭6 与 ♯4 向外扩张到八度，解决到 V。' + (def.id === 'Ger+6' ? ' 等音可重释为 V7/♭II。' : ''),
        tendency:[
          { type:'aug6', pc:b6.pc, resolveTo:mod(tonic.pc+7,12), direction:'down', label:'♭6 下行到属音' },
          { type:'aug6', pc:s4.pc, resolveTo:mod(tonic.pc+7,12), direction:'up', label:'♯4 上行到属音' }
        ],
        resolutions:['V'], difficulty:0.65
      }));
    }
    return out;
  }
  function tritoneSubs(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    const root = P.spellInterval(s.tonic.name, 1, 1);
    const q = getQuality('dom7');
    const notes = P.spellChord(root.name, q.intervals, q.steps);
    return [makeChord({
      rootName:root.name, quality:q, notes:notes.map(n=>({name:n.name,pc:n.pc})),
      roman:'♭II7', function:'D', functionLabel:'三全音替代（属功能）', category:'tritoneSub',
      tags:['tritoneSub','jazz','dominant'], targetPc:s.tonic.pc, targetRoman:'I',
      description:'♭II7 与 V7 共享三全音，低音半音下行到主；可替代 V7。',
      tendency:[{type:'seventh',pc:mod(root.pc+10,12),resolveTo:mod(s.tonic.pc+9,12),direction:'down',label:'七音下行'}],
      resolutions:['I'], difficulty:0.55
    })];
  }
  function chromaticMediants(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    const specs = [
      { semi:3, steps:2, roman:'♭III' }, { semi:8, steps:5, roman:'♭VI' },
      { semi:4, steps:2, roman:'III' }, { semi:9, steps:5, roman:'VI' }
    ];
    const out = [];
    for (const spec of specs) {
      const root = P.spellInterval(s.tonic.name, spec.semi, spec.steps);
      for (const qid of ['maj','min']) {
        const q = getQuality(qid);
        const notes = P.spellChord(root.name, q.intervals, q.steps);
        addChord(out, makeChord({
          rootName:root.name, quality:q, notes:notes.map(n=>({name:n.name,pc:n.pc})),
          roman:spec.roman + (qid === 'min' ? 'm' : ''), function:'C', functionLabel:'色彩中介（三度关系）', category:'chromaticMediant',
          tags:['chromaticMediant','color','thirdRelation'], description:'与主和弦呈三度关系，共同音少但声部可平滑；常用于色彩转调。',
          resolutions:['I','V'], difficulty:0.55
        }));
      }
    }
    return out;
  }
  function modalColorChords(tonicName, modeId) {
    const s = scale(tonicName, modeId);
    const out = [];
    const b7 = P.spellInterval(s.tonic.name, 10, 6);
    const q = getQuality('dom7');
    addChord(out, makeChord({
      rootName:b7.name, quality:q, notes:P.spellChord(b7.name,q.intervals,q.steps).map(n=>({name:n.name,pc:n.pc})),
      roman:'♭VII7', function:'D', functionLabel:'后门属（♭VII7）', category:'modal',
      tags:['modal','backdoor','dominant','jazz'], targetPc:s.tonic.pc,
      description:'♭VII7 代替 V7 进入 I，形成后门终止；七音下行、三音保持。',
      resolutions:['I'], difficulty:0.5
    }));
    return out;
  }
  function scaleSubsetChords(tonicName, modeId, opts) {
    opts = opts || {};
    const s = scale(tonicName, modeId);
    if (s.mode.intervals.length === 7) return [];
    const out = [];
    const qualities = ['maj','min','dim','aug','dom7','min7','hdim7','dim7','aug7','augMaj7'];
    for (const rootPc of s.pcs) {
      for (const qid of qualities) {
        const q = getQuality(qid);
        const pcs = q.intervals.map(x => mod(rootPc + x, 12));
        if (new Set(pcs).size !== pcs.length) continue;
        if (!pcs.every(pc => s.pcs.includes(pc))) continue;
        const rootName = P.enharmonicName(rootPc, s.tonic.name.includes('b'));
        const near = nearestDegree(s.pcs, rootPc);
        const roman = near ? (near.signed === -1 ? '♭' : near.signed === 1 ? '♯' : '') + romanFor(near.degree, q) : P.prettyAccidental(rootName) + qualitySymbol(q);
        let notes;
        if (s.mode.family === 'symmetrical') {
          notes = q.intervals.map(iv => { const pc = mod(rootPc + iv, 12); return { name:P.enharmonicName(pc, s.tonic.name.includes('b')), pc }; });
        } else {
          notes = P.spellChord(rootName, q.intervals, q.steps).map(n => ({ name:n.name, pc:n.pc }));
        }
        addChord(out, makeChord({
          rootName, quality:q, roman, notes, function:'C', functionLabel:'调式内可用和弦', category:'modal',
          tags:['modal','scaleSubset',modeId,qid], description:'完全由当前音阶音构成的和弦；可用于调式/对称音阶的和声。',
          resolutions:['T','C'], difficulty:0.35
        }));
      }
    }
    return out;
  }
  function buildCatalog(tonicName, modeId, opts) {
    opts = opts || {};
    const s = scale(tonicName, modeId);
    const list = [];
    for (const c of diatonicChords(tonicName, modeId, { sevenths:opts.sevenths !== false })) addChord(list, c);
    if (s.mode.intervals.length !== 7) for (const c of scaleSubsetChords(tonicName, modeId, opts)) addChord(list, c);
    if (opts.secondary !== false && s.mode.intervals.length === 7) {
      for (const c of secondaryDominants(tonicName, modeId, opts)) addChord(list, c);
      for (const c of secondaryLeadingTones(tonicName, modeId)) addChord(list, c);
    }
    if (opts.borrowed !== false && s.mode.intervals.length === 7) {
      for (const c of borrowedChords(tonicName, modeId, { sevenths:opts.sevenths !== false })) addChord(list, c);
    }
    if (opts.chromatic !== false && s.mode.intervals.length === 7) {
      for (const c of neapolitanChords(tonicName, modeId)) addChord(list, c);
      for (const c of augmentedSixths(tonicName, modeId)) addChord(list, c);
      for (const c of tritoneSubs(tonicName, modeId)) addChord(list, c);
      for (const c of chromaticMediants(tonicName, modeId)) addChord(list, c);
      for (const c of modalColorChords(tonicName, modeId)) addChord(list, c);
    }
    list.forEach(c => { if (!c.roles.length) c.roles.push({ roman:c.roman, function:c.function, functionLabel:c.functionLabel, category:c.category, targetPc:c.targetPc, targetRoman:c.targetRoman }); });
    return list;
  }
  function rootMotionScore(fromPc, toPc) {
    const up = mod(toPc - fromPc, 12);
    if (up === 5) return 1.0;
    if (up === 7) return 0.66;
    if (up === 9) return 0.78;
    if (up === 8) return 0.72;
    if (up === 3) return 0.66;
    if (up === 4) return 0.60;
    if (up === 2 || up === 10) return 0.60;
    if (up === 1 || up === 11) return 0.32;
    if (up === 6) return 0.28;
    return 0.45;
  }
  function midiLabel(midi) {
    return P.prettyAccidental(P.enharmonicName(mod(midi, 12), false)) + (Math.floor(midi / 12) - 1);
  }
  function signedMotion(fromMidi, toMidi) {
    return Number(toMidi) - Number(fromMidi);
  }
  function midiOptionsInRange(pc, range) {
    const out = [];
    for (let midi = range[0]; midi <= range[1]; midi++) if (mod(midi, 12) === mod(pc, 12)) out.push(midi);
    return out;
  }
  function chordToneEntries(chord) {
    if (!chord || !chord.quality) return [];
    const intervals = chord.quality.intervals || [];
    const steps = chord.quality.steps || [];
    if (chord.notes && chord.notes.length) {
      return chord.notes.map((note, i) => {
        const pc = mod(note.pc, 12);
        const degree = (steps[i] == null ? i * 2 : steps[i]) + 1;
        const priority = degree === 1 ? 100 : degree === 3 ? 92 : degree === 7 ? 88 :
          degree === 9 ? 80 : degree === 13 ? 74 : degree === 11 ? 72 : degree === 5 ? 62 : 55;
        return { pc, interval:mod(pc - chord.rootPc, 12), degree, priority, role:chordToneRole(chord, pc) };
      });
    }
    return intervals.map((interval, i) => {
      const pc = mod(chord.rootPc + interval, 12);
      const degree = (steps[i] == null ? i * 2 : steps[i]) + 1;
      const priority = degree === 1 ? 100 : degree === 3 ? 92 : degree === 7 ? 88 :
        degree === 9 ? 80 : degree === 13 ? 74 : degree === 11 ? 72 : degree === 5 ? 62 : 55;
      return { pc, interval, degree, priority, role:chordToneRole(chord, pc) };
    });
  }
  function essentialVoicingPcs(chord, bassPc, requiredPcs) {
    const entries = chordToneEntries(chord);
    const all = pcSet(entries.map(entry => entry.pc));
    if (all.length <= 4) return all;
    const chosen = new Set([mod(bassPc, 12)]);
    (requiredPcs || []).forEach(pc => {
      const normalized = mod(pc, 12);
      if (chosen.size < 4 && all.includes(normalized)) chosen.add(normalized);
    });
    entries.slice().sort((a, b) => b.priority - a.priority || a.pc - b.pc).forEach(entry => {
      if (chosen.size < 4) chosen.add(entry.pc);
    });
    return pcSet(Array.from(chosen));
  }
  function inversionBassPc(chord, inversion) {
    if (chord && chord.notes && chord.notes[inversion]) return mod(chord.notes[inversion].pc, 12);
    const intervals = chord && chord.quality && chord.quality.intervals || [];
    const interval = intervals[inversion];
    return interval == null ? null : mod(chord.rootPc + interval, 12);
  }
  function allowedInversionsFor(chord, opts) {
    if (!chord || !chord.pcs || !chord.pcs.length) return [];
    const maxInversion = Math.min(3, chord.pcs.length - 1);
    if (opts && opts.inversion != null && opts.inversion !== '' && opts.inversion !== 'auto') {
      const inversion = Number(opts.inversion);
      return Number.isInteger(inversion) && inversion >= 0 && inversion <= maxInversion ? [inversion] : [];
    }
    if (chord.inversion > 0 && chord.inversion <= maxInversion) return [chord.inversion];
    return Array.from({ length:maxInversion + 1 }, (_, i) => i);
  }
  function voicePcAssignments(voicePcs, bassPc) {
    const required = pcSet(voicePcs);
    const out = [];
    const upperPcs = voicePcs.slice();
    function rec(index, chosen) {
      if (index === 3) {
        const full = pcSet([bassPc].concat(chosen));
        if (required.every(pc => full.includes(pc))) out.push(chosen.slice());
        return;
      }
      upperPcs.forEach(pc => {
        chosen.push(pc);
        rec(index + 1, chosen);
        chosen.pop();
      });
    }
    rec(0, []);
    return out;
  }
  function voicingFromChord(chord) {
    if (!chord) return null;
    const raw = chord.voicing || chord;
    let midis = raw && Array.isArray(raw.midis) ? raw.midis.slice(0, 4) : null;
    if (!midis && raw && ['bass', 'tenor', 'alto', 'soprano'].every(name => Number.isFinite(Number(raw[name])))) {
      midis = [raw.bass, raw.tenor, raw.alto, raw.soprano].map(Number);
    }
    if (!midis || midis.length !== 4 || midis.some(midi => !Number.isFinite(Number(midi)))) return null;
    midis = midis.map(Number);
    const inversion = Number.isInteger(raw.inversion) ? raw.inversion : (Number.isInteger(chord.inversion) ? chord.inversion : 0);
    return {
      bass:midis[0], tenor:midis[1], alto:midis[2], soprano:midis[3], midis,
      inversion, bassPc:mod(midis[0], 12), sopranoPc:mod(midis[3], 12),
      label:INVERSION_LABELS[inversion] || ('第 ' + (inversion + 1) + ' 转位')
    };
  }
  function materializeVoicing(chord, voicing) {
    if (!chord || !voicing) return chord;
    return Object.assign({}, chord, {
      voicing:voicing,
      inversion:voicing.inversion == null ? chord.inversion : voicing.inversion,
      bassPc:voicing.bassPc == null ? chord.bassPc : voicing.bassPc
    });
  }
  function voicingPenalty(chord, midis) {
    let penalty = 0;
    const labels = [];
    const counts = {};
    midis.forEach(midi => { const pc = mod(midi, 12); counts[pc] = (counts[pc] || 0) + 1; });
    const leadingPcs = uniqTendencyPcs(chord, 'leadingTone');
    const seventhPcs = uniqTendencyPcs(chord, 'seventh');
    leadingPcs.forEach(pc => { if ((counts[pc] || 0) > 1) { penalty += 9; labels.push('导音被重复'); } });
    seventhPcs.forEach(pc => { if ((counts[pc] || 0) > 1) { penalty += 4; labels.push('七音被重复'); } });
    const third = chordToneEntries(chord).find(entry => entry.degree === 3);
    if (third && !midis.some(midi => mod(midi, 12) === third.pc)) { penalty += 10; labels.push('缺少三音'); }
    for (let i = 0; i < midis.length; i++) {
      penalty += Math.abs(midis[i] - SATB_CENTERS[SATB_VOICES[i]]) * 0.035;
      if (i && midis[i] === midis[i - 1]) { penalty += 7; labels.push('相邻声部同度'); }
    }
    return { penalty, labels:[...new Set(labels)], counts };
  }
  function uniqTendencyPcs(chord, type) {
    return pcSet((chord && chord.tendency || []).filter(item => item.type === type).map(item => item.pc));
  }
  function listVoicings(chord, opts) {
    opts = opts || {};
    if (!chord || !chord.pcs || !chord.pcs.length) return [];
    const sopranoMidi = opts.sopranoMidi == null || opts.sopranoMidi === '' ? null : Number(opts.sopranoMidi);
    if (sopranoMidi != null && (!Number.isInteger(sopranoMidi) || sopranoMidi < SATB_RANGES.soprano[0] || sopranoMidi > SATB_RANGES.soprano[1])) return [];
    const inversions = allowedInversionsFor(chord, opts);
    const found = new Map();
    inversions.forEach(inversion => {
      const bassPc = inversionBassPc(chord, inversion);
      if (bassPc == null || !chord.pcs.includes(bassPc)) return;
      const voicePcs = essentialVoicingPcs(chord, bassPc, sopranoMidi == null ? [] : [mod(sopranoMidi, 12)]);
      const bassOptions = midiOptionsInRange(bassPc, SATB_RANGES.bass);
      const assignments = voicePcAssignments(voicePcs, bassPc);
      bassOptions.forEach(bassMidi => {
        assignments.forEach(upper => {
          const pcs = [bassPc].concat(upper);
          const midis = [bassMidi, 0, 0, 0];
          function place(index, previous) {
            if (index === 4) {
              if (sopranoMidi != null && midis[3] !== sopranoMidi) return;
              const key = midis.join(',');
              if (found.has(key)) return;
              const intrinsic = voicingPenalty(chord, midis);
              found.set(key, {
                bass:midis[0], tenor:midis[1], alto:midis[2], soprano:midis[3], midis:midis.slice(),
                inversion, bassPc, sopranoPc:mod(midis[3], 12),
                label:INVERSION_LABELS[inversion] || ('第 ' + (inversion + 1) + ' 转位'),
                doubled:intrinsic.counts, penalty:intrinsic.penalty, flags:intrinsic.labels
              });
              return;
            }
            const voice = SATB_VOICES[index];
            let choices = midiOptionsInRange(pcs[index], SATB_RANGES[voice]);
            if (sopranoMidi != null && index === 3) choices = choices.filter(midi => midi === sopranoMidi);
            choices.forEach(midi => {
              if (index > 0 && midi <= previous) return;
              if (index > 0 && midi - previous > SATB_MAX_GAPS[voice]) return;
              midis[index] = midi;
              place(index + 1, midi);
            });
          }
          place(1, bassMidi);
        });
      });
    });
    return Array.from(found.values()).sort((a, b) => a.penalty - b.penalty || a.inversion - b.inversion || a.soprano - b.soprano);
  }
  function voicingFailureReason(chord, opts) {
    opts = opts || {};
    const sopranoMidi = opts.sopranoMidi == null || opts.sopranoMidi === '' ? null : Number(opts.sopranoMidi);
    if (sopranoMidi != null && (sopranoMidi < SATB_RANGES.soprano[0] || sopranoMidi > SATB_RANGES.soprano[1])) {
      return '固定高音必须在 C4–C6（MIDI 60–84）之间。';
    }
    if (sopranoMidi != null && !chord.pcs.includes(mod(sopranoMidi, 12))) {
      return '固定高音 ' + midiLabel(sopranoMidi) + ' 不是该和弦音；请选择和弦内的旋律音。';
    }
    if (opts.inversion != null && opts.inversion !== '' && opts.inversion !== 'auto') {
      const inversion = Number(opts.inversion);
      const maxInversion = Math.min(3, chord.pcs.length - 1);
      if (!Number.isInteger(inversion) || inversion < 0 || inversion > maxInversion) {
        return inversion === 3
          ? '第三转位需要至少四个不同的和弦音；该和弦不足四音。'
          : '该和弦没有第 ' + (inversion + 1) + ' 转位。';
      }
    }
    return '没有能在 SATB 音域、声部顺序与间距约束内安放的四声部排列。';
  }
  function voicingMessage(type, voices, fromMidi, toMidi) {
    const names = voices.map(index => SATB_VOICE_LABELS[SATB_VOICES[index]]).join('–');
    return names + '：' + fromMidi.map(midiLabel).join('/') + ' → ' + toMidi.map(midiLabel).join('/') + '（' + type + '）';
  }
  function analyzeVoicings(fromVoicing, toVoicing, fromChord, toChord) {
    if (!fromVoicing || !toVoicing) return null;
    const a = fromVoicing.midis ? fromVoicing : voicingFromChord(fromVoicing);
    const b = toVoicing.midis ? toVoicing : voicingFromChord(toVoicing);
    if (!a || !b) return null;
    const voices = SATB_VOICES.map((voice, index) => {
      const from = a.midis[index], to = b.midis[index];
      return {
        voice, label:SATB_VOICE_LABELS[voice], from, to,
        fromName:midiLabel(from), toName:midiLabel(to),
        semitones:signedMotion(from, to), direction:Math.sign(to - from)
      };
    });
    const parallels = [], hidden = [], overlaps = [], crossing = [], spacing = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const fromInterval = Math.abs(a.midis[j] - a.midis[i]);
      const toInterval = Math.abs(b.midis[j] - b.midis[i]);
      const fromClass = fromInterval % 12, toClass = toInterval % 12;
      const di = Math.sign(b.midis[i] - a.midis[i]);
      const dj = Math.sign(b.midis[j] - a.midis[j]);
      const sameDirection = di !== 0 && di === dj;
      if (sameDirection && fromClass === toClass && (toClass === 0 || toClass === 7)) {
        const type = toClass === 0 ? (fromInterval === 0 && toInterval === 0 ? '平行同度' : '平行八度') : '平行五度';
        parallels.push({ type, voices:[i, j], fromInterval, toInterval,
          message:voicingMessage(type, [i, j], [a.midis[i], a.midis[j]], [b.midis[i], b.midis[j]]) });
      }
    }
    const outerFrom = Math.abs(a.midis[3] - a.midis[0]);
    const outerTo = Math.abs(b.midis[3] - b.midis[0]);
    const outerClass = outerTo % 12;
    const outerDirection = Math.sign(b.midis[0] - a.midis[0]);
    if (outerDirection !== 0 && outerDirection === Math.sign(b.midis[3] - a.midis[3]) &&
        (outerClass === 0 || outerClass === 7) && outerFrom % 12 !== outerClass && Math.abs(b.midis[3] - a.midis[3]) > 2) {
      const type = outerClass === 0 ? '隐伏八度/同度' : '隐伏五度';
      hidden.push({ type, voices:[0, 3], fromInterval:outerFrom, toInterval:outerTo,
        message:voicingMessage(type, [0, 3], [a.midis[0], a.midis[3]], [b.midis[0], b.midis[3]]) });
    }
    for (let i = 0; i < 3; i++) {
      if (b.midis[i] > b.midis[i + 1]) crossing.push({ voices:[i, i + 1], message:'目标和弦中 ' + SATB_VOICES[i] + ' 高于 ' + SATB_VOICES[i + 1] });
      if (b.midis[i] > a.midis[i + 1]) overlaps.push({ voices:[i, i + 1], message:SATB_VOICES[i] + ' 越过前一和弦的 ' + SATB_VOICES[i + 1] });
      if (b.midis[i + 1] < a.midis[i]) overlaps.push({ voices:[i, i + 1], message:SATB_VOICES[i + 1] + ' 落到前一和弦 ' + SATB_VOICES[i] + ' 的下方' });
      const gap = b.midis[i + 1] - b.midis[i];
      const limit = SATB_MAX_GAPS[SATB_VOICES[i + 1]];
      if (gap > limit) spacing.push({ voices:[i, i + 1], gap, limit,
        message:'目标和弦 ' + SATB_VOICES[i] + '–' + SATB_VOICES[i + 1] + ' 间距 ' + gap + ' 半音，超过上限 ' + limit });
    }
    const tendency = [];
    (fromChord && fromChord.tendency || []).forEach(item => {
      const sourceIndices = a.midis.map((midi, index) => mod(midi, 12) === mod(item.pc, 12) ? index : -1).filter(index => index >= 0);
      if (!sourceIndices.length) return;
      const resolved = sourceIndices.filter(index => {
        const delta = signedMotion(a.midis[index], b.midis[index]);
        const targetPc = mod(b.midis[index], 12);
        const directionOk = item.direction === 'down' ? delta < 0 : delta > 0;
        return targetPc === mod(item.resolveTo, 12) && directionOk && Math.abs(delta) <= 2;
      });
      if (!resolved.length) {
        tendency.push({ pc:item.pc, resolveTo:item.resolveTo, type:item.type,
          message:'倾向音 ' + P.prettyAccidental(P.enharmonicName(item.pc, true)) + ' 未在实际声部按“' + item.label + '”解决' });
      } else if (resolved.length < sourceIndices.length && item.type === 'leadingTone') {
        tendency.push({ pc:item.pc, resolveTo:item.resolveTo, type:item.type,
          message:'导音在 ' + (sourceIndices.length - resolved.length) + ' 个声部中未上行解决' });
      }
    });
    const largeLeaps = voices.filter(voice => Math.abs(voice.semitones) > 12).map(voice =>
      ({ voice:voice.voice, semitones:voice.semitones, message:voice.label + ' 声部跳进 ' + Math.abs(voice.semitones) + ' 半音' }));
    const issues = [];
    parallels.forEach(item => issues.push(item.message));
    hidden.forEach(item => issues.push(item.message));
    crossing.forEach(item => issues.push(item.message));
    overlaps.forEach(item => issues.push(item.message));
    spacing.forEach(item => issues.push(item.message));
    tendency.forEach(item => issues.push(item.message));
    largeLeaps.forEach(item => issues.push(item.message));
    const totalMotion = voices.reduce((sum, voice) => sum + Math.abs(voice.semitones), 0);
    const commonTones = voices.filter(voice => voice.from === voice.to).length;
    const penalty = parallels.length * 20 + hidden.length * 9 + crossing.length * 18 + overlaps.length * 7 +
      spacing.length * 6 + tendency.length * 7 + largeLeaps.length * 2;
    return {
      voices, motion:voices, parallels, hidden, overlaps, crossing, spacing, tendency, largeLeaps,
      issues:[...new Set(issues)], totalMotion, commonTones, penalty,
      cost:clamp(totalMotion / 40 + penalty / 120, 0, 1),
      from:midiLabel(a.midis[0]) + '/' + midiLabel(a.midis[1]) + '/' + midiLabel(a.midis[2]) + '/' + midiLabel(a.midis[3]),
      to:midiLabel(b.midis[0]) + '/' + midiLabel(b.midis[1]) + '/' + midiLabel(b.midis[2]) + '/' + midiLabel(b.midis[3])
    };
  }
  function analyzeVoiceLeading(fromChord, toChord) {
    const fromVoicing = voicingFromChord(fromChord);
    const toVoicing = voicingFromChord(toChord);
    return fromVoicing && toVoicing ? analyzeVoicings(fromVoicing, toVoicing, fromChord, toChord) : null;
  }
  function bestVoicingForChord(chord, opts, previousChord) {
    const options = listVoicings(chord, opts);
    if (!options.length) return null;
    const previousVoicing = previousChord && previousChord.midis ? previousChord : voicingFromChord(previousChord);
    const previousChordObject = previousChord && previousChord.midis ? null : previousChord;
    let best = null;
    options.forEach(voicing => {
      const transition = previousVoicing
        ? analyzeVoicings(previousVoicing, voicing, previousChordObject, chord)
        : null;
      const score = voicing.penalty + (transition ? transition.penalty * 1.25 + transition.totalMotion * 0.08 : 0);
      if (!best || score < best.transitionCost) best = { voicing, transition, transitionCost:score };
    });
    if (!best) return null;
    return Object.assign({}, best.voicing, { transition:best.transition, transitionCost:best.transitionCost });
  }
  function voiceLeading(fromChord, toChord) {
    const a = pcSet(fromChord.pcs), b = pcSet(toChord.pcs);
    if (!a.length || !b.length) return { cost:0, common:[], motion:[], parallels:[], total:0 };
    const actual = analyzeVoiceLeading(fromChord, toChord);
    const common = a.filter(pc => b.includes(pc));
    const aSmall = a.length <= b.length;
    const smaller = aSmall ? a : b;
    const larger = aSmall ? b : a;
    let best = null;
    function rec(i, used, total, motion) {
      if (i === smaller.length) {
        let extra = 0;
        const extraMotion = [];
        for (let j = 0; j < larger.length; j++) {
          if (used[j]) continue;
          let near = 6;
          for (const pc of smaller) near = Math.min(near, Math.min(Math.abs(larger[j]-pc), 12-Math.abs(larger[j]-pc)));
          extra += near * 0.5;
          extraMotion.push({ extra:true, pc:larger[j], nearestDistance:near });
        }
        const totalAll = total + extra;
        if (!best || totalAll < best.total) best = { total:totalAll, motion:motion.slice().concat(extraMotion) };
        return;
      }
      for (let j = 0; j < larger.length; j++) {
        if (used[j]) continue;
        let d = Math.abs(smaller[i]-larger[j]); d = Math.min(d, 12-d);
        used[j] = true;
        motion.push({ from: smaller[i], to: larger[j], semitones: mod(larger[j]-smaller[i],12) > 6 ? mod(larger[j]-smaller[i],12)-12 : mod(larger[j]-smaller[i],12), extra:false });
        rec(i+1, used, total+d, motion);
        motion.pop(); used[j] = false;
      }
    }
    rec(0, Array(larger.length).fill(false), 0, []);
    const maxNotes = Math.max(a.length, b.length);
    const total = best ? best.total : 0;
    return { cost: actual ? actual.cost : clamp(total / (maxNotes * 6), 0, 1),
      total: actual ? actual.totalMotion : Math.round(total * 10) / 10,
      common, motion: best ? best.motion : [], parallels: actual ? actual.parallels : [],
      actual };
  }
  function tendencyWarnings(fromChord, toChord) {
    const warnings = [];
    if (!fromChord || !toChord) return warnings;
    for (const t of fromChord.tendency || []) {
      if (t.type === 'leadingTone' || t.type === 'aug6' || t.type === 'seventh') {
        if (!toChord.pcs.includes(mod(t.resolveTo, 12))) {
          warnings.push('倾向音 ' + P.prettyAccidental(P.enharmonicName(t.pc, true)) + ' 未按“' + t.label + '”解决');
        }
      }
    }
    return warnings;
  }
  function pivotScore(sourceChord, targetChord) {
    if (!sourceChord || !targetChord) return 0;
    if (setKey(sourceChord.pcs) !== setKey(targetChord.pcs)) return 0;
    if (sourceChord.pcs.length !== targetChord.pcs.length) return 0;
    const diff = sourceChord.function !== targetChord.function;
    const targetWeight = { S:1.0, D:0.95, T:0.7, C:0.6 }[targetChord.function] || 0.5;
    let base = 0.55 + (diff ? 0.2 : 0) + 0.15 * targetWeight;
    if (sourceChord.function === 'T' && targetChord.function === 'T') base -= 0.15;
    if (sourceChord.function === 'S' && targetChord.function === 'S') base -= 0.08;
    return clamp(base, 0, 1);
  }
  function commonPivots(sourceTonic, sourceMode, targetTonic, targetMode, opts) {
    opts = opts || {};
    const sc = buildCatalog(sourceTonic, sourceMode, { sevenths:false, secondary:false, borrowed:false, chromatic:false });
    const tc = buildCatalog(targetTonic, targetMode, { sevenths:false, secondary:false, borrowed:false, chromatic:false });
    const out = [];
    for (const a of sc) {
      if (a.pcs.length !== 3 || !['maj','min'].includes(a.quality.id)) continue;
      for (const b of tc) {
        if (b.pcs.length !== 3 || !['maj','min'].includes(b.quality.id) || setKey(a.pcs) !== setKey(b.pcs)) continue;
        out.push({ pcs:a.pcs, noteNames:a.noteNames, sourceChord:a, targetChord:b,
          sourceRoman:a.roman, targetRoman:b.roman, sourceFunction:a.function, targetFunction:b.function,
          score:pivotScore(a,b), explanation:'同一音集在源调为 ' + a.roman + '（' + a.function + '），在目标调为 ' + b.roman + '（' + b.function + '）。' });
      }
    }
    out.sort((x,y)=>y.score-x.score);
    const seen = new Set(), filtered = [];
    for (const p of out) { const k = setKey(p.pcs); if (seen.has(k)) continue; seen.add(k); filtered.push(p); }
    return filtered.slice(0, opts.limit || 12);
  }
  function keyRelation(sourceTonic, sourceMode, targetTonic, targetMode) {
    const s = scale(sourceTonic, sourceMode), t = scale(targetTonic, targetMode);
    const shared = s.pcs.filter(pc => t.pcs.includes(pc));
    const sameTonic = s.tonic.pc === t.tonic.pc;
    const samePcs = setKey(s.pcs) === setKey(t.pcs);
    let type = 'distant', label = '远关系', difficulty = 0.75;
    if (sameTonic && sourceMode === targetMode) { type = 'same'; label = '同调'; difficulty = 0; }
    else if (sameTonic) { type = 'parallel'; label = '同主音调式交替'; difficulty = 0.25; }
    else if (samePcs) { type = 'relative'; label = '关系调（同音阶）'; difficulty = 0.22; }
    else {
      const cdist = P.circleDistance(s.tonic.name, t.tonic.name);
      if (cdist != null && cdist === 1) { type = 'near'; label = '近关系（相差一个升降号）'; difficulty = 0.32; }
      else if (cdist != null && cdist === 2) { type = 'near'; label = '近关系（相差两个升降号）'; difficulty = 0.42; }
      else if (cdist != null && cdist === 3) { type = 'medium'; label = '中关系（相差三个升降号）'; difficulty = 0.55; }
      else if (cdist != null && cdist === 4) { type = 'medium'; label = '中远关系（相差四个升降号）'; difficulty = 0.65; }
      else if (shared.length >= 4) { type = 'common'; label = '共同音较多'; difficulty = 0.55; }
      else if (shared.length >= 2) { type = 'chromatic'; label = '色彩关系（三度/半音）'; difficulty = 0.65; }
    }
    return { type, label, difficulty, sharedPcs:shared, sharedCount:shared.length, sameTonic, samePcs };
  }
  function tonicNamePool(preferFlats) {
    return ALL_PCS.map(pc => P.enharmonicName(pc, !!preferFlats));
  }
  function sameChordPcs(a, b) {
    return !!a && !!b && a.rootPc === b.rootPc && setKey(a.pcs) === setKey(b.pcs);
  }
  function chordInterpretations(chord, sourceTonic, sourceMode, opts) {
    opts = opts || {};
    if (!chord || !Array.isArray(chord.pcs)) return [];
    const sourceCat = buildCatalog(sourceTonic, sourceMode, {
      sevenths:true, secondary:false, borrowed:true, chromatic:false
    });
    const sourceRole = sourceCat.find(c => sameChordPcs(c, chord));
    const sourceLabel = sourceTonic + ' ' + getMode(sourceMode).short;
    const tonics = opts.tonics && opts.tonics.length ? opts.tonics : tonicNamePool(opts.preferFlats);
    const out = [];
    for (const targetTonic of tonics) {
      for (const mode of D.MODES) {
        const relation = keyRelation(sourceTonic, sourceMode, targetTonic, mode.id);
        if (relation.type === 'same') continue;
        const targetCat = buildCatalog(targetTonic, mode.id, {
          sevenths:true, secondary:false, borrowed:true, chromatic:false
        });
        const matches = targetCat.filter(c => sameChordPcs(c, chord));
        if (!matches.length) continue;
        for (const role of matches) {
          const targetTonicPc = P.pcOf(targetTonic);
          const dominantOfTarget = P.intervalClass(chord.rootPc, targetTonicPc) === 5;
          const reasons = [];
          let score = 0.16 + (1 - relation.difficulty) * 0.34;
          if (relation.type === 'parallel') { score += 0.16; reasons.push('同主音调式，中心音不变'); }
          else if (relation.type === 'relative') { score += 0.12; reasons.push('共享同一音阶'); }
          else if (relation.type === 'near') { score += 0.08; reasons.push(relation.label); }
          if (sourceRole) {
            score += 0.22;
            reasons.push('可作中介：' + sourceRole.roman + ' → ' + role.roman);
          } else {
            reasons.push('目标调内 ' + role.roman);
          }
          if (role.category === 'diatonic') score += 0.04;
          if (role.function === 'D') { score += 0.06; reasons.push('目标属功能'); }
          if (dominantOfTarget) { score += 0.05; reasons.push('根音可强化目标主音'); }
          if (role.rootPc === targetTonicPc) { score += 0.04; reasons.push('落在目标主音上'); }
          out.push({
            targetTonic, targetMode:mode.id,
            targetLabel: targetTonic + ' ' + mode.short,
            targetRoman: role.roman, targetFunction: role.function,
            targetFunctionLabel: role.functionLabel, targetCategory: role.category,
            sourceRoman: sourceRole ? sourceRole.roman : null,
            sourceFunction: sourceRole ? sourceRole.function : null,
            targetChord: role, sourceLabel,
            relation, isPivot: !!sourceRole,
            score: clamp(score, 0, 1), reasons: Array.from(new Set(reasons))
          });
        }
      }
    }
    out.sort((a, b) => b.score - a.score || a.targetLabel.localeCompare(b.targetLabel));
    const seen = new Set();
    return out.filter(item => {
      const key = item.targetTonic + '|' + item.targetMode + '|' + item.targetRoman;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, opts.limit || 18);
  }
  function routeStep(chord, keyLabel, role) {
    return { chordId:chord.id, chord, roman:role.roman, function:role.function, key:keyLabel,
      noteNames:chord.noteNames, pcs:chord.pcs, category:role.category };
  }
  function modulationRoutes(sourceTonic, sourceMode, targetTonic, targetMode, opts) {
    opts = opts || {};
    const relation = keyRelation(sourceTonic, sourceMode, targetTonic, targetMode);
    const sCat = buildCatalog(sourceTonic, sourceMode, { sevenths:true, secondary:false, borrowed:false, chromatic:false });
    const tAll = buildCatalog(targetTonic, targetMode, { sevenths:true, secondary:true, borrowed:true, chromatic:true });
    const sScale = scale(sourceTonic, sourceMode), tScale = scale(targetTonic, targetMode);
    const sTonic = sCat.find(c => c.rootPc === sScale.tonic.pc && c.function === 'T' && c.quality.id !== 'dim') || sCat[0];
    const tTonic = tAll.find(c => c.rootPc === tScale.tonic.pc && c.function === 'T' && c.quality.id !== 'dim') || tAll[0];
    const tV7 = tAll.find(c => c.roman === 'V7') || tAll.find(c => c.roman === 'V');
    const tV = tAll.find(c => c.roman === 'V') || tV7;
    const tii = tAll.find(c => c.roman === 'ii7') || tAll.find(c => c.roman === 'ii');
    const tIV = tAll.find(c => c.roman === 'IV') || tAll.find(c => c.roman === 'iv');
    const pivots = commonPivots(sourceTonic, sourceMode, targetTonic, targetMode, { limit:10 });
    const routes = [], seen = new Set();
    const srcLabel = sourceTonic + ' ' + getMode(sourceMode).short;
    const tgtLabel = targetTonic + ' ' + getMode(targetMode).short;
    const startChord = opts.startChord || sTonic;
    const startRole = opts.startRole || {
      roman:startChord.roman, function:startChord.function, category:startChord.category || 'diatonic'
    };
    const sStep = routeStep(startChord, opts.startKeyLabel || srcLabel, startRole);
    const tStep = tTonic ? routeStep(tTonic, tgtLabel, { roman:tTonic.roman, function:tTonic.function, category:'diatonic' }) : null;
    function push(steps, recipe, score, explanation) {
      if (!steps.length) return;
      const cleaned = [];
      for (const st of steps) {
        if (!st) continue;
        const last = cleaned[cleaned.length-1];
        if (last && setKey(last.pcs) === setKey(st.pcs)) {
          if (st.roman && !last.roman.includes(st.roman)) last.roman = last.roman + ' = ' + st.roman;
          if (st.key && !last.key.includes(st.key)) last.key = last.key + ' / ' + st.key;
          last.category = 'pivot';
          if (st.targetRoman) last.targetRoman = st.targetRoman;
        } else cleaned.push(Object.assign({}, st));
      }
      const k = cleaned.map(x => x.pcs.join(',')).join('>');
      if (seen.has(k)) return; seen.add(k);
      routes.push({ steps:cleaned, recipe, score, explanation, relation });
    }
    const relationSemis = P.intervalClass(sScale.tonic.pc, tScale.tonic.pc);
    let directScore = 0.58 - relation.difficulty * 0.1;
    if (relation.type === 'same') directScore = 0.55;
    else if (relation.type === 'parallel') directScore = 0.86;
    else if ([3,4,8,9].includes(relationSemis)) directScore = 0.74;
    else if (relationSemis === 1 || relationSemis === 11) directScore = 0.62;
    if (tTonic && tV7 && setKey(tTonic.pcs) !== setKey(sTonic.pcs)) {
      push([sStep, routeStep(tTonic, tgtLabel, { roman:tTonic.roman, function:tTonic.function, category:'diatonic' }),
            routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
        relation.type === 'parallel' ? '同主音调式切换' : (relation.type === 'relative' ? '关系主和弦切换' : '目标主和弦对置'),
        directScore, '先直接建立目标主和弦（' + tgtLabel + '），再用目标调 V7–I 确认；适合段落对置与色彩转调。');
    }
    if (tii && tV7 && tTonic) {
      push([sStep, routeStep(tii, tgtLabel, { roman:tii.roman, function:tii.function, category:'diatonic' }),
            routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
        '新调 ii–V–I', 0.72 - relation.difficulty * 0.12, '不用中介，直接把新调 ii–V–I 作为转调模块；最稳妥的“新调建立”方式。');
    }
    if (tIV && tV7 && tTonic) {
      push([sStep, routeStep(tIV, tgtLabel, { roman:tIV.roman, function:tIV.function, category:'diatonic' }),
            routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
        '新调 IV–V–I', 0.68 - relation.difficulty * 0.1, '用新调下属准备属，再解决到主；比 ii–V–I 更开放。');
    }
    if (tV7 && tTonic) {
      push([sStep, routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
        '直接转调', 0.62 - relation.difficulty * 0.2, '旧调主和弦后直接进入新调 V7–I，靠终止式确立新中心。');
    }
    for (const p of pivots.slice(0, 6)) {
      if (!tV7 || !tTonic) break;
      const pivotStep = { chordId:'pivot:' + setKey(p.pcs), chord:p.sourceChord, roman:p.sourceRoman + ' = ' + p.targetRoman,
        function:p.sourceFunction + '→' + p.targetFunction, key:srcLabel + ' / ' + tgtLabel, noteNames:p.noteNames, pcs:p.pcs, category:'pivot',
        sourceRoman:p.sourceRoman, targetRoman:p.targetRoman };
      const base = 0.58 + p.score * 0.3 - relation.difficulty * 0.12;
      push([sStep, pivotStep,
        routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
        '中介和弦转调', base, p.explanation + ' 随后用新调 V7–I 确认。');
      if (tii && setKey(tii.pcs) !== setKey(p.pcs)) {
        push([sStep, pivotStep,
          routeStep(tii, tgtLabel, { roman:tii.roman, function:tii.function, category:'diatonic' }),
          routeStep(tV7, tgtLabel, { roman:tV7.roman, function:tV7.function, category:'diatonic' }), tStep],
          '中介 + 新调 ii–V–I', base - 0.03, p.explanation + ' 再用新调 ii–V–I 巩固。');
      }
    }
    const tN = tAll.find(c => c.roman === '♭II6') || tAll.find(c => c.roman === '♭II');
    if (tN && tV && tTonic) push([sStep,
      routeStep(tN, tgtLabel, { roman:tN.roman, function:tN.function, category:'neapolitan' }),
      routeStep(tV, tgtLabel, { roman:tV.roman, function:tV.function, category:'diatonic' }), tStep],
      '拿波里枢纽', 0.7 - relation.difficulty * 0.15, '用新调 ♭II6 作为下属/属前，半音下行到 V，再到 I。');
    const tGer = tAll.find(c => c.roman === 'Ger+6');
    if (tGer && tV && tTonic) push([sStep,
      routeStep(tGer, tgtLabel, { roman:tGer.roman, function:tGer.function, category:'aug6' }),
      routeStep(tV, tgtLabel, { roman:tV.roman, function:tV.function, category:'diatonic' }), tStep],
      '增六和弦枢纽', 0.68 - relation.difficulty * 0.12, '新调 Ger+6 向外扩张到 V；也可等音重释为 V7/♭II。');
    const tMed = tAll.find(c => c.category === 'chromaticMediant' && c.quality.id === 'maj');
    if (tMed && tV && tTonic) push([sStep,
      routeStep(tMed, tgtLabel, { roman:tMed.roman, function:tMed.function, category:'chromaticMediant' }),
      routeStep(tV, tgtLabel, { roman:tV.roman, function:tV.function, category:'diatonic' }), tStep],
      '色彩中介转调', 0.55 - relation.difficulty * 0.1, '用三度关系的色彩和弦平滑过渡，再由新调 V–I 确认。');
    if (!routes.length && tTonic) {
      const characteristic = tAll.find(c => c.rootPc !== tScale.tonic.pc && c.roman === '♭VII') ||
        tAll.find(c => c.rootPc !== tScale.tonic.pc && c.category === 'diatonic') ||
        tAll.find(c => c.rootPc !== tScale.tonic.pc);
      const middle = characteristic && setKey(characteristic.pcs) !== setKey(sTonic.pcs) &&
        setKey(characteristic.pcs) !== setKey(tTonic.pcs) ? characteristic : null;
      const hasDominant = !!(tV7 && tV7.function === 'D');
      push([sStep, middle && routeStep(middle, tgtLabel,
        { roman:middle.roman, function:middle.function, category:middle.category || 'modal' }), tStep],
        hasDominant ? '共同音/色彩过渡' : '调式色彩并置',
        0.42 - relation.difficulty * 0.02,
        hasDominant ? '以目标调式的特征和弦作为过渡，再用持续音、重复或短终止型巩固中心。' :
          '目标调式没有能形成 V7–I 的功能属和弦；先呈现特征和弦，再落到主和弦，用重复、持续音或终止型短句建立中心。');
    }
    routes.sort((a,b)=>b.score-a.score);
    return routes.slice(0, opts.limit || 8);
  }
  function modulationTargets(sourceTonic, sourceMode, progression, opts) {
    opts = opts || {};
    const last = progression && progression.length ? progression[progression.length - 1] : null;
    const scope = opts.scope || 'near';
    const sourceScale = scale(sourceTonic, sourceMode);
    const sourceCat = buildCatalog(sourceTonic, sourceMode, {
      sevenths:true, secondary:false, borrowed:true, chromatic:false
    });
    const tonics = opts.tonics && opts.tonics.length ? opts.tonics : tonicNamePool(opts.preferFlats);
    const candidates = [];
    for (const targetTonic of tonics) {
      const targetTonicPc = P.pcOf(targetTonic);
      for (const mode of D.MODES) {
        const relation = keyRelation(sourceTonic, sourceMode, targetTonic, mode.id);
        if (relation.type === 'same') continue;
        if (scope === 'parallel' && targetTonicPc !== sourceScale.tonic.pc) continue;
        if (scope === 'related' && targetTonicPc === sourceScale.tonic.pc) continue;
        if (scope === 'near' && !['parallel', 'relative', 'near'].includes(relation.type)) continue;
        const targetScale = scale(targetTonic, mode.id);
        const targetCat = buildCatalog(targetTonic, mode.id, {
          sevenths:true, secondary:false, borrowed:true, chromatic:false
        });
        const targetTonicChord = targetCat.find(c => c.rootPc === targetTonicPc && c.function === 'T' && c.quality.id !== 'dim') ||
          targetCat.find(c => c.rootPc === targetTonicPc);
        const targetV7 = targetCat.find(c => c.roman === 'V7') || targetCat.find(c => c.roman === 'V');
        const lastRole = last ? targetCat.find(c => sameChordPcs(c, last)) : null;
        const goalInSource = targetTonicChord ? sourceCat.find(c => sameChordPcs(c, targetTonicChord)) : null;
        const dominantInSource = targetV7 ? sourceCat.find(c => sameChordPcs(c, targetV7)) : null;
        const keyMode = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'].includes(mode.id);
        let score = 0.15 + (1 - relation.difficulty) * 0.35 + (keyMode ? 0.12 : 0);
        const reasons = [];
        if (relation.type === 'parallel') { score += 0.12; reasons.push('同主音调式，保留主音'); }
        else if (relation.type === 'relative') { score += 0.10; reasons.push('共享音阶，可平顺过渡'); }
        else if (relation.type === 'near') { score += 0.08; reasons.push(relation.label); }
        if (lastRole) {
          score += 0.14;
          reasons.push('当前 ' + last.roman + ' 可作目标 ' + lastRole.roman + '，是现成中介');
        }
        if (goalInSource) { score += 0.06; reasons.push('源调已有目标主和弦'); }
        if (dominantInSource) { score += 0.05; reasons.push('源调已有目标属和弦'); }
        if (targetScale.tonic.pc === sourceScale.tonic.pc) score += 0.04;
        if (mode.family === 'exotic' || mode.family === 'symmetrical') score -= 0.08;
        if (!reasons.length) reasons.push(relation.label);
        candidates.push({
          targetTonic, targetMode:mode.id,
          targetLabel: targetTonic + ' ' + mode.short,
          group:targetTonicPc === sourceScale.tonic.pc ? 'parallel' : 'related',
          relation, score:clamp(score, 0, 1), reasons:Array.from(new Set(reasons)),
          pivotRoman: lastRole ? lastRole.roman : null,
          targetTonicRoman: targetTonicChord ? targetTonicChord.roman : null,
          targetDominantRoman: targetV7 ? targetV7.roman : null
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.targetLabel.localeCompare(b.targetLabel));
    const seen = new Set();
    const perTonic = {};
    const perTonicLimit = opts.perTonicLimit || (scope === 'parallel' ? 16 : 3);
    const top = [];
    for (const item of candidates) {
      const key = item.targetTonic + '|' + item.targetMode;
      if (seen.has(key)) continue;
      if ((perTonic[item.targetTonic] || 0) >= perTonicLimit) continue;
      seen.add(key); top.push(item);
      perTonic[item.targetTonic] = (perTonic[item.targetTonic] || 0) + 1;
      if (top.length >= (opts.limit || 8)) break;
    }
    if (opts.withRoutes !== false) {
      for (const item of top) {
        const found = modulationRoutes(sourceTonic, sourceMode, item.targetTonic, item.targetMode, {
          limit:1, startChord:last, startKeyLabel:sourceTonic + ' ' + getMode(sourceMode).short
        });
        item.route = found[0] || null;
        if (item.route) item.score = clamp(item.score + Math.min(0.08, item.route.score * 0.08), 0, 1);
      }
      top.sort((a, b) => b.score - a.score || a.targetLabel.localeCompare(b.targetLabel));
    }
    return top;
  }
  function identifyChord(noteNamesOrPcs, tonicName, modeId) {
    let pcs, names = null;
    if (typeof noteNamesOrPcs === 'string') {
      names = noteNamesOrPcs.trim().split(/\s+/);
      pcs = names.map(P.pcOf);
    } else {
      pcs = noteNamesOrPcs.map(x => typeof x === 'string' ? P.pcOf(x) : mod(x,12));
    }
    pcs = pcSet(pcs);
    const cat = buildCatalog(tonicName, modeId, {});
    const exact = cat.filter(c => c.pcs.length === pcs.length && setKey(c.pcs) === setKey(pcs));
    const subsets = cat.filter(c => c.pcs.every(pc => pcs.includes(pc)) && c.pcs.length < pcs.length);
    return { pcs, exact, subsets, noteNames:names };
  }
  function analyzeProgression(chords, tonicName, modeId) {
    const cat = buildCatalog(tonicName, modeId, {});
    const rows = chords.map((c, i) => {
      const match = cat.find(x => setKey(x.pcs) === setKey(c.pcs) && x.rootPc === c.rootPc) || cat.find(x => setKey(x.pcs) === setKey(c.pcs));
      return { index:i, chord:c, roman:match ? match.roman : (c.roman || '?'), function:match ? match.function : (c.function || 'C'), role:match || null };
    });
    const cadences = [];
    const tonicPc = scale(tonicName, modeId).tonic.pc;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i-1], b = rows[i];
      if (!a.role || !b.role) continue;
      const tonicArrival = b.function === 'T' && b.chord.rootPc === tonicPc;
      if (a.function === 'D' && tonicArrival) cadences.push({ type:'PAC', at:i, name:'正格终止', strength:1 });
      else if (a.function === 'D' && b.function === 'T') cadences.push({ type:'Deceptive', at:i, name:'阻碍/弱解决', strength:0.45 });
      else if (a.function === 'S' && tonicArrival) cadences.push({ type:'PC', at:i, name:'变格终止', strength:0.6 });
    }
    if (rows.length && rows[rows.length-1].function === 'D') cadences.push({ type:'HC', at:rows.length-1, name:'半终止', strength:0.55 });
    return { rows, cadences };
  }
  function nextCandidates(progression, tonicName, modeId, opts) {
    opts = opts || {};
    const requiredPcs = normalizePcs(opts.requiredPcs);
    const sopranoMidi = opts.sopranoMidi == null || opts.sopranoMidi === '' ? null : Number(opts.sopranoMidi);
    const sopranoPc = sopranoMidi == null ? null : mod(sopranoMidi, 12);
    const sopranoInvalid = sopranoMidi != null &&
      (!Number.isInteger(sopranoMidi) || sopranoMidi < SATB_RANGES.soprano[0] || sopranoMidi > SATB_RANGES.soprano[1]);
    const styleId = Object.prototype.hasOwnProperty.call(PERIOD_STYLE_CATEGORIES, opts.periodStyle)
      ? opts.periodStyle : null;
    const weights = PERIOD_SCORE_WEIGHTS[styleId] || DEFAULT_SCORE_WEIGHTS;
    const accepts = chord => !sopranoInvalid && (!styleId || periodAllowsChord(styleId, chord)) &&
      chordIncludesPcs(chord, requiredPcs) && (sopranoPc == null || chord.pcs.includes(sopranoPc));
    const cat = buildCatalog(tonicName, modeId, { sevenths:opts.sevenths !== false, secondary:opts.secondary !== false, borrowed:opts.borrowed !== false, chromatic:opts.chromatic !== false });
    const last = progression[progression.length - 1] || null;
    const target = opts.targetKey ? { key:opts.targetKey, mode:opts.targetMode || 'major' } : null;
    const pivots = target
      ? commonPivots(tonicName, modeId, target.key, target.mode, { limit:20 }).filter(p => accepts(p.sourceChord))
      : [];
    const candidates = [];
    const voicingFailures = [];
    for (const c of cat) {
      if (!accepts(c)) continue;
      if (last && c.id === last.id) continue;
      const voicing = bestVoicingForChord(c, opts, last);
      if (!voicing) {
        voicingFailures.push(voicingFailureReason(c, opts));
        continue;
      }
      let score = 0;
      const reasons = [], warnings = [];
      if (last) {
        const flow = (D.FUNCTION_FLOW[last.function] || D.FUNCTION_FLOW.C)[c.function] || 0.4;
        const rootScore = rootMotionScore(last.rootPc, c.rootPc);
        const vl = voiceLeading(last, c);
        const commonScore = vl.common.length / Math.max(1, Math.min(last.pcs.length, c.pcs.length));
        score = weights.flow * flow + weights.root * rootScore + weights.voice * (1 - vl.cost) +
          weights.common * commonScore + weights.stability * (c.stability || 0.5);
        if (flow >= 0.9) reasons.push('功能进行 ' + last.function + '→' + c.function);
        if (rootScore >= 0.9) reasons.push('根音下行五度');
        else if (rootScore >= 0.65) reasons.push('根音三度关系');
        if (voicing.transition) {
          if (voicing.transition.commonTones) reasons.push('实际保持共同音 ' + voicing.transition.commonTones + ' 个');
          if (voicing.transition.totalMotion <= 8) reasons.push('SATB 实际移动 ' + voicing.transition.totalMotion + ' 半音');
          if (!voicing.transition.penalty) reasons.push('SATB 连接通过平行五/八度检查');
          warnings.push(...voicing.transition.issues);
          score -= Math.min(0.32, voicing.transition.penalty * 0.012);
        } else {
          if (vl.common.length) reasons.push('共同音 ' + vl.common.length + ' 个');
          if (vl.total <= 4) reasons.push('声部总移动仅 ' + vl.total + ' 半音');
          warnings.push(...tendencyWarnings(last, c));
        }
        if (last.function === 'D' && c.function === 'T') {
          const strongTonic = c.category === 'diatonic' && ['I','i','I6','i6'].includes(c.roman);
          const strength = strongTonic ? 1 : (['vi','VI'].includes(c.roman) ? 0.55 : (['iii','III'].includes(c.roman) ? 0.3 : 0.35));
          score += 0.06 * (strength - 0.5);
          if (strongTonic) { score += 0.08; reasons.push('解决到主功能'); }
          else if (['vi','VI'].includes(c.roman)) score += 0.015;
          else score -= 0.09;
        }
        if (last.function === 'S' && c.function === 'D') { score += 0.06; reasons.push('下属推动属'); }
      } else {
        score = c.function === 'T' ? 0.9 : (c.category === 'diatonic' ? 0.6 : 0.45);
        reasons.push('可作为起点');
      }
      if (pivots.length) {
        const p = pivots.find(x => setKey(x.pcs) === setKey(c.pcs));
        if (p) { score += 0.15; reasons.push('可作转往 ' + target.key + ' ' + getMode(target.mode).short + ' 的中介：' + p.sourceRoman + ' = ' + p.targetRoman); }
      }
      if (c.category === 'diatonic') score += 0.035;
      else if (c.category === 'borrowed') { score -= 0.025; reasons.push('同主音调式借用'); }
      else if (c.category === 'secondary') { score -= 0.035; reasons.push('局部离调：' + c.roman); }
      else if (c.category === 'aug6' || c.category === 'neapolitan' || c.category === 'tritoneSub') score -= 0.04;
      if (c.roman === 'V' || c.roman === 'V7') { score += 0.055; reasons.push('直接确认主调'); }
      if (c.roman === 'vi' || c.roman === 'vi7') score += 0.02;
      if (c.seventh && styleId !== 'modernPostTonal') score -= 0.018;
      if (c.category === 'borrowed' && c.function === 'T') score -= 0.02;
      if (c.category === 'aug6' || c.category === 'neapolitan' || c.category === 'tritoneSub') reasons.push(c.functionLabel);
      if (styleId === 'commonPractice') {
        if (c.category === 'diatonic') score += 0.035;
        else if (c.category === 'secondary') score += 0.015;
        else if (c.category === 'neapolitan' || c.category === 'aug6') score += 0.025;
      } else if (styleId === 'expandedTonality') {
        if (c.category === 'borrowed') score += 0.04;
        else if (c.category === 'chromaticMediant') score += 0.05;
        else if (c.category === 'neapolitan' || c.category === 'aug6') score += 0.035;
      } else if (styleId === 'modernPostTonal') {
        if (c.category === 'modal') score += 0.08;
        else if (c.category === 'tritoneSub') score += 0.06;
        else if (c.category === 'chromaticMediant') score += 0.045;
        else if (c.category === 'borrowed') score += 0.03;
      }
      candidates.push({
        chord:c, score:clamp(score,0,1), reasons:[...new Set(reasons)], warnings,
        voicing, inversion:voicing.inversion, voiceLeading:voicing.transition,
        periodFits:chordPeriodFits(c), constraintRoles:chordToneRoles(c, requiredPcs)
      });
    }
    candidates.sort((a,b)=>b.score-a.score);
    const diverse = [], seenGroups = new Set();
    for (const x of candidates) {
      const group = x.chord.rootPc + ':' + x.chord.function + ':' + x.chord.category;
      if (seenGroups.has(group)) continue;
      seenGroups.add(group); diverse.push(x);
      if (diverse.length >= (opts.limit || 18)) break;
    }
    const result = diverse;
    if (opts.grouped) {
      const anchor = last || (result[0] && result[0].chord) || null;
      const showcase = [];
      if (styleId) {
        const seen = new Set();
        for (const category of PERIOD_SHOWCASE_ORDER[styleId] || []) {
          const item = result.find(candidate => candidate.chord.category === category && !seen.has(candidate.chord.key));
          if (!item) continue;
          seen.add(item.chord.key);
          showcase.push(item);
          if (showcase.length >= 6) break;
        }
        for (const item of result) {
          if (showcase.length >= 6) break;
          if (seen.has(item.chord.key)) continue;
          seen.add(item.chord.key);
          showcase.push(item);
        }
      } else {
        showcase.push(...result.slice(0, 6));
      }
      const modulation = pivots.slice(0,12).map(p => {
        const voicing = bestVoicingForChord(p.sourceChord, opts, last);
        return voicing ? {
          chord:p.sourceChord, voicing, inversion:voicing.inversion, voiceLeading:voicing.transition,
          score:p.score, reasons:[p.explanation], warnings:voicing.transition ? voicing.transition.issues : [],
          targetRoman:p.targetRoman, periodFits:chordPeriodFits(p.sourceChord),
          constraintRoles:chordToneRoles(p.sourceChord, requiredPcs)
        } : null;
      }).filter(Boolean).slice(0,6);
      const emptyReason = result.length ? null
        : (sopranoInvalid
          ? '固定高音超过 C4–C6 的可写音域。'
          : (sopranoPc != null && voicingFailures.length
            ? voicingFailures[0]
            : (requiredPcs.length
          ? '当前时期库存中没有同时包含指定音的和弦；减少必含音或切换到其他时期。'
          : (styleId ? '当前调式与所选时期没有可用和弦；请切换调式或时期。' : '当前设置没有可用的下一步。'))));
      return {
        period: showcase,
        functional: result.filter(x => ['T','S','D'].includes(x.chord.function) && x.chord.category === 'diatonic').slice(0,6),
        smooth: anchor ? result.slice().sort((a,b)=>(a.voiceLeading ? a.voiceLeading.penalty + a.voiceLeading.totalMotion * 0.1 : 1e6) -
          (b.voiceLeading ? b.voiceLeading.penalty + b.voiceLeading.totalMotion * 0.1 : 1e6)).slice(0,6) : [],
        color: result.filter(x => ['borrowed','chromaticMediant','neapolitan','aug6','tritoneSub','modal'].includes(x.chord.category)).slice(0,6),
        modulation,
        periodStyle: styleId || 'any',
        requiredPcs,
        sopranoMidi,
        inversion: opts.inversion == null || opts.inversion === '' ? 'auto' : Number(opts.inversion),
        candidateCount: result.length,
        emptyReason
      };
    }
    return result;
  }
  function normalForm(pcs) {
    const s = pcSet(pcs);
    if (!s.length) return [];
    let best = null;
    for (let i = 0; i < s.length; i++) {
      const rot = s.slice(i).concat(s.slice(0, i).map(x => x + 12));
      const span = rot[rot.length-1] - rot[0];
      const cand = rot.map(x => x - rot[0]);
      if (!best || span < best.span || (span === best.span && lexLess(cand, best.cand))) best = { span, cand };
    }
    return best.cand;
  }
  function lexLess(a, b) {
    for (let i=0;i<Math.min(a.length,b.length);i++) if (a[i] !== b[i]) return a[i] < b[i];
    return a.length < b.length;
  }
  function primeForm(pcs) {
    const n = normalForm(pcs);
    const inv = normalForm(n.map(x => mod(12 - x, 12)));
    return lexLess(n, inv) ? n : inv;
  }
  function intervalVector(pcs) {
    const s = pcSet(pcs), v = [0,0,0,0,0,0];
    for (let i=0;i<s.length;i++) for (let j=i+1;j<s.length;j++) {
      let d = Math.abs(s[i]-s[j]); d = Math.min(d, 12-d);
      if (d >= 1 && d <= 6) v[d-1]++;
    }
    return v;
  }
  function complement(pcs) { const s = new Set(pcSet(pcs)); return ALL_PCS.filter(x => !s.has(x)); }
  function transposeSet(pcs, n) { return pcSet(pcs.map(x => mod(x+n,12))); }
  function invertSet(pcs, axis) { axis = axis == null ? 0 : axis; return pcSet(pcs.map(x => mod(2*axis - x, 12))); }
  function setClassInfo(pcs) {
    return { normalForm:normalForm(pcs), primeForm:primeForm(pcs), intervalVector:intervalVector(pcs),
      cardinality:pcSet(pcs).length, complement:complement(pcs), transpositions:12, inversions:12 };
  }
  function scalesContaining(pcs, tonicName) {
    const target = pcSet(pcs);
    return D.MODES.filter(m => { const s = scale(tonicName, m.id); return target.every(pc => s.pcs.includes(pc)); })
      .map(m => ({ mode:m.id, name:m.name, scale:scale(tonicName, m.id).notes.map(n=>n.name) }));
  }
  function chordsContaining(pcs, tonicName, modeId) {
    const cat = buildCatalog(tonicName, modeId, {});
    const target = pcSet(pcs);
    return cat.filter(c => target.every(pc => c.pcs.includes(pc)));
  }
  function twelveToneMatrix(row) {
    if (row.length !== 12 || new Set(row).size !== 12) throw new Error('row must contain 12 unique pcs');
    const p0 = row.map(x => mod(x,12));
    const matrix = [];
    for (let i=0;i<12;i++) {
      const rowI = [];
      for (let j=0;j<12;j++) rowI.push(mod(p0[i] + p0[j] - p0[0], 12));
      matrix.push(rowI);
    }
    return matrix;
  }
  function neoRiemannian(rootPc, qualityId, op) {
    const isMajor = qualityId === 'maj';
    if (op === 'P') return { rootPc:mod(rootPc,12), quality:isMajor ? 'min' : 'maj' };
    if (op === 'L') return { rootPc:mod(rootPc + (isMajor ? 4 : -4), 12), quality:isMajor ? 'min' : 'maj' };
    if (op === 'R') return { rootPc:mod(rootPc + (isMajor ? -3 : 3), 12), quality:isMajor ? 'min' : 'maj' };
    throw new Error('unknown neo-Riemannian op: ' + op);
  }
  function transformPath(rootPc, qualityId, ops) {
    let cur = { rootPc:mod(rootPc,12), quality:qualityId };
    const path = [cur];
    for (const op of ops) { cur = neoRiemannian(cur.rootPc, cur.quality, op); path.push(cur); }
    return path;
  }

  function catalogForRole(tonicName, modeId, roman, opts) {
    const list = buildCatalog(tonicName, modeId, opts || {});
    return list.find(c => c.roman === roman) || list.find(c => c.roles.some(r => r.roman === roman));
  }

  return {
    MODES, QUALITIES, scale, getMode, getQuality, qualityFromPcs, romanFor, makeChord,
    diatonicChords, buildCatalog, secondaryDominants, borrowedChords, neapolitanChords,
    augmentedSixths, tritoneSubs, chromaticMediants, modalColorChords, scaleSubsetChords,
    voiceLeading, tendencyWarnings, rootMotionScore, nextCandidates, analyzeProgression,
    SATB_VOICES, SATB_VOICE_LABELS, SATB_RANGES, INVERSION_LABELS,
    chordToneEntries, listVoicings, bestVoicingForChord, voicingFromChord, materializeVoicing,
    analyzeVoiceLeading, analyzeVoicings, voicingFailureReason, midiLabel,
    identifyChord, commonPivots, keyRelation, chordInterpretations, modulationRoutes,
    modulationTargets, catalogForRole,
    normalizePcs, chordToneRole, chordToneRoles, chordIncludesPcs, periodAssessment,
    chordPeriodFits, periodAllowsChord, PERIOD_STYLE_CATEGORIES,
    normalForm, primeForm, intervalVector, complement, transposeSet, invertSet, setClassInfo,
    scalesContaining, chordsContaining, twelveToneMatrix, neoRiemannian, neoRiemann: neoRiemannian, transformPath,
    pcSet, setKey
  };
});
