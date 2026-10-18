const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'app', 'js');
const E = require(path.join(root, 'engine.js'));
const D = require(path.join(root, 'theory-data.js'));

function chord(catalog, roman) {
  return catalog.find((item) => item.roman === roman);
}

function voiced(item, midis) {
  return E.materializeVoicing(item, {
    midis,
    inversion:item.inversion || 0,
    bassPc:midis[0] % 12
  });
}

test('enumerates four voices with an exact soprano and forced inversion', () => {
  const I = E.makeChord({ rootName:'C', quality:'maj' });
  const voicings = E.listVoicings(I, { sopranoMidi:76, inversion:1 });
  assert.ok(voicings.length > 0);
  for (const voicing of voicings) {
    assert.equal(voicing.soprano, 76);
    assert.equal(voicing.bassPc, 4);
    assert.equal(voicing.inversion, 1);
    assert.ok(voicing.midis.every((midi, index) => index === 0 || midi > voicing.midis[index - 1]));
    assert.ok(voicing.midis.every((midi) => I.pcs.includes(midi % 12)));
    assert.ok(voicing.bass >= E.SATB_RANGES.bass[0] && voicing.bass <= E.SATB_RANGES.bass[1]);
    assert.ok(voicing.soprano >= E.SATB_RANGES.soprano[0] && voicing.soprano <= E.SATB_RANGES.soprano[1]);
  }
  assert.match(E.voicingFailureReason(I, { inversion:3 }), /第三转位/);
});

test('keeps an exact soprano chord tone when an extended chord must omit notes', () => {
  const G9 = E.makeChord({ rootName:'G', quality:'dom9' });
  const voicings = E.listVoicings(G9, { sopranoMidi:74, inversion:0 });
  assert.ok(voicings.length > 0);
  for (const voicing of voicings) {
    assert.equal(voicing.soprano, 74);
    assert.ok(voicing.midis.some((midi) => midi % 12 === 2));
  }
});

test('detects parallel fifths and octaves from actual voice pairs', () => {
  const C = E.makeChord({ rootName:'C', quality:'maj' });
  const Dm = E.makeChord({ rootName:'D', quality:'min' });
  const from = voiced(C, [48, 55, 60, 67]);
  const to = voiced(Dm, [50, 57, 62, 69]);
  const report = E.analyzeVoiceLeading(from, to);
  assert.ok(report.parallels.some((item) => item.type === '平行五度'));
  assert.ok(report.parallels.some((item) => item.type === '平行八度'));
  assert.ok(report.issues.some((issue) => issue.includes('平行五度')));
  assert.ok(report.issues.some((issue) => issue.includes('平行八度')));
});

test('detects parallel unison and reports all four voice motions', () => {
  const C = E.makeChord({ rootName:'C', quality:'maj' });
  const Dm = E.makeChord({ rootName:'D', quality:'min' });
  const from = voiced(C, [48, 55, 60, 60]);
  const to = voiced(Dm, [50, 57, 62, 62]);
  const report = E.analyzeVoiceLeading(from, to);
  assert.ok(report.parallels.some((item) => item.type === '平行同度'));
  assert.deepEqual(report.voices.map((voice) => voice.semitones), [2, 2, 2, 2]);
});

test('accepts a clean V7 to I resolution without false positives', () => {
  const catalog = E.buildCatalog('C', 'major', {});
  const V7 = chord(catalog, 'V7');
  const I = chord(catalog, 'I');
  const report = E.analyzeVoiceLeading(voiced(V7, [55, 59, 65, 74]), voiced(I, [48, 60, 64, 72]));
  assert.deepEqual(report.parallels, []);
  assert.deepEqual(report.hidden, []);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.tendency, []);
  assert.equal(report.totalMotion, 11);
  assert.deepEqual(report.voices.map((voice) => voice.semitones), [-7, 1, -1, -2]);
});

test('returns SATB voicings and transition checks in recommendations', () => {
  const opts = { sopranoMidi:72, inversion:1, limit:40 };
  const first = E.nextCandidates([], 'C', 'major', opts);
  assert.ok(first.length > 0);
  assert.ok(first.every((item) => item.voicing && item.voicing.soprano === 72 && item.voicing.inversion === 1));
  const initial = E.materializeVoicing(first[0].chord, first[0].voicing);
  const second = E.nextCandidates([initial], 'C', 'major', opts);
  assert.ok(second.length > 0);
  assert.ok(second.every((item) => item.voicing && item.voicing.soprano === 72 && item.voicing.inversion === 1));
  assert.ok(second.every((item) => item.voiceLeading && item.voiceLeading.voices.length === 4));
  assert.ok(second.every((item) => item.voiceLeading.totalMotion >= 0));
});

test('produces legal four-voice options for every catalog chord and inversion', () => {
  for (const mode of D.MODES) {
    const catalog = E.buildCatalog('C', mode.id, {
      sevenths:true, secondary:true, borrowed:true, chromatic:true
    });
    for (const item of catalog) {
      const maxInversion = Math.min(3, item.pcs.length - 1);
      for (let inversion = 0; inversion <= maxInversion; inversion++) {
        const options = E.listVoicings(item, { inversion });
        assert.ok(options.length > 0, mode.id + ' ' + item.roman + ' inversion ' + inversion);
        for (const voicing of options) {
          assert.ok(voicing.midis.every((midi) => item.pcs.includes(midi % 12)));
          assert.equal(voicing.bassPc, E.chordToneEntries(item)[inversion].pc);
        }
      }
    }
  }
});
