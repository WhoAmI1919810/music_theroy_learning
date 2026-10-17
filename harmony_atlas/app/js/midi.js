/* midi.js - Standard MIDI File export for Harmony Atlas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./audio.js'));
  else root.HarmonyMidi = factory(root.HarmonyAudio);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (A) {
  'use strict';

  function pushAscii(target, text) {
    for (let i = 0; i < text.length; i++) target.push(text.charCodeAt(i) & 0xFF);
  }

  function pushU32(target, value) {
    target.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  }

  function pushU16(target, value) {
    target.push((value >>> 8) & 255, value & 255);
  }

  function varLen(value) {
    let buffer = value & 0x7F;
    const out = [];
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
      out.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return out;
  }

  function buildMidi(chords, options) {
    options = options || {};
    const division = options.division || 480;
    const beatsPerChord = options.beatsPerChord || 4;
    const events = [];
    events.push({ tick: 0, priority: 0, bytes: [0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20] });
    (chords || []).forEach((chord, i) => {
      const start = i * beatsPerChord * division;
      const end = (i + 1) * beatsPerChord * division;
      const notes = A.chordVoicing(chord, options.base == null ? 48 : options.base);
      notes.forEach((midi) => {
        events.push({ tick: start, priority: 1, bytes: [0x90, midi & 0x7F, 82] });
        events.push({ tick: Math.max(start + 1, end - 12), priority: 0, bytes: [0x80, midi & 0x7F, 64] });
      });
    });
    const finalTick = Math.max(1, (chords || []).length * beatsPerChord * division);
    events.push({ tick: finalTick, priority: 2, bytes: [0xFF, 0x2F, 0x00] });
    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    const track = [];
    let lastTick = 0;
    events.forEach((event) => {
      track.push.apply(track, varLen(event.tick - lastTick));
      track.push.apply(track, event.bytes);
      lastTick = event.tick;
    });
    const bytes = [];
    pushAscii(bytes, 'MThd');
    pushU32(bytes, 6);
    pushU16(bytes, 0);
    pushU16(bytes, 1);
    pushU16(bytes, division);
    pushAscii(bytes, 'MTrk');
    pushU32(bytes, track.length);
    bytes.push.apply(bytes, track);
    return new Uint8Array(bytes);
  }

  return { buildMidi, varLen };
});
