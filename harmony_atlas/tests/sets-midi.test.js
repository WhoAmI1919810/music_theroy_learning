const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app', 'js');
const E = require(path.join(root, 'engine.js'));
const A = require(path.join(root, 'audio.js'));
const M = require(path.join(root, 'midi.js'));

test('computes normal form, prime form, vector, and complement', () => {
  const info = E.setClassInfo([0, 4, 7, 10]);
  assert.deepEqual(info.normalForm, [0, 3, 6, 8]);
  assert.deepEqual(info.primeForm, [0, 2, 5, 8]);
  assert.deepEqual(info.intervalVector, [0, 1, 2, 1, 1, 1]);
  assert.deepEqual(info.complement, [1, 2, 3, 5, 6, 8, 9, 11]);
  assert.deepEqual(E.transposeSet([0, 4, 7], 2), [2, 6, 9]);
  assert.deepEqual(E.invertSet([0, 4, 7], 0), [0, 5, 8]);
});

test('computes neo-Riemannian P, L, and R transformations', () => {
  assert.deepEqual(E.neoRiemann(0, 'maj', 'P'), { rootPc: 0, quality: 'min' });
  assert.deepEqual(E.neoRiemann(0, 'maj', 'L'), { rootPc: 4, quality: 'min' });
  assert.deepEqual(E.neoRiemann(0, 'maj', 'R'), { rootPc: 9, quality: 'min' });
  assert.deepEqual(E.transformPath(0, 'maj', ['P', 'L']), [
    { rootPc: 0, quality: 'maj' },
    { rootPc: 0, quality: 'min' },
    { rootPc: 8, quality: 'maj' }
  ]);
});

test('builds a twelve-tone matrix whose rows are transpositions', () => {
  const row = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const matrix = E.twelveToneMatrix(row);
  assert.equal(matrix.length, 12);
  assert.ok(matrix.every((line) => line.length === 12 && new Set(line).size === 12));
  assert.deepEqual(matrix[0], row);
  assert.deepEqual(matrix[5], [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4]);
  assert.throws(() => E.twelveToneMatrix([0, 0, 1, 2]), /12 unique/);
});

test('honors inversion bass in playback voicing', () => {
  const chord = E.makeChord({ rootName: 'C', quality: 'maj', inversion: 1 });
  assert.equal(chord.bassPc, 4);
  const voicing = A.chordVoicing(chord, 48);
  assert.equal(voicing[0] % 12, 4);
  assert.ok(voicing.some((midi) => midi % 12 === 0));
});

test('exports a structurally valid standard MIDI file', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const progression = ['I', 'V7', 'I'].map((roman) => catalog.find((item) => item.roman === roman));
  const bytes = M.buildMidi(progression);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.equal(bytes[8], 0);
  assert.equal(bytes[11], 1);
  assert.equal((bytes[12] << 8) | bytes[13], 480);
  const trackOffset = 14;
  assert.equal(String.fromCharCode(...bytes.slice(trackOffset, trackOffset + 4)), 'MTrk');
  const trackLength = (bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21];
  assert.equal(trackLength, bytes.length - 22);
  const tail = Array.from(bytes.slice(-3));
  assert.deepEqual(tail, [0xFF, 0x2F, 0x00]);
  assert.ok(Array.from(bytes).includes(0x51));
});

test('encodes MIDI variable-length quantities', () => {
  assert.deepEqual(M.varLen(0), [0]);
  assert.deepEqual(M.varLen(127), [127]);
  assert.deepEqual(M.varLen(128), [129, 0]);
  assert.deepEqual(M.varLen(480), [131, 96]);
});
