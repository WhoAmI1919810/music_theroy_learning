/* pitch.js — spelling-safe pitch-class utilities. UMD, no dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HarmonyPitch = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const mod = (n, m) => ((n % m) + m) % m;
  const pcOfLetter = (letter) => LETTER_PC[letter];
  const accidental = (alter) => alter > 0 ? '#'.repeat(alter) : (alter < 0 ? 'b'.repeat(-alter) : '');
  const prettyAccidental = (s) => String(s).replace(/#/g, '♯').replace(/b/g, '♭');

  function parseNote(name) {
    if (typeof name !== 'string') throw new Error('note name must be a string');
    const clean = name.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/𝄪/g, '##').replace(/𝄫/g, 'bb');
    const m = /^([A-Ga-g])([#b]*)$/.exec(clean);
    if (!m) throw new Error('bad note name: ' + name);
    const letter = m[1].toUpperCase();
    let alter = 0;
    for (const ch of m[2]) alter += ch === '#' ? 1 : -1;
    return { letter, alter, pc: mod(LETTER_PC[letter] + alter, 12), name: letter + accidental(alter) };
  }

  function noteName(letter, alter) {
    return letter + accidental(alter);
  }

  function pcOf(name) { return parseNote(name).pc; }

  function spellFromLetter(letter, targetPc) {
    let alter = mod(targetPc - LETTER_PC[letter], 12);
    if (alter > 6) alter -= 12;
    return { letter, alter, pc: mod(targetPc, 12), name: noteName(letter, alter) };
  }

  function spellInterval(rootName, semitones, letterSteps) {
    const r = parseNote(rootName);
    const letter = LETTERS[mod(LETTER_INDEX[r.letter] + letterSteps, 7)];
    return spellFromLetter(letter, mod(r.pc + semitones, 12));
  }

  function spellScale(tonicName, intervals) {
    const tonic = parseNote(tonicName);
    const start = LETTER_INDEX[tonic.letter];
    return intervals.map((semi, i) => {
      const letter = LETTERS[mod(start + i, 7)];
      return spellFromLetter(letter, mod(tonic.pc + semi, 12));
    });
  }

  function spellChord(rootName, intervals, letterSteps) {
    const steps = letterSteps || [0, 2, 4, 6, 8, 10, 12];
    return intervals.map((semi, i) => spellInterval(rootName, semi, steps[i] == null ? i * 2 : steps[i]));
  }

  function formatNote(name, unicode) {
    return unicode === false ? String(name) : prettyAccidental(name);
  }

  function uniquePcs(pcs) {
    return Array.from(new Set(pcs.map((x) => mod(Number(x), 12)))).sort((a, b) => a - b);
  }

  function pcSetKey(pcs) { return uniquePcs(pcs).join(','); }

  function intervalClass(a, b) {
    const d = Math.abs(mod(a, 12) - mod(b, 12));
    return Math.min(d, 12 - d);
  }

  function intervalName(semitones) {
    const names = { 0: '纯一度', 1: '小二度', 2: '大二度', 3: '小三度', 4: '大三度', 5: '纯四度', 6: '三全音', 7: '纯五度', 8: '小六度', 9: '大六度', 10: '小七度', 11: '大七度', 12: '纯八度' };
    return names[mod(semitones, 12)] || (semitones + ' 半音');
  }

  function transposeName(name, semitones, letterSteps) {
    const p = parseNote(name);
    if (letterSteps == null) {
      const target = mod(p.pc + semitones, 12);
      return enharmonicName(target, p.letter === 'B' || p.alter < 0);
    }
    return spellInterval(name, semitones, letterSteps).name;
  }

  function enharmonicName(pc, preferFlats) {
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    return (preferFlats ? flatNames : sharpNames)[mod(pc, 12)];
  }

  function midiOf(name, octave) {
    const p = parseNote(name);
    return 12 * (Number(octave) + 1) + p.pc;
  }

  function frequencyOfMidi(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function circleIndex(name) {
    const p = parseNote(name);
    return mod(p.pc * 7, 12);
  }

  function circleDistance(a, b) {
    const ia = circleIndex(a), ib = circleIndex(b);
    if (ia == null || ib == null) return null;
    const d = Math.abs(ia - ib);
    return Math.min(d, 12 - d);
  }

  return {
    LETTERS, LETTER_PC, LETTER_INDEX, mod, accidental, prettyAccidental,
    parseNote, noteName, pcOf, spellFromLetter, spellInterval, spellScale, spellChord,
    formatNote, uniquePcs, pcSetKey, intervalClass, intervalName, transposeName,
    enharmonicName, midiOf, frequencyOfMidi, circleIndex, circleDistance
  };
});
