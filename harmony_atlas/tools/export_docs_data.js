/* Export deterministic documentation data from the same engine used by the app. */
'use strict';

const E = require('../app/js/engine.js');
const D = require('../app/js/theory-data.js');
const P = require('../app/js/pitch.js');

const pretty = (value) => P.prettyAccidental(String(value));

function compactSteps(steps) {
  return steps.map((step) => ({
    roman: pretty(step.chord.roman),
    notes: step.chord.noteNames.map(pretty),
    reason: (step.reasons || []).slice(0, 2).join(' · '),
    score: Number(step.score.toFixed(3))
  }));
}

function modeActionRows(mode) {
  const scale = E.scale('C', mode.id);
  const base = {
    id: mode.id,
    name: mode.name,
    short: mode.short,
    scale: scale.notes.map((note) => pretty(note.name)),
    heptatonic: mode.intervals.length === 7,
    chords: []
  };
  if (!base.heptatonic) {
    base.subsetCount = E.scaleSubsetChords('C', mode.id, { sevenths: false }).length;
    return base;
  }
  const triads = E.diatonicChords('C', mode.id, { sevenths: false });
  base.chords = triads.map((chord) => {
    const next = E.nextCandidates([chord], 'C', mode.id, {
      limit: 2, sevenths: false, secondary: false, borrowed: false, chromatic: false
    });
    const interpretations = E.chordInterpretations(chord, 'C', mode.id, { limit: 48, preferFlats: true });
    const sameTonic = [];
    const keyTargets = [];
    const modalTargets = [];
    const seenKeyTonic = new Set();
    for (const item of interpretations) {
      if (item.targetTonic === 'C' && item.targetMode === mode.id) continue;
      const target = {
        tonic: item.targetTonic,
        label: pretty(item.targetLabel),
        roman: pretty(item.targetRoman),
        function: item.targetFunction,
        isPivot: !!item.isPivot,
        category: item.targetCategory,
        relation: item.relation.label,
        modeId: item.targetMode,
        modeFamily: item.targetMode ? E.getMode(item.targetMode).family : ''
      };
      if (item.targetTonic === 'C') {
        if (!sameTonic.some((x) => x.label === target.label && x.roman === target.roman)) sameTonic.push(target);
      } else if (['major', 'minor'].includes(target.modeFamily)) {
        if (!seenKeyTonic.has(item.targetTonic)) {
          seenKeyTonic.add(item.targetTonic);
          keyTargets.push(target);
        }
      } else if (!modalTargets.some((x) => x.label === target.label && x.roman === target.roman)) {
        modalTargets.push(target);
      }
    }
    const samePriority = ['naturalMinor', 'harmonicMinor', 'melodicMinor', 'harmonicMajor', 'major',
      'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
    const pickSame = sameTonic.sort((a, b) => {
      const ai = samePriority.indexOf(a.modeId);
      const bi = samePriority.indexOf(b.modeId);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })[0];
    const chosen = [];
    if (pickSame) chosen.push(pickSame);
    chosen.push(...keyTargets.slice(0, 3));
    if (chosen.length < 3 && modalTargets.length) chosen.push(modalTargets[0]);
    return {
      roman: pretty(chord.roman),
      notes: chord.noteNames.map(pretty),
      quality: chord.quality.name,
      function: chord.function,
      functionLabel: chord.functionLabel,
      next: compactSteps(next),
      targets: chosen
    };
  });
  return base;
}

const modes = D.MODES.map((mode) => {
  const scale = E.scale('C', mode.id);
  const heptatonic = mode.intervals.length === 7;
  const triads = heptatonic ? E.diatonicChords('C', mode.id, { sevenths: false }) : [];
  const catalog = E.buildCatalog('C', mode.id, { sevenths: true, chromatic: true });
  return {
    id: mode.id,
    name: mode.name,
    short: mode.short,
    family: mode.family,
    mood: mode.mood,
    intervals: mode.intervals,
    scale: scale.notes.map((note) => pretty(note.name)),
    functions: mode.functions,
    functionNotes: mode.functionNotes,
    heptatonic,
    triads: triads.map((chord) => ({
      roman: pretty(chord.roman),
      notes: chord.noteNames.map(pretty),
      quality: chord.quality.name,
      function: chord.function,
      functionLabel: chord.functionLabel
    })),
    subsetCount: heptatonic ? 0 : E.scaleSubsetChords('C', mode.id, { sevenths: false }).length,
    catalogCount: catalog.length
  };
});

const routes = [
  ['C', 'major', 'G', 'major'],
  ['C', 'major', 'E', 'major'],
  ['C', 'major', 'F#', 'major'],
  ['C', 'major', 'C', 'naturalMinor'],
  ['A', 'naturalMinor', 'C', 'major']
].map(([sourceTonic, sourceMode, targetTonic, targetMode]) => {
  const relation = E.keyRelation(sourceTonic, sourceMode, targetTonic, targetMode);
  const found = E.modulationRoutes(sourceTonic, sourceMode, targetTonic, targetMode, { limit: 4 });
  return {
    sourceTonic,
    sourceMode,
    targetTonic,
    targetMode,
    relation,
    routes: found.map((route) => ({
      recipe: route.recipe,
      score: route.score,
      explanation: route.explanation,
      steps: route.steps.map((step) => ({
        roman: pretty(step.roman),
        notes: step.noteNames.map(pretty),
        category: step.category || '',
        function: step.function || '',
        key: step.key || '',
        sourceRoman: step.sourceRoman ? pretty(step.sourceRoman) : '',
        targetRoman: step.targetRoman ? pretty(step.targetRoman) : ''
      }))
    }))
  };
});

const samples = E.buildCatalog('C', 'major', { sevenths: true, chromatic: true });
const sampleByRoman = {};
for (const chord of samples) {
  if (!sampleByRoman[chord.roman]) {
    sampleByRoman[chord.roman] = {
      roman: pretty(chord.roman),
      notes: chord.noteNames.map(pretty),
      function: chord.function,
      functionLabel: chord.functionLabel,
      category: chord.category
    };
  }
}

process.stdout.write(JSON.stringify({
  modes,
  modeActions: D.MODES.map(modeActionRows),
  outcomeLabels: D.OUTCOME_LABELS || {},
  routes,
  cadences: D.CADENCES,
  theory: D.THEORY_MAP,
  periods: D.PERIODS,
  textbooks: D.TEXTBOOKS,
  setClasses: D.COMMON_SET_CLASSES,
  samples: {
    count: samples.length,
    byRoman: sampleByRoman
  }
}, null, 2));
