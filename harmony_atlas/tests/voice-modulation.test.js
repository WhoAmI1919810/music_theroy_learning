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
