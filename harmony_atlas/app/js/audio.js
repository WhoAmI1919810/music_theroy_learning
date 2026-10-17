/* audio.js - dependency-free Web Audio playback for Harmony Atlas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.HarmonyAudio = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  let ctx = null;
  let master = null;
  let active = [];
  let timers = [];

  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('当前浏览器不支持 Web Audio');
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.72;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function stopAll() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
    active.forEach((node) => {
      try { node.stop(); } catch (e) { /* already stopped */ }
      try { node.disconnect(); } catch (e) { /* already disconnected */ }
    });
    active = [];
  }

  function midiFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function scheduleTone(midi, when, duration, gainValue, waveform) {
    const c = ensure();
    const start = Math.max(c.currentTime, when);
    const end = start + duration;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, start);
    out.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    out.gain.setValueAtTime(gainValue, Math.max(start + 0.013, end - 0.18));
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    out.connect(master);

    const osc = c.createOscillator();
    osc.type = waveform || 'triangle';
    osc.frequency.setValueAtTime(midiFrequency(midi), start);
    osc.detune.setValueAtTime((midi % 3 - 1) * 1.7, start);
    osc.connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
    active.push(osc);

    const shimmer = c.createOscillator();
    const shimmerGain = c.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(midiFrequency(midi) * 2.002, start);
    shimmerGain.gain.setValueAtTime(gainValue * 0.16, start);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(out);
    shimmer.start(start);
    shimmer.stop(end + 0.02);
    active.push(shimmer);
  }

  function playMidi(midi, duration, opts) {
    opts = opts || {};
    ensure();
    stopAll();
    scheduleTone(midi, ctx.currentTime + 0.015, duration || 0.75, opts.gain || 0.12, opts.waveform);
  }

  function playMidis(midis, opts) {
    opts = opts || {};
    ensure();
    if (opts.replace !== false) stopAll();
    const when = ctx.currentTime + (opts.delay || 0.02);
    const duration = opts.duration || 1.25;
    (midis || []).forEach((midi) => scheduleTone(midi, when, duration, opts.gain || 0.065, opts.waveform));
  }

  function nearestMidi(pc, floor) {
    let midi = floor + ((pc - floor) % 12 + 12) % 12;
    if (midi < floor) midi += 12;
    return midi;
  }

  function chordVoicing(chord, base) {
    base = base == null ? 48 : base;
    if (!chord || !chord.pcs || !chord.pcs.length) return [];
    const rootPc = chord.rootPc == null ? chord.pcs[0] : chord.rootPc;
    const bassPc = chord.bassPc == null ? rootPc : chord.bassPc;
    const bass = nearestMidi(bassPc, base);
    const upper = chord.pcs.filter((pc) => pc !== bassPc).sort((a, b) => a - b).map((pc, i) => {
      return nearestMidi(pc, bass + 3 + i);
    });
    const result = [bass].concat(upper);
    while (result.length < 4) result.push(result[result.length - 1] + 12);
    return result.filter((v, i) => result.indexOf(v) === i).sort((a, b) => a - b);
  }

  function playChord(chord, opts) {
    opts = opts || {};
    const notes = chordVoicing(chord, opts.base == null ? 48 : opts.base);
    if (opts.roll) {
      ensure();
      stopAll();
      const when = ctx.currentTime + 0.02;
      notes.forEach((midi, i) => scheduleTone(midi, when + i * 0.055, opts.duration || 1.35, opts.gain || 0.065, opts.waveform));
      return notes;
    }
    playMidis(notes, { duration: opts.duration || 1.4, gain: opts.gain || 0.065, waveform: opts.waveform });
    return notes;
  }

  function playProgression(chords, opts) {
    opts = opts || {};
    ensure();
    stopAll();
    if (!chords || !chords.length) return 0;
    const beat = opts.beat || 0.72;
    const start = ctx.currentTime + 0.04;
    chords.forEach((chord, i) => {
      const when = start + i * beat;
      const notes = chordVoicing(chord, opts.base == null ? 48 : opts.base);
      notes.forEach((midi) => scheduleTone(midi, when, beat * 1.08, opts.gain || 0.058, opts.waveform));
      if (opts.onStep) {
        const timer = setTimeout(() => opts.onStep(i, chord), Math.max(0, (when - ctx.currentTime) * 1000));
        timers.push(timer);
      }
    });
    const done = setTimeout(() => {
      if (opts.onDone) opts.onDone();
    }, (chords.length * beat + 0.5) * 1000);
    timers.push(done);
    return chords.length * beat;
  }

  return {
    ensure, stopAll, playMidi, playMidis, playChord, playProgression,
    chordVoicing, midiFrequency
  };
});
