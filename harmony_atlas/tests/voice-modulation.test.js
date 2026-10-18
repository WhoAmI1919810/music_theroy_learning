const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app', 'js');
const E = require(path.join(root, 'engine.js'));
const D = require(path.join(root, 'theory-data.js'));

function chord(catalog, roman) {
  return catalog.find((item) => item.roman === roman);
}

test('rewards V7 to I and flags unresolved tendency tones', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const V7 = chord(catalog, 'V7');
  const I = chord(catalog, 'I');
  const IV = chord(catalog, 'IV');
  assert.deepEqual(E.tendencyWarnings([V7, I]), []);
  assert.ok(E.tendencyWarnings(V7, IV).length >= 1);
  const next = E.nextCandidates([V7], 'C', 'major', { limit: 3 });
  assert.equal(next[0].chord.roman, 'I');
  assert.ok(next[0].score > 0.9);
});

test('filters candidates by required chord tones and reports their chord roles', () => {
  const next = E.nextCandidates([], 'C', 'major', { requiredPcs: ['C', 'E'], limit: 100 });
  assert.ok(next.length > 0);
  assert.ok(next.every((item) => item.chord.pcs.includes(0) && item.chord.pcs.includes(4)));
  assert.deepEqual(next[0].constraintRoles.map((entry) => entry.pc), [0, 4]);
  assert.ok(next[0].constraintRoles.every((entry) => entry.role));
  const triad = E.makeChord({ rootName: 'C', quality: 'maj' });
  assert.equal(E.chordToneRole(triad, 'C'), '根音');
  assert.equal(E.chordToneRole(triad, 'E'), '三音');
  assert.equal(E.chordToneRole(triad, 'G'), '五音');
});

test('returns an explicit empty result when required tones have no match', () => {
  const grouped = E.nextCandidates([], 'C', 'major', {
    requiredPcs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], grouped: true
  });
  assert.equal(grouped.candidateCount, 0);
  assert.deepEqual(grouped.functional, []);
  assert.ok(grouped.emptyReason.includes('指定音'));
});

test('filters recommendation categories by historical period', () => {
  const allowed = {
    commonPractice: new Set(['diatonic', 'secondary', 'neapolitan', 'aug6']),
    expandedTonality: new Set(['diatonic', 'secondary', 'borrowed', 'neapolitan', 'aug6', 'chromaticMediant'])
  };
  for (const style of Object.keys(allowed)) {
    const next = E.nextCandidates([], 'C', 'major', { periodStyle: style, limit: 200 });
    assert.ok(next.length > 0);
    assert.ok(next.every((item) => allowed[style].has(item.chord.category)));
  }
  const common = E.nextCandidates([], 'C', 'major', { periodStyle: 'commonPractice', limit: 200 });
  assert.ok(!common.some((item) => ['borrowed', 'chromaticMediant', 'tritoneSub', 'modal'].includes(item.chord.category)));
  const expanded = E.nextCandidates([], 'C', 'major', { periodStyle: 'expandedTonality', limit: 200 });
  assert.ok(expanded.some((item) => item.chord.category === 'borrowed'));
  assert.ok(expanded.some((item) => item.chord.category === 'chromaticMediant'));
  assert.ok(!expanded.some((item) => ['tritoneSub', 'modal'].includes(item.chord.category)));
  const locked = E.nextCandidates([], 'C', 'major', {
    periodStyle: 'commonPractice', requiredPcs: ['C', 'E'], limit: 200
  });
  assert.ok(locked.every((item) => allowed.commonPractice.has(item.chord.category)));
  assert.ok(locked.every((item) => item.chord.pcs.includes(0) && item.chord.pcs.includes(4)));
});

test('builds a distinct period showcase for each historical syntax', () => {
  const common = E.nextCandidates([], 'C', 'major', { periodStyle: 'commonPractice', grouped: true, limit: 80 });
  const expanded = E.nextCandidates([], 'C', 'major', { periodStyle: 'expandedTonality', grouped: true, limit: 80 });
  const modern = E.nextCandidates([], 'C', 'major', { periodStyle: 'modernPostTonal', grouped: true, limit: 80 });
  assert.ok(common.period.every((item) => ['diatonic', 'secondary', 'neapolitan', 'aug6'].includes(item.chord.category)));
  assert.ok(expanded.period.some((item) => ['borrowed', 'chromaticMediant'].includes(item.chord.category)));
  assert.ok(modern.period.some((item) => ['tritoneSub', 'chromaticMediant', 'borrowed'].includes(item.chord.category)));
  assert.notDeepEqual(common.period.map((item) => item.chord.roman), expanded.period.map((item) => item.chord.roman));
  assert.notDeepEqual(expanded.period.map((item) => item.chord.roman), modern.period.map((item) => item.chord.roman));
});

test('labels each chord with applicable historical syntax', () => {
  const catalog = E.buildCatalog('C', 'major', { sevenths: false, secondary: false, borrowed: true, chromatic: true });
  const diatonic = catalog.find((item) => item.category === 'diatonic');
  const borrowed = catalog.find((item) => item.category === 'borrowed');
  const tritone = catalog.find((item) => item.category === 'tritoneSub');
  assert.deepEqual(E.chordPeriodFits(diatonic).map((item) => item.id), ['commonPractice', 'expandedTonality', 'modernPostTonal']);
  const borrowedAssessment = E.periodAssessment(borrowed);
  assert.equal(borrowedAssessment.find((item) => item.id === 'commonPractice').applicable, false);
  assert.equal(borrowedAssessment.find((item) => item.id === 'expandedTonality').applicable, true);
  assert.equal(borrowedAssessment.find((item) => item.id === 'modernPostTonal').applicable, true);
  const tritoneAssessment = E.periodAssessment(tritone);
  assert.equal(tritoneAssessment.find((item) => item.id === 'commonPractice').applicable, false);
  assert.equal(tritoneAssessment.find((item) => item.id === 'expandedTonality').applicable, false);
  assert.equal(tritoneAssessment.find((item) => item.id === 'modernPostTonal').applicable, true);
});

test('finds shared pivots between C major and G major', () => {
  const pivots = E.commonPivots('C', 'major', 'G', 'major', { limit: 12 });
  assert.ok(pivots.length >= 4);
  assert.ok(pivots.some((item) => item.sourceRoman === 'I' && item.targetRoman === 'IV'));
  assert.ok(pivots.some((item) => item.sourceRoman === 'V' && item.targetRoman === 'I'));
  assert.ok(pivots.some((item) => item.sourceRoman === 'vi' && item.targetRoman === 'ii'));
});

test('classifies near, relative, and remote keys', () => {
  const near = E.keyRelation('C', 'major', 'G', 'major');
  const relative = E.keyRelation('C', 'major', 'A', 'naturalMinor');
  const remote = E.keyRelation('C', 'major', 'E', 'major');
  assert.equal(near.type, 'near');
  assert.equal(near.sharedCount, 6);
  assert.equal(relative.type, 'relative');
  assert.equal(relative.sharedCount, 7);
  assert.equal(remote.type, 'medium');
  assert.equal(remote.sharedCount, 3);
});

test('generates playable modulation routes with confirmation', () => {
  const routes = E.modulationRoutes('C', 'major', 'G', 'major', { limit: 9 });
  assert.ok(routes.length > 0);
  assert.ok(routes.every((route) => route.steps.length >= 3));
  assert.ok(routes.some((route) => route.steps.some((step) => step.category === 'pivot')));
  const pivotRoute = routes.find((route) => route.recipe === '中介和弦转调');
  assert.ok(pivotRoute);
  assert.deepEqual(pivotRoute.steps.map((step) => step.roman), ['I', 'vi = ii', 'V7', 'I']);
});

test('analyzes cadence types from a progression', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const progression = [chord(catalog, 'I'), chord(catalog, 'IV'), chord(catalog, 'V7'), chord(catalog, 'I')];
  const result = E.analyzeProgression(progression, 'C', 'major');
  assert.deepEqual(result.rows.map((row) => row.roman), ['I', 'IV', 'V7', 'I']);
  assert.ok(result.cadences.some((cadence) => cadence.type === 'PAC' && cadence.at === 3));
});

test('reinterprets one chord across target modes and keys', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const vi = chord(catalog, 'vi');
  const targets = E.chordInterpretations(vi, 'C', 'major', { limit: 30 });
  assert.ok(targets.length > 8);
  assert.ok(targets.some((item) => item.targetLabel === 'A 自然小调' && item.targetRoman === 'i'));
  assert.ok(targets.some((item) => item.targetLabel === 'G 大调' && item.targetRoman === 'ii' && item.isPivot));
  assert.ok(targets.every((item) => item.reasons.length > 0));
});

test('ranks reachable target modes from the current progression', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const vi = chord(catalog, 'vi');
  const targets = E.modulationTargets('C', 'major', [vi], { scope: 'near', limit: 8 });
  assert.ok(targets.length > 0);
  assert.ok(targets.some((item) => item.targetLabel === 'G 大调' && item.pivotRoman === 'ii'));
  assert.ok(targets.every((item) => item.reasons.length > 0));
  const all = E.modulationTargets('C', 'major', [vi], { scope: 'all', limit: 5, withRoutes: false });
  assert.equal(all.length, 5);
  assert.equal(new Set(all.map((item) => item.targetTonic + item.targetMode)).size, all.length);
});

test('starts a generated route from the current chord', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const vi = chord(catalog, 'vi');
  const routes = E.modulationRoutes('C', 'major', 'G', 'major', { limit: 3, startChord: vi });
  assert.ok(routes.length > 0);
  assert.equal(routes[0].steps[0].roman, 'vi');
});

test('supports the complete interaction loop in all sixteen modes', () => {
  for (const mode of D.MODES) {
    const catalog = E.buildCatalog('C', mode.id, {
      sevenths: true, secondary: true, borrowed: true, chromatic: true
    });
    assert.ok(catalog.length > 0, mode.id + ' needs a usable catalog');
    const first = catalog.find((item) => item.category === 'diatonic') || catalog[0];
    const next = E.nextCandidates([first], 'C', mode.id, { limit: 4 });
    const interpretations = E.chordInterpretations(first, 'C', mode.id, { limit: 5 });
    const targets = E.modulationTargets('C', mode.id, [first], {
      scope: 'all', limit: 5, withRoutes: false
    });
    assert.ok(next.length > 0, mode.id + ' needs next-step candidates');
    assert.ok(interpretations.length > 0, mode.id + ' needs cross-mode reinterpretations');
    assert.ok(targets.length > 0, mode.id + ' needs target-mode recommendations');
  }
});
