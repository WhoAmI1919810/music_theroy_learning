const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app', 'js');
const E = require(path.join(root, 'engine.js'));

function byRoman(catalog, roman) {
  return catalog.find((chord) => chord.roman === roman);
}

test('builds a stable C-major catalog without duplicate keys', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  assert.equal(catalog.length, 55);
  assert.equal(new Set(catalog.map((chord) => chord.key)).size, catalog.length);
  for (const chord of catalog) {
    assert.ok(chord.pcs.length >= 3);
    assert.equal(new Set(chord.pcs).size, chord.pcs.length);
    assert.ok(chord.pcs.includes(chord.rootPc));
    assert.ok(chord.noteNames.length >= 3);
  }
  assert.equal(catalog.filter((chord) => chord.category === 'diatonic').length, 14);
  assert.equal(catalog.filter((chord) => chord.category === 'secondary').length, 19);
});

test('spells secondary dominants and their targets', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  assert.deepEqual(byRoman(catalog, 'V/ii').noteNames, ['A', 'C#', 'E']);
  assert.deepEqual(byRoman(catalog, 'V7/V').noteNames, ['D', 'F#', 'A', 'C']);
  assert.equal(byRoman(catalog, 'V7/V').targetRoman, 'V');
  assert.equal(byRoman(catalog, 'V7/V').targetPc, 7);
  assert.ok(byRoman(catalog, 'V7/IV'));
  assert.equal(byRoman(catalog, 'V7/IV').noteNames[3], 'Bb');
});

test('spells modal mixture and Neapolitan chords', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  assert.deepEqual(byRoman(catalog, 'i').noteNames, ['C', 'Eb', 'G']);
  assert.deepEqual(byRoman(catalog, 'iv').noteNames, ['F', 'Ab', 'C']);
  assert.deepEqual(byRoman(catalog, '♭VI').noteNames, ['Ab', 'C', 'Eb']);
  const neapolitan = byRoman(catalog, '♭II6');
  assert.deepEqual(neapolitan.noteNames, ['Db', 'F', 'Ab']);
  assert.equal(neapolitan.inversion, 1);
  assert.equal(neapolitan.bassPc, 5);
});

test('spells the three augmented-sixth families', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  assert.deepEqual(byRoman(catalog, 'It+6').noteNames, ['Ab', 'C', 'F#']);
  assert.deepEqual(byRoman(catalog, 'Fr+6').noteNames, ['Ab', 'C', 'D', 'F#']);
  assert.deepEqual(byRoman(catalog, 'Ger+6').noteNames, ['Ab', 'C', 'Eb', 'F#']);
  assert.equal(byRoman(catalog, 'Ger+6').pcs.length, 4);
});

test('provides tritone substitution and chromatic mediants', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  assert.equal(byRoman(catalog, '♭II7').noteNames.join(' '), 'Db F Ab Cb');
  const mediants = E.chromaticMediants('C', 'major');
  assert.equal(mediants.length, 8);
  assert.deepEqual(mediants.map((chord) => chord.roman), ['♭III', '♭IIIm', '♭VI', '♭VIm', 'III', 'IIIm', 'VI', 'VIm']);
});

test('builds subset chords for non-heptatonic collections', () => {
  const wholeTone = E.buildCatalog('C', 'wholeTone', {});
  assert.ok(wholeTone.length > 0);
  assert.ok(wholeTone.every((chord) => chord.pcs.every((pc) => [0, 2, 4, 6, 8, 10].includes(pc))));
  assert.ok(wholeTone.some((chord) => chord.quality.id === 'aug'));
});
