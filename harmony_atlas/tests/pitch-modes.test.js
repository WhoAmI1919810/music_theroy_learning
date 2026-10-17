const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app', 'js');
const D = require(path.join(root, 'theory-data.js'));
const P = require(path.join(root, 'pitch.js'));
const E = require(path.join(root, 'engine.js'));

test('defines sixteen distinct modes and scales', () => {
  assert.equal(D.MODES.length, 16);
  assert.equal(new Set(D.MODES.map((mode) => mode.id)).size, 16);
  for (const mode of D.MODES) {
    const result = E.scale('C', mode.id);
    assert.equal(result.notes.length, mode.intervals.length);
    assert.equal(result.notes[0].pc, 0);
    assert.equal(new Set(result.pcs).size, mode.intervals.length);
    assert.deepEqual(result.pcs, mode.intervals);
  }
});

test('spells tonal scales by letter name rather than pitch class alone', () => {
  assert.deepEqual(E.scale('F#', 'major').notes.map((note) => note.name), ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
  assert.deepEqual(E.scale('Eb', 'major').notes.map((note) => note.name), ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D']);
  assert.deepEqual(E.scale('C', 'harmonicMinor').notes.map((note) => note.name), ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B']);
  assert.deepEqual(P.spellChord('C', [0, 4, 7], [0, 2, 4]).map((note) => note.name), ['C', 'E', 'G']);
});

test('identifies triad and seventh qualities from pitch classes', () => {
  assert.equal(E.qualityFromPcs(0, [0, 4, 7]).id, 'maj');
  assert.equal(E.qualityFromPcs(0, [0, 3, 7]).id, 'min');
  assert.equal(E.qualityFromPcs(0, [0, 3, 6]).id, 'dim');
  assert.equal(E.qualityFromPcs(0, [0, 4, 8]).id, 'aug');
  assert.equal(E.qualityFromPcs(0, [0, 4, 7, 10]).id, 'dom7');
  assert.equal(E.qualityFromPcs(0, [0, 4, 7, 11]).id, 'maj7');
  assert.equal(E.qualityFromPcs(0, [0, 3, 7, 10]).id, 'min7');
  assert.equal(E.qualityFromPcs(0, [0, 3, 6, 10]).id, 'hdim7');
  assert.equal(E.qualityFromPcs(0, [0, 3, 6, 9]).id, 'dim7');
});

test('normalizes pitch names and computes enharmonic equivalents', () => {
  assert.equal(P.pcOf('B#'), 0);
  assert.equal(P.pcOf('Cb'), 11);
  assert.equal(P.enharmonicName(10, false), 'A#');
  assert.equal(P.enharmonicName(10, true), 'Bb');
  assert.deepEqual(P.uniquePcs([0, 12, -12, 7, 7]), [0, 7]);
});

test('measures circle-of-fifths distance independently of enharmonic spelling', () => {
  assert.equal(P.circleDistance('C', 'Bb'), 2);
  assert.equal(P.circleDistance('C', 'A#'), 2);
  assert.equal(P.circleDistance('Ab', 'G#'), 0);
  assert.equal(E.keyRelation('C', 'major', 'Bb', 'major').type, 'near');
  assert.equal(E.keyRelation('C', 'major', 'Eb', 'major').type, 'medium');
});
