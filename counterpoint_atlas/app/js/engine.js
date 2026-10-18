(function (root) {
  "use strict";

  const DATA = typeof require === "function" ? require("../data/theory-data.js") : root.CP_THEORY;
  const { CF_PRESETS, SUBJECT_PRESETS, KEY_SIGNATURES } = DATA;

  const NOTE_PCS = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5,
    F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10,
    B: 11, Cb: 11, "B#": 0
  };
  const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);
  const PERFECT = new Set([0, 7]);
  const SUSPENSION_SEMITONES = new Set([2, 5, 10]);
  const SEMITONE_NAMES = ["同度/八度", "小二度", "大二度", "小三度", "大三度", "纯四度", "三全音", "纯五度", "小六度", "大六度", "小七度", "大七度"];

  function pitchClass(value) {
    return ((value % 12) + 12) % 12;
  }

  function midiToName(midi, preferFlats) {
    const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
    return names[pitchClass(midi)] + (Math.floor(midi / 12) - 1);
  }

  function noteToMidi(token) {
    if (typeof token === "number" && Number.isFinite(token)) return Math.round(token);
    const text = String(token || "").trim();
    if (/^-?\d+$/.test(text)) return Number(text);
    const match = text.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
    if (!match) return null;
    const name = match[1].toUpperCase() + match[2];
    const pc = NOTE_PCS[name];
    if (pc === undefined) return null;
    return (Number(match[3]) + 1) * 12 + pc;
  }

  function parseVoiceLine(line) {
    return line
      .split(/[\s,|]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => {
        if (/^(?:-|\.|R|rest|休止)$/i.test(token)) return null;
        return noteToMidi(token);
      });
  }

  function parseVoices(input) {
    if (Array.isArray(input)) {
      return input.map((voice, index) => ({
        name: voice.name || "V" + (index + 1),
        notes: voice.notes.map((note) => (typeof note === "number" ? note : noteToMidi(note)))
      }));
    }
    const lines = String(input || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    return lines.map((line, index) => {
      const labelMatch = line.match(/^([^:：]{1,18})[:：]\s*(.+)$/);
      return {
        name: labelMatch ? labelMatch[1].trim() : "V" + (index + 1),
        notes: parseVoiceLine(labelMatch ? labelMatch[2] : line)
      };
    });
  }

  function padVoices(voices) {
    const length = Math.max(0, ...voices.map((voice) => voice.notes.length));
    return voices.map((voice) => ({
      name: voice.name,
      notes: Array.from({ length }, (_, index) => (index < voice.notes.length ? voice.notes[index] : null))
    }));
  }

  function intervalInfo(lower, upper) {
    const distance = Math.abs(upper - lower);
    const simple = distance % 12;
    return {
      distance,
      simple,
      name: SEMITONE_NAMES[simple],
      compound: distance > 11,
      consonant: CONSONANT.has(simple),
      perfect: PERFECT.has(simple),
      unison: distance === 0
    };
  }

  function direction(a, b) {
    if (a === null || b === null) return 0;
    if (b > a) return 1;
    if (b < a) return -1;
    return 0;
  }

  function motionName(prevA, currA, prevB, currB) {
    const da = direction(prevA, currA);
    const db = direction(prevB, currB);
    if (da === 0 && db === 0) return "静止";
    if (da === 0 || db === 0) return "斜向";
    if (da === db) return "同向";
    return "反向";
  }

  function positionLabel(index, beatsPerBar) {
    return "第 " + (Math.floor(index / beatsPerBar) + 1) + " 小节第 " + (index % beatsPerBar + 1) + " 拍";
  }

  function nextDifferentNote(voice, index) {
    const current = voice.notes[index];
    for (let cursor = index + 1; cursor < voice.notes.length; cursor += 1) {
      if (voice.notes[cursor] !== null && voice.notes[cursor] !== current) {
        return { index: cursor, midi: voice.notes[cursor] };
      }
    }
    return null;
  }

  function hasSuspensionResolution(voice, index, other, beatsPerBar) {
    if (index <= 0) return false;
    const previous = voice.notes[index - 1];
    const current = voice.notes[index];
    const next = nextDifferentNote(voice, index);
    if (current === null || previous === null || !next) return false;
    if (current !== previous) return false;
    const otherNext = other.notes[next.index];
    if (otherNext === null) return false;
    const downStep = current - next.midi;
    if (downStep !== 1 && downStep !== 2) return false;
    return intervalInfo(otherNext, next.midi).consonant;
  }

  function analyzeCounterpoint(input, options) {
    const settings = Object.assign({ beatsPerBar: 4, style: "strict" }, options || {});
    const voices = padVoices(parseVoices(input));
    const average = (voice) => {
      const values = voice.notes.filter((note) => note !== null);
      return values.length ? values.reduce((sum, note) => sum + note, 0) / values.length : -Infinity;
    };
    voices.sort((a, b) => average(b) - average(a));
    const issues = [];
    const length = voices.length ? voices[0].notes.length : 0;
    const push = (severity, type, message, index, voiceNames, detail) => {
      issues.push({
        id: type + "-" + index + "-" + issues.length,
        severity,
        type,
        message,
        position: index + 1,
        bar: Math.floor(index / settings.beatsPerBar) + 1,
        beat: (index % settings.beatsPerBar) + 1,
        label: positionLabel(index, settings.beatsPerBar),
        voices: voiceNames || [],
        detail: detail || ""
      });
    };

    if (voices.length < 2) {
      return {
        voices,
        issues: [{ id: "need-two-voices", severity: "error", type: "input", message: "至少输入两个声部。", label: "输入", voices: [] }],
        summary: { errors: 1, warnings: 0, status: "需修改" }
      };
    }
    for (let v = 0; v < voices.length; v += 1) {
      if (voices[v].notes.length !== length) {
        push("warning", "length", "声部长度不一致，已按最长声部用休止补齐。", length - 1, [voices[v].name]);
      }
    }

    for (let v = 0; v < voices.length; v += 1) {
      for (let i = 0; i < length; i += 1) {
        const midi = voices[v].notes[i];
        if (midi !== null && (midi < 36 || midi > 88)) {
          push("warning", "range", "音高超出本检查器使用的宽音域 C2–E6，请复核实际声部。", i, [voices[v].name], midiToName(midi));
        }
        if (i > 0 && i < length - 1 && midi !== null && voices[v].notes[i - 1] !== null && voices[v].notes[i + 1] !== null) {
          const leap = Math.abs(midi - voices[v].notes[i - 1]);
          const after = voices[v].notes[i + 1] - midi;
          if (leap >= 5 && after !== 0 && Math.sign(after) === Math.sign(midi - voices[v].notes[i - 1])) {
            push("warning", "leap", "大跳后仍同向进行；严格风格通常要求反向级进补偿。", i, [voices[v].name], "跳进 " + leap + " 半音");
          }
        }
      }
    }

    for (let a = 0; a < voices.length; a += 1) {
      for (let b = a + 1; b < voices.length; b += 1) {
        const upper = voices[a];
        const lower = voices[b];
        for (let i = 0; i < length; i += 1) {
          const high = upper.notes[i];
          const low = lower.notes[i];
          if (high === null || low === null) continue;
          const strong = i % settings.beatsPerBar === 0;
          const interval = intervalInfo(low, high);
          if (high < low) {
            push(settings.style === "strict" ? "error" : "warning", "crossing", "声部交叉：上声部低于下声部。", i, [upper.name, lower.name], "相差 " + Math.abs(high - low) + " 半音");
          } else if (high === low && i !== 0 && i !== length - 1) {
            push("warning", "unison", "中间出现同度；二声部中会削弱声部独立。", i, [upper.name, lower.name]);
          }

          if (!interval.consonant && settings.style === "strict") {
            const suspended = hasSuspensionResolution(upper, i, lower, settings.beatsPerBar) ||
              hasSuspensionResolution(lower, i, upper, settings.beatsPerBar);
            if (strong && !suspended) {
              push("error", "strong-dissonance", "强拍不协和，且没有检出合法的延留音预备与下行级进解决。", i, [upper.name, lower.name], interval.name);
            } else if (!strong) {
              const prevHigh = upper.notes[i - 1];
              const nextHigh = upper.notes[i + 1];
              const prevLow = lower.notes[i - 1];
              const nextLow = lower.notes[i + 1];
              const highStep = prevHigh !== null && nextHigh !== null && Math.abs(high - prevHigh) <= 2 && Math.abs(nextHigh - high) <= 2;
              const lowStep = prevLow !== null && nextLow !== null && Math.abs(low - prevLow) <= 2 && Math.abs(nextLow - low) <= 2;
              if (!highStep && !lowStep && !suspended) {
                push("warning", "weak-dissonance", "弱拍不协和，但未在任一声部检出级进经过或辅助运动。", i, [upper.name, lower.name], interval.name);
              }
            }
          }

          if (i + 1 < length) {
            const nextHigh = upper.notes[i + 1];
            const nextLow = lower.notes[i + 1];
            if (nextHigh !== null && nextLow !== null) {
              const nextInterval = intervalInfo(nextLow, nextHigh);
              const dh = direction(high, nextHigh);
              const dl = direction(low, nextLow);
              if (settings.style === "strict" && interval.perfect && nextInterval.perfect && dh !== 0 && dh === dl && interval.simple === nextInterval.simple) {
                const type = interval.simple === 7 ? "parallel-fifth" : "parallel-octave";
                push("error", type, "平行" + (interval.simple === 7 ? "五度" : "八度/同度") + "：相邻发声音程同向进入同类完全协和。", i, [upper.name, lower.name], interval.name + " → " + nextInterval.name);
              }
              if (i !== 0 && nextInterval.perfect && !interval.perfect && dh === dl && dh !== 0) {
                const movingUpper = Math.abs(nextHigh - high);
                if (a === 0 && b === voices.length - 1 && movingUpper > 2) {
                  push("warning", "hidden-perfect", "外声部同向跳进进入完全协和；严格风格通常要求上声部级进。", i + 1, [upper.name, lower.name], nextInterval.name);
                }
              }
            }
          }
        }
      }
    }

    const errors = issues.filter((item) => item.severity === "error").length;
    const warnings = issues.filter((item) => item.severity === "warning").length;
    const finalNotes = voices.map((voice) => voice.notes[length - 1]).filter((note) => note !== null);
    if (settings.style === "strict" && finalNotes.length >= 2) {
      const finalInterval = intervalInfo(Math.min(...finalNotes), Math.max(...finalNotes));
      if (!finalInterval.perfect) {
        push("warning", "cadence", "末拍没有落在完全协和；严格分类对位通常以同度、五度或八度收束。", length - 1, voices.map((voice) => voice.name));
      }
    }

    return {
      voices,
      issues,
      summary: {
        errors,
        warnings,
        status: errors ? "需修改" : warnings ? "可接受，需复核提示" : "通过"
      }
    };
  }

  function scalePitchClasses(preset) {
    return preset.scale || KEY_SIGNATURES[preset.key || "C"][preset.mode || "major"];
  }

  function isScaleMidi(midi, pcs) {
    return pcs.includes(pitchClass(midi));
  }

  function upperCandidates(bass, scale, lowOffset, highOffset) {
    const candidates = [];
    const first = bass + (lowOffset || 3);
    const last = Math.min(88, bass + (highOffset || 19));
    for (let midi = first; midi <= last; midi += 1) {
      if (!isScaleMidi(midi, scale)) continue;
      const info = intervalInfo(bass, midi);
      if (info.consonant) candidates.push(midi);
    }
    return Array.from(new Set(candidates));
  }

  function parallelPerfect(prevBass, prevUpper, bass, upper) {
    const before = intervalInfo(prevBass, prevUpper);
    const after = intervalInfo(bass, upper);
    const db = direction(prevBass, bass);
    const du = direction(prevUpper, upper);
    return before.perfect && after.perfect && before.simple === after.simple && db !== 0 && db === du;
  }

  function candidateCost(interval, delta, index, lastIndex, midi, bass) {
    const simple = interval.simple;
    let cost = 0;
    if (!interval.perfect) cost += 0;
    else if (simple === 7) cost += 1.2;
    else cost += index === 0 || index === lastIndex ? 0 : 2.2;
    if (![0, 3, 4, 8, 9].includes(simple)) cost += 0.6;
    cost += Math.abs(delta) * 0.16;
    if (Math.abs(delta) > 5) cost += 1.2;
    if (Math.abs(delta) > 9) cost += 2.2;
    if (Math.abs(delta) === 0) cost += 0.8;
    if (midi > bass + 22) cost += 0.8;
    return cost;
  }

  function solveStrongLine(cfNotes, scale) {
    const n = cfNotes.length;
    const candidateSets = cfNotes.map((bass, index) => {
      let list = upperCandidates(bass, scale);
      if (index === 0 || index === n - 1) {
        const octaves = list.filter((midi) => pitchClass(midi) === pitchClass(bass));
        if (octaves.length) list = octaves;
      }
      if (!list.length) list = [bass + 12];
      return list;
    });
    const dp = Array.from({ length: n }, () => new Map());
    const back = Array.from({ length: n }, () => new Map());
    candidateSets[0].forEach((midi) => {
      const interval = intervalInfo(cfNotes[0], midi);
      dp[0].set(midi, candidateCost(interval, 0, 0, n - 1, midi, cfNotes[0]));
    });
    for (let i = 1; i < n; i += 1) {
      for (const midi of candidateSets[i]) {
        let best = Infinity;
        let bestPrev = null;
        for (const [prevMidi, prevCost] of dp[i - 1]) {
          if (parallelPerfect(cfNotes[i - 1], prevMidi, cfNotes[i], midi)) continue;
          const cost = prevCost + candidateCost(intervalInfo(cfNotes[i], midi), midi - prevMidi, i, n - 1, midi, cfNotes[i]);
          if (cost < best) {
            best = cost;
            bestPrev = prevMidi;
          }
        }
        if (bestPrev !== null) {
          dp[i].set(midi, best);
          back[i].set(midi, bestPrev);
        }
      }
    }
    let finalMidi = null;
    let finalCost = Infinity;
    for (const [midi, cost] of dp[n - 1]) {
      if (cost < finalCost) {
        finalCost = cost;
        finalMidi = midi;
      }
    }
    if (finalMidi === null) {
      finalMidi = candidateSets[n - 1][0];
    }
    const line = new Array(n);
    line[n - 1] = finalMidi;
    for (let i = n - 1; i > 0; i -= 1) line[i - 1] = back[i].get(line[i]) || cfNotes[i - 1] + 12;
    return line;
  }

  function scaleNeighbors(midi, scale) {
    const below = [];
    const above = [];
    for (let offset = 1; offset <= 4; offset += 1) {
      if (isScaleMidi(midi - offset, scale)) below.push(midi - offset);
      if (isScaleMidi(midi + offset, scale)) above.push(midi + offset);
    }
    return { below, above };
  }

  function stepToward(current, target, scale) {
    if (target > current) {
      const neighbors = scaleNeighbors(current, scale).above;
      return neighbors[0] || current + 1;
    }
    if (target < current) {
      const neighbors = scaleNeighbors(current, scale).below;
      return neighbors[0] || current - 1;
    }
    return current;
  }

  function interpolateTo(current, target, count, scale) {
    const output = [];
    let note = current;
    for (let index = 0; index < count; index += 1) {
      note = stepToward(note, target, scale);
      output.push(note);
    }
    return output;
  }

  function fillBeatGrid(events, totalBeats) {
    const grid = Array(totalBeats).fill(null);
    const marker = Array(totalBeats).fill("");
    for (const event of events) {
      for (let offset = 0; offset < event.duration; offset += 1) {
        const index = event.start + offset;
        if (index >= totalBeats) break;
        grid[index] = event.midi;
        marker[index] = offset === 0 ? midiToName(event.midi) : "·";
      }
    }
    return { grid, marker };
  }

  function generateSpecies(presetOrNotes, speciesId) {
    const preset = typeof presetOrNotes === "string"
      ? CF_PRESETS.find((item) => item.id === presetOrNotes) || CF_PRESETS[0]
      : presetOrNotes || CF_PRESETS[0];
    const cfMidis = preset.notes.map(noteToMidi);
    const scale = scalePitchClasses(preset);
    const strong = solveStrongLine(cfMidis, scale);
    const n = cfMidis.length;
    const cfEvents = cfMidis.map((midi, index) => ({ voice: "CF", start: index * 4, duration: 4, midi }));
    const cpEvents = [];

    if (speciesId === "first") {
      strong.forEach((midi, index) => cpEvents.push({ voice: "CP", start: index * 4, duration: 4, midi }));
    } else if (speciesId === "second") {
      strong.forEach((midi, index) => {
        cpEvents.push({ voice: "CP", start: index * 4, duration: 2, midi });
        const target = index + 1 < n ? strong[index + 1] : midi;
        const weak = index === n - 1 ? midi : target === midi ? midi + 2 : stepToward(midi, target, scale);
        cpEvents.push({ voice: "CP", start: index * 4 + 2, duration: 2, midi: weak });
      });
    } else if (speciesId === "third" || speciesId === "fifth") {
      const patterns = speciesId === "third"
        ? [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
        : [[2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [2, 2], [1, 1, 1, 1], [2, 1, 1]];
      strong.forEach((midi, index) => {
        const pattern = patterns[index % patterns.length];
        let cursor = 0;
        let note = midi;
        const target = index + 1 < n ? strong[index + 1] : midi;
        pattern.forEach((duration, position) => {
          if (position > 0) {
            const remaining = pattern.length - position;
            const wanted = position === pattern.length - 1 ? target : stepToward(note, target, scale);
            note = remaining > 1 ? stepToward(note, wanted, scale) : wanted;
          }
          cpEvents.push({ voice: "CP", start: index * 4 + cursor, duration, midi: note });
          cursor += duration;
        });
      });
    } else if (speciesId === "fourth") {
      const candidateSets = cfMidis.map((bass) => upperCandidates(bass, scale).filter((midi) => midi > bass + 3));
      const dp = Array.from({ length: n }, () => new Map());
      const back = Array.from({ length: n }, () => new Map());
      candidateSets[0].forEach((midi) => dp[0].set(midi, 0));
      for (let i = 1; i < n; i += 1) {
        for (const midi of candidateSets[i]) {
          let best = Infinity;
          let bestPrev = null;
          for (const [prevMidi, prevCost] of dp[i - 1]) {
            if (prevMidi >= cfMidis[i]) {
              const suspended = intervalInfo(cfMidis[i], prevMidi);
              const resolutionStep = prevMidi - midi;
              const legalDissonance = suspended.consonant || (SUSPENSION_SEMITONES.has(suspended.simple) && (resolutionStep === 1 || resolutionStep === 2));
              if (!legalDissonance) continue;
            }
            const cost = prevCost + Math.abs(midi - prevMidi) * 0.18 + candidateCost(intervalInfo(cfMidis[i], midi), midi - prevMidi, i, n - 1, midi, cfMidis[i]);
            if (cost < best) {
              best = cost;
              bestPrev = prevMidi;
            }
          }
          if (bestPrev !== null) {
            dp[i].set(midi, best);
            back[i].set(midi, bestPrev);
          }
        }
      }
      const lastIndex = Math.max(0, n - 2);
      let last = null;
      let lastCost = Infinity;
      for (const [midi, cost] of dp[lastIndex]) {
        if (cost < lastCost) { lastCost = cost; last = midi; }
      }
      const sync = new Array(n);
      sync[lastIndex] = last || strong[lastIndex];
      for (let i = lastIndex; i > 0; i -= 1) sync[i - 1] = back[i].get(sync[i]) || strong[i - 1];
      sync[n - 1] = strong[n - 1];
      sync.forEach((midi, index) => {
        if (index === n - 1) {
          cpEvents.push({ voice: "CP", start: index * 4, duration: 4, midi });
          return;
        }
        cpEvents.push({ voice: "CP", start: index * 4, duration: 2, midi: index === 0 ? strong[0] : sync[index - 1] });
        cpEvents.push({ voice: "CP", start: index * 4 + 2, duration: 2, midi });
      });
    }

    const totalBeats = n * 4;
    const cfGrid = fillBeatGrid(cfEvents, totalBeats);
    const cpGrid = fillBeatGrid(cpEvents, totalBeats);
    const diagnostics = analyzeCounterpoint([
      { name: "CF", notes: cfGrid.grid },
      { name: "CP", notes: cpGrid.grid }
    ], { beatsPerBar: 4, style: "strict" });

    return {
      preset,
      speciesId,
      cfEvents,
      cpEvents,
      marker: { cf: cfGrid.marker, cp: cpGrid.marker },
      totalBeats,
      diagnostics
    };
  }

  function transformSubject(notes, transform) {
    const midis = notes.map(noteToMidi);
    if (transform === "retrograde") return midis.slice().reverse();
    if (transform === "inversion") {
      const axis = midis[0];
      return midis.map((midi) => axis * 2 - midi);
    }
    if (transform === "retrograde-inversion") {
      const axis = midis[0];
      return midis.slice().reverse().map((midi) => axis * 2 - midi);
    }
    return midis.slice();
  }

  function generateCanon(subjectNotes, options) {
    const settings = Object.assign({
      delay: 4,
      interval: 12,
      transform: "none",
      duration: 1,
      voices: 2,
      cycles: 1,
      entryMode: "cumulative"
    }, options || {});
    const subject = (Array.isArray(subjectNotes) ? subjectNotes : String(subjectNotes).split(/\s+/)).map(noteToMidi).filter((midi) => midi !== null);
    const transformed = transformSubject(subject, settings.transform);
    const voiceCount = Math.max(2, Math.min(6, Math.round(Number(settings.voices) || 2)));
    const cycles = Math.max(1, Math.min(4, Math.round(Number(settings.cycles) || 1)));
    const baseDuration = Math.max(1, Math.round(Number(settings.duration) || 1));
    const voiceDuration = settings.transform === "augmentation" ? baseDuration * 2 : baseDuration;
    const voiceIds = ["dux", "comes", "voice3", "voice4", "voice5", "voice6"];
    const voiceNames = ["V1 主句", "V2 应句", "V3 应句", "V4 应句", "V5 应句", "V6 应句"];
    const entries = [];
    const events = [];
    const rows = [];
    const marker = {};

    function transpositionForVoice(index) {
      if (index === 0) return 0;
      if (settings.entryMode === "alternating") return index % 2 === 0 ? 0 : settings.interval;
      if (settings.entryMode === "octaves") return index * 12;
      return index * settings.interval;
    }

    function fitCanonPitch(midi) {
      let output = midi;
      while (output < 43) output += 12;
      while (output > 88) output -= 12;
      return output;
    }

    for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
      const voiceEvents = [];
      const transposition = transpositionForVoice(voiceIndex);
      const voiceSequence = voiceIndex === 0 ? subject : transformed;
      const voiceStep = voiceIndex === 0 ? baseDuration : voiceDuration;
      const voiceCycleBeats = voiceSequence.length * voiceStep;
      for (let round = 0; round < cycles; round += 1) {
        const roundStart = round * voiceCycleBeats + voiceIndex * settings.delay;
        voiceSequence.forEach((midi, noteIndex) => {
          voiceEvents.push({
            voice: voiceIds[voiceIndex],
            voiceName: voiceNames[voiceIndex],
            round: round + 1,
            start: roundStart + noteIndex * voiceStep,
            duration: voiceStep,
            midi: fitCanonPitch(midi + transposition)
          });
        });
        entries.push({
          voiceId: voiceIds[voiceIndex],
          voiceName: voiceNames[voiceIndex],
          role: voiceIndex === 0 ? "主句" : "应句",
          round: round + 1,
          start: roundStart,
          startBar: Math.floor(roundStart / 4) + 1,
          startBeat: roundStart % 4 + 1,
          transposition,
          transform: voiceIndex === 0 ? "none" : settings.transform,
          cycles: cycles,
          noteCount: voiceSequence.length
        });
      }
      events.push(...voiceEvents);
    }

    const rawTotalBeats = events.length ? Math.max(...events.map((event) => event.start + event.duration)) : 0;
    const totalBeats = Math.max(4, Math.ceil(rawTotalBeats / 4) * 4);
    const analyzedVoices = [];
    for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
      const voiceEvents = events.filter((event) => event.voice === voiceIds[voiceIndex]);
      const grid = fillBeatGrid(voiceEvents, totalBeats);
      marker[voiceIds[voiceIndex]] = grid.marker;
      analyzedVoices.push({ name: voiceNames[voiceIndex], notes: grid.grid });
      const midis = voiceEvents.map((event) => event.midi);
      rows.push({
        id: voiceIds[voiceIndex],
        name: voiceNames[voiceIndex],
        marker: grid.marker,
        noteCount: midis.length,
        range: midis.length ? midiToName(Math.min(...midis)) + "–" + midiToName(Math.max(...midis)) : "—"
      });
    }
    const diagnostics = subject.length ? analyzeCounterpoint(analyzedVoices, { beatsPerBar: 4, style: "free" }) : {
      voices: [],
      issues: [{ id: "empty-canon", severity: "error", type: "input", message: "主句为空。", label: "输入", voices: [] }],
      summary: { errors: 1, warnings: 0, status: "需修改" }
    };
    if (settings.transform === "augmentation") {
      diagnostics.issues.unshift({
        id: "augmentation-check", severity: "warning", type: "augmentation", message: "扩大卡农改变了强拍位置；原弱拍不协和可能移到强拍，必须重新逐拍检查。", label: "扩大", voices: []
      });
    }
    if (Math.abs(settings.interval) % 12 !== 0) {
      diagnostics.issues.unshift({
        id: "diatonic-check", severity: "warning", type: "diatonic", message: "当前为半音精确移位。若要保持调性，需在应句中调整个别音；调性卡农不能只靠整体平移。", label: "调性", voices: []
      });
    }
    if (settings.delay < voiceDuration * 2) {
      diagnostics.issues.unshift({
        id: "dense-entry", severity: "warning", type: "density", message: "相邻声部只隔 " + settings.delay + " 拍进入，叠置很密；逐次进入处要检查二度碰撞、声部交叉与可听辨性。", label: "进入密度", voices: []
      });
    }
    if (voiceCount >= 4) {
      diagnostics.issues.unshift({
        id: "many-voices", severity: "info", type: "voices", message: voiceCount + " 个声部同时复制主题时，音区分配比横向模仿更容易出问题；先保证每对相邻声部可分辨。", label: "多声部", voices: []
      });
    }
    if (cycles > 1) {
      diagnostics.issues.unshift({
        id: "cycle-seam", severity: "info", type: "cycle", message: "每个声部连续重复 " + cycles + " 轮；轮次接缝处也是模仿点，不能只检查第一轮。", label: "多轮", voices: []
      });
    }
    const errors = diagnostics.issues.filter((item) => item.severity === "error").length;
    const warnings = diagnostics.issues.filter((item) => item.severity === "warning").length;
    diagnostics.summary = {
      errors,
      warnings,
      status: errors ? "需修改" : warnings ? "可接受，需复核提示" : "通过"
    };
    if (voiceCount === 2) {
      marker.dux = marker.dux || [];
      marker.comes = marker.comes || [];
    }
    return {
      subject,
      transformed,
      events,
      entries,
      rows,
      totalBeats,
      marker,
      diagnostics,
      settings: Object.assign({}, settings, { voices: voiceCount, cycles: cycles })
    };
  }

  function scaleForPlan(key, mode) {
    const entry = KEY_SIGNATURES[key] || KEY_SIGNATURES.C;
    const pcs = entry[mode] || entry.major;
    const tonic = entry.tonic;
    const base = 60 + tonic;
    const output = [];
    for (let octave = 0; octave < 4; octave += 1) {
      for (const pc of pcs) {
        output.push(base + pitchClass(pc - tonic) + octave * 12);
      }
    }
    output.sort((a, b) => a - b);
    return { pcs, tonic, base, notes: output.filter((midi) => midi >= 48 && midi <= 96) };
  }

  function subjectDegrees(type) {
    if (type === "leaping") return [0, 4, 2, 5, 4, 1, 2, 0];
    if (type === "compact") return [0, 2, 3, 4, 5, 4, 0];
    if (type === "chromatic") return [0, 1, 2, 3, 4, 6, 5, 0];
    return [0, 1, 2, 4, 5, 4, 2, 1, 0];
  }

  function makeSubject(key, mode, type) {
    const scale = scaleForPlan(key, mode);
    const degrees = subjectDegrees(type);
    const notes = degrees.map((degree) => scale.notes[degree] || scale.base);
    return notes;
  }

  function degreeOfMidi(midi, scale) {
    const pc = pitchClass(midi);
    return scale.pcs.indexOf(pc);
  }

  function makeAnswer(subjectMidis, key, mode, answerType) {
    const scale = scaleForPlan(key, mode);
    if (answerType === "real") {
      return subjectMidis.map((midi) => midi + 7);
    }
    let dominantAdjusted = false;
    return subjectMidis.map((midi, index) => {
      const degree = degreeOfMidi(midi, scale);
      if (degree < 0) return midi + 7;
      let targetDegree = (degree + 4) % 7;
      if (!dominantAdjusted && degree === 4) {
        targetDegree = 0;
        dominantAdjusted = true;
      }
      const targetPc = scale.pcs[targetDegree];
      const desired = midi + (targetDegree === 0 && degree === 4 ? 5 : 7);
      let candidates = [];
      for (let candidate = desired - 12; candidate <= desired + 12; candidate += 1) {
        if (pitchClass(candidate) === targetPc) candidates.push(candidate);
      }
      return candidates.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))[0] || desired;
    });
  }

  const VOICE_LABELS = ["S", "A", "T", "B", "V5"];
  const VOICE_RANGES = {
    S: [60, 86], A: [55, 81], T: [48, 74], B: [40, 67], V5: [36, 62]
  };
  const SHARP_KEY_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const FLAT_KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

  function voiceLabelsForCount(count) {
    if (count === 2) return ["S", "A"];
    if (count === 3) return ["S", "A", "B"];
    return VOICE_LABELS.slice(0, count);
  }

  function parseSubjectText(input) {
    const text = Array.isArray(input) ? input.join(" ") : String(input == null ? "" : input);
    const tokens = text.split(/[\s,|]+/).map((token) => token.trim()).filter(Boolean);
    const events = [];
    const invalid = [];
    let cursor = 0;
    for (const token of tokens) {
      const parts = token.split(":");
      const notePart = parts[0];
      let duration = parts.length > 1 ? Number(parts[1]) : 1;
      if (!Number.isInteger(duration) || duration < 1 || duration > 16) {
        invalid.push(token);
        duration = 1;
      }
      if (/^(?:-|\.|R|rest|休止)$/i.test(notePart)) {
        cursor += duration;
        continue;
      }
      const midi = noteToMidi(notePart);
      if (midi === null) {
        invalid.push(token);
        cursor += duration;
        continue;
      }
      events.push({ midi, start: cursor, duration });
      cursor += duration;
    }
    return { events, totalBeats: cursor, invalid };
  }

  function barNumber(beat) {
    return Math.floor(Math.max(0, beat) / 4) + 1;
  }

  function alignToBar(beat) {
    return Math.ceil(Math.max(0, beat) / 4) * 4;
  }

  function eventsSpan(events) {
    return events.length ? Math.max(...events.map((event) => event.start + event.duration)) : 0;
  }

  function shiftEvents(events, semitones) {
    return events.map((event) => Object.assign({}, event, { midi: event.midi + semitones }));
  }

  function fitEventsToRange(events, voice) {
    const range = VOICE_RANGES[voice] || [48, 84];
    if (!events.length) return [];
    const min = Math.min(...events.map((event) => event.midi));
    const max = Math.max(...events.map((event) => event.midi));
    const octaveShift = Math.round(((range[0] + range[1]) / 2 - (min + max) / 2) / 12);
    return events.map((event) => {
      let midi = event.midi + octaveShift * 12;
      while (midi < range[0]) midi += 12;
      while (midi > range[1]) midi -= 12;
      return Object.assign({}, event, { midi });
    });
  }

  function shortestPitchShift(fromPc, toPc) {
    let shift = pitchClass(toPc - fromPc);
    if (shift > 6) shift -= 12;
    return shift;
  }

  function invertEventsInKey(events, key, mode) {
    if (!events.length) return { events: [], diatonic: true, outside: [] };
    const keyData = KEY_SIGNATURES[key] || KEY_SIGNATURES.C;
    const pcs = keyData[mode] || keyData.major;
    const scaleMidis = [];
    for (let midi = 24; midi <= 108; midi += 1) {
      if (pcs.includes(pitchClass(midi))) scaleMidis.push(midi);
    }
    const indexes = events.map((event) => scaleMidis.indexOf(event.midi));
    const outside = events.filter((event, index) => indexes[index] < 0).map((event) => midiToName(event.midi));
    if (outside.length) {
      const inverted = transformSubject(events.map((event) => event.midi), "inversion");
      return {
        events: events.map((event, index) => Object.assign({}, event, { midi: inverted[index] })),
        diatonic: false,
        outside
      };
    }
    const axis = indexes[0];
    return {
      events: events.map((event, index) => Object.assign({}, event, {
        midi: scaleMidis[Math.max(0, Math.min(scaleMidis.length - 1, axis * 2 - indexes[index]))]
      })),
      diatonic: true,
      outside: []
    };
  }

  function keyName(pc, mode, preferFlats) {
    const names = preferFlats ? FLAT_KEY_NAMES : SHARP_KEY_NAMES;
    return names[pitchClass(pc)] + " " + (mode === "major" ? "大调" : "小调");
  }

  function makeSectionPlan(id, label, type, startBeat, endBeat, fields) {
    const safeStart = Math.max(0, startBeat);
    const safeEnd = Math.max(safeStart + 1, endBeat);
    return Object.assign({
      id,
      label,
      type,
      startBeat: safeStart,
      endBeat: safeEnd,
      startBar: barNumber(safeStart),
      endBar: barNumber(safeEnd - 1),
      bars: barNumber(safeEnd - 1) - barNumber(safeStart) + 1
    }, fields || {});
  }

  function makeFugueEntry(options) {
    const voice = options.voice;
    const placed = fitEventsToRange(options.events, voice);
    const span = eventsSpan(placed);
    const events = placed.map((event) => Object.assign({}, event, {
      voice,
      start: options.startBeat + event.start
    }));
    const midis = events.map((event) => event.midi);
    return {
      id: options.id,
      sectionId: options.sectionId,
      section: options.section,
      voice,
      form: options.form,
      key: options.key,
      keyMode: options.keyMode || "major",
      startBeat: options.startBeat,
      endBeat: options.startBeat + span,
      bar: barNumber(options.startBeat),
      startBar: barNumber(options.startBeat),
      endBar: barNumber(options.startBeat + Math.max(0, span - 1)),
      beats: span,
      notes: midis,
      events,
      range: midis.length ? midiToName(Math.min(...midis)) + "–" + midiToName(Math.max(...midis)) : "—",
      overlap: Boolean(options.overlap),
      strettoGap: options.strettoGap || 0,
      role: options.role || ""
    };
  }

  function makeCounterSubject(subjectEvents, key, mode) {
    if (!subjectEvents.length) return null;
    const scale = scaleForPlan(key, mode);
    const line = solveStrongLine(subjectEvents.map((event) => event.midi), scale.pcs);
    const events = fitEventsToRange(subjectEvents.map((event, index) => Object.assign({}, event, { midi: line[index] })), "S");
    const pair = analyzeInvertiblePair(subjectEvents, events);
    return {
      events,
      names: events.map((event) => midiToName(event.midi)),
      range: events.length ? midiToName(Math.min(...events.map((event) => event.midi))) + "–" + midiToName(Math.max(...events.map((event) => event.midi))) : "—",
      invertibility: pair
    };
  }

  function analyzeInvertiblePair(baseEvents, counterEvents) {
    const baseByStart = new Map(baseEvents.map((event) => [event.start, event]));
    let total = 0;
    let directConsonant = 0;
    let invertedConsonant = 0;
    let passBoth = 0;
    for (const counter of counterEvents) {
      const base = baseByStart.get(counter.start);
      if (!base) continue;
      total += 1;
      const simple = intervalInfo(Math.min(base.midi, counter.midi), Math.max(base.midi, counter.midi)).simple;
      const inverted = (12 - simple) % 12;
      const directOk = CONSONANT.has(simple);
      const invertedOk = CONSONANT.has(inverted);
      if (directOk) directConsonant += 1;
      if (invertedOk) invertedConsonant += 1;
      if (directOk && invertedOk) passBoth += 1;
    }
    return {
      total,
      directConsonant,
      invertedConsonant,
      passBoth,
      passRate: total ? passBoth / total : 0
    };
  }

  function planFugue(input) {
    const settings = Object.assign({
      key: "C",
      mode: "major",
      voices: 3,
      answerType: "tonal",
      subjectType: "classic",
      layout: "standard",
      subjectText: "",
      entrySpacing: "auto",
      recapMode: "original"
    }, input || {});
    settings.voices = Math.max(2, Math.min(5, Math.round(Number(settings.voices) || 3)));
    const keyData = KEY_SIGNATURES[settings.key] || KEY_SIGNATURES.C;
    const scalePcs = keyData[settings.mode] || keyData.major;
    const baseTonic = keyData.tonic;
    const preferFlats = /b/.test(settings.key) || settings.key === "F";
    const hasCustomSubject = settings.subjectText != null && String(settings.subjectText).trim().length > 0;
    let parsed;
    if (hasCustomSubject) {
      parsed = parseSubjectText(settings.subjectText);
    } else {
      const generatedSubject = makeSubject(settings.key, settings.mode, settings.subjectType);
      parsed = {
        events: generatedSubject.map((midi, index) => ({ midi, start: index, duration: 1 })),
        totalBeats: generatedSubject.length,
        invalid: []
      };
    }
    if (!parsed.events.length) throw new Error("主题至少需要一个可识别的音名，例如 C4 或 C4:2。");

    const subjectEvents = parsed.events;
    const subject = subjectEvents.map((event) => event.midi);
    const subjectSpan = Math.max(parsed.totalBeats || 0, eventsSpan(subjectEvents));
    const answer = makeAnswer(subject, settings.key, settings.mode, settings.answerType);
    const answerEvents = subjectEvents.map((event, index) => Object.assign({}, event, { midi: answer[index] }));
    const answerRelation = analyzeAnswerRelation(subject, answer);
    const voiceOrder = voiceLabelsForCount(settings.voices);
    const spacingBars = settings.entrySpacing === "auto"
      ? Math.max(1, Math.ceil(subjectSpan / 4))
      : Math.max(1, Math.min(8, Math.round(Number(settings.entrySpacing) || 1)));
    const spacingBeats = spacingBars * 4;
    const relativeTonic = settings.mode === "major" ? (baseTonic + 9) % 12 : (baseTonic + 3) % 12;
    const relativeMode = settings.mode === "major" ? "minor" : "major";
    const subdominantTonic = (baseTonic + 5) % 12;
    const dominantTonic = (baseTonic + 7) % 12;
    const entries = [];
    const sections = [];
    const diagnostics = [];
    const playbackEvents = [];
    let cursor = 0;

    function addDiagnostic(severity, type, message, label) {
      diagnostics.push({ id: type + "-" + diagnostics.length, severity, type, message, label: label || "结构检查", voices: [] });
    }

    const expositionEntries = [];
    for (let index = 0; index < settings.voices; index += 1) {
      const form = index % 2 === 0 ? "主题" : "答题";
      const startBeat = index * spacingBeats;
      const entry = makeFugueEntry({
        id: "exposition-" + (index + 1),
        sectionId: "exposition",
        section: "呈示部",
        voice: voiceOrder[index],
        form,
        key: form === "主题" ? "主调" : "属调",
        keyMode: form === "主题" ? settings.mode : settings.mode,
        startBeat,
        events: form === "主题" ? subjectEvents : answerEvents
      });
      entries.push(entry);
      expositionEntries.push(entry);
      playbackEvents.push(...entry.events);
      cursor = Math.max(cursor, entry.endBeat);
    }
    const expositionEnd = alignToBar(cursor + 4);
    sections.push(makeSectionPlan("exposition", "呈示部", "exposition", 0, expositionEnd, {
      summary: expositionEntries.map((entry) => entry.voice + " " + entry.form).join(" · "),
      function: "建立主调与属调，让所有声部按主题/答题交替完成首次进入。",
      material: ["完整主题 T", (settings.answerType === "tonal" ? "守调答题 A" : "真实答题 A"), "第二进入起可加入固定对题 CS 候选"],
      entrySummary: expositionEntries.map((entry) => entry.voice + "：" + entry.form + "（第 " + entry.startBar + " 小节）").join("；"),
      tonalPlan: "主调 " + keyName(baseTonic, settings.mode, preferFlats) + " → 属调 " + keyName(dominantTonic, settings.mode, preferFlats) + "；只在主属轴心内确认调性。",
      texture: "主题与答题交替；新声部进入后，先前声部转入对题或自由对位。",
      cadence: "第 " + barNumber(Math.max(0, expositionEnd - 1)) + " 小节前收束；优先半终止或不完全终止，避免过早完满终止。",
      task: "先固定主题音高与时值，再为答题逐音核对该改与不该改的位置；不要为了填满和声改写主题头。",
      checkpoints: ["每次进入的第一音与调性是否清楚", "答题是否保持主题节奏与可辨轮廓", "进入间隔内是否出现声部交叉或连续五/八度"]
    }));

    function addEpisode(id, label, startBeat, targetTonic, targetMode, nextDescription) {
      const start = alignToBar(startBeat);
      const end = start + 8;
      const targetLabel = keyName(targetTonic, targetMode, preferFlats);
      sections.push(makeSectionPlan(id, label, "episode", start, end, {
        summary: "动机模进 → " + targetLabel,
        function: "在两次主题进入之间完成调性过渡，同时让主题材料继续可听。",
        material: ["主题头 3–4 音", "对题尾部的节奏型", "低声部功能进行"],
        entrySummary: "下一进入：" + nextDescription,
        tonalPlan: "从当前调出发，经两次模进锁定 " + targetLabel + "；第二遍改变模进步长或方向，避免机械重复。",
        texture: "一段建立动机，一段作模进转调；至少保留一个声部作长音或 pedal 支点。",
        cadence: "在间插末尾用目标调的 V 或 ii–V 准备下一主题进入。",
        task: "先写出两次模进的起点与落点，再填纵向音程；转调枢轴要能同时解释前后两调。",
        checkpoints: ["模进是否保持动机节奏", "每次转调是否有枢轴和弦", "低声部与上方声部是否形成连续完全音程"]
      }));
      return end;
    }

    cursor = addEpisode("episode1", "间插段 I", expositionEnd, relativeTonic, relativeMode, voiceOrder[0] + " 在 " + keyName(relativeTonic, relativeMode, preferFlats) + " 进入");

    function addMiddleEntry(index, targetTonic, targetMode, startBeat, voice, relationLabel) {
      const start = alignToBar(startBeat);
      const shift = shortestPitchShift(baseTonic, targetTonic);
      const entry = makeFugueEntry({
        id: "middle-" + index,
        sectionId: "middle-" + index,
        section: "中间部",
        voice,
        form: "主题",
        key: keyName(targetTonic, targetMode, preferFlats),
        keyMode: targetMode,
        startBeat: start,
        events: shiftEvents(subjectEvents, shift)
      });
      entries.push(entry);
      playbackEvents.push(...entry.events);
      const end = alignToBar(entry.endBeat + 4);
      sections.push(makeSectionPlan("middle-" + index, "中间进入 " + index, "middle", start, end, {
        summary: entry.voice + " 主题 → " + entry.key,
        function: "离开主属轴心，用一次完整主题进入建立新的调性支点。",
        material: ["完整主题", "伴随声部的对题或自由模仿"],
        entrySummary: entry.voice + "：" + entry.form + "（第 " + entry.startBar + " 小节，音域 " + entry.range + "）",
        tonalPlan: relationLabel + "：从主调转入 " + entry.key + "；进入前先用新调的属功能准备。",
        texture: "主题在新调进入；先前声部优先保留对题，不足时用主题头作模仿。",
        cadence: "进入后用新调的 V–I 或半终止巩固，再交给下一间插段。",
        task: "检查主题移位后的音域与临时升降号；若主题含主属跳进，确认在新调仍保持同样的调性含义。",
        checkpoints: ["主题头是否仍可辨认", "新调属功能是否在进入前出现", "对题与主题的纵向音程是否可解释"]
      }));
      return end;
    }

    if (settings.layout !== "compact") {
      cursor = addMiddleEntry(1, relativeTonic, relativeMode, cursor, voiceOrder[1] || voiceOrder[0], "关系调方向");
      cursor = addEpisode("episode2", "间插段 II", cursor, subdominantTonic, settings.mode, voiceOrder[Math.min(2, voiceOrder.length - 1)] + " 在下属方向进入");
      cursor = addMiddleEntry(2, subdominantTonic, settings.mode, cursor, voiceOrder[Math.min(2, voiceOrder.length - 1)], "下属方向");
      cursor = addEpisode("episode3", "间插段 III", cursor, dominantTonic, settings.mode, "密接和应从主调与属调叠置进入");
    }

    const strettoStart = alignToBar(cursor);
    const strettoGap = Math.max(2, Math.floor(subjectSpan / 2));
    const strettoCount = settings.voices >= 3 ? 3 : 2;
    const strettoEntries = [];
    for (let index = 0; index < strettoCount; index += 1) {
      const form = index === 1 ? "答题" : "主题";
      const startBeat = strettoStart + index * strettoGap;
      const entry = makeFugueEntry({
        id: "stretto-" + (index + 1),
        sectionId: "stretto",
        section: "密接和应",
        voice: voiceOrder[index % voiceOrder.length],
        form,
        key: form === "主题" ? "主调" : "属调",
        keyMode: settings.mode,
        startBeat,
        events: form === "主题" ? subjectEvents : answerEvents,
        overlap: true,
        strettoGap
      });
      entries.push(entry);
      strettoEntries.push(entry);
      playbackEvents.push(...entry.events);
      cursor = Math.max(cursor, entry.endBeat);
    }
    const strettoEnd = alignToBar(cursor + 4);
    sections.push(makeSectionPlan("stretto", "密接和应", "stretto", strettoStart, strettoEnd, {
      summary: strettoEntries.map((entry) => entry.voice + " " + entry.form).join(" · ") + " · 间隔 " + strettoGap + " 拍",
      function: "让主题在尚未结束时再次进入，用重叠制造密度并收紧结构。",
      material: ["主题头/完整主题", "答题", "密接窗口内的自由对位"],
      entrySummary: strettoEntries.map((entry) => entry.voice + "：" + entry.form + "（第 " + entry.startBar + " 小节，间隔 " + strettoGap + " 拍）").join("；"),
      tonalPlan: "主调与属调叠置；密接段内不频繁转调，靠进入关系制造张力。",
      texture: "每次进入都压缩前一次的时间空间；必要时删去主题尾部，只保留可辨认头三音。",
      cadence: "密接末尾接属持续或直接进入主调再现。",
      task: "逐次检查新进入的第一音与已发声部的纵向音程；优先保留主题头，尾部的自由处理比头更重要。",
      checkpoints: ["第二次进入是否在主题结束前发生", "每个重叠点是否有可解释的协和/不协和", "主题是否被连续完全音程淹没"]
    }));

    const pedalStart = alignToBar(strettoEnd);
    const pedalEnd = pedalStart + 8;
    const pedalMidi = fitEventsToRange([{ midi: baseTonic + 7, start: 0, duration: 8 }], voiceOrder[voiceOrder.length - 1])[0].midi;
    const pedalEntry = makeFugueEntry({
      id: "pedal-1",
      sectionId: "pedal",
      section: "属持续",
      voice: "低声部",
      form: "持续音",
      key: "属持续",
      keyMode: settings.mode,
      startBeat: pedalStart,
      events: [{ midi: pedalMidi, start: 0, duration: 8 }]
    });
    entries.push(pedalEntry);
    playbackEvents.push(...pedalEntry.events);
    sections.push(makeSectionPlan("pedal", "属持续", "pedal", pedalStart, pedalEnd, {
      summary: "低声部属音持续 2 小节",
      function: "把属到主的和声张力拉长，为再现与终止制造支点。",
      material: ["低声部属音持续", "上方主题头、对题或终止音型"],
      entrySummary: "低声部：" + midiToName(pedalMidi, preferFlats) + "（第 " + barNumber(pedalStart) + "–" + barNumber(pedalEnd - 1) + " 小节）",
      tonalPlan: "属持续为 " + keyName(baseTonic, settings.mode, preferFlats) + " 的 V；上方可经过下属/重属，但最终解决到主。",
      texture: "低音保持，上方声部继续复调运动；不要把持续音写成静态和弦。",
      cadence: "持续音结束必须解决到主和弦或主调终止。",
      task: "确认持续音上方的不协和都能按和弦外音、延留或离调解释。",
      checkpoints: ["持续音是否真正保持属音", "上方不协和是否有解决", "解决时低音是否进入主音"]
    }));

    const recapStart = alignToBar(pedalEnd);
    let recapSource = subjectEvents;
    if (settings.recapMode === "inversion") {
      const inverted = invertEventsInKey(subjectEvents, settings.key, settings.mode);
      recapSource = inverted.events;
      if (inverted.diatonic) {
        addDiagnostic("info", "recap-inversion", "再现倒影按 " + keyName(baseTonic, settings.mode, preferFlats) + " 的调式音级围绕主题首音作轴，音高仍留在调内。", "再现");
      } else {
        addDiagnostic("warning", "recap-inversion", "主题含调外音，再现倒影改用半音倒影；请逐音检查倒影后的调性与声部音域。", "再现");
      }
    }
    const recapEntry = makeFugueEntry({
      id: "recap-1",
      sectionId: "recap",
      section: "再现",
      voice: voiceOrder[0],
      form: settings.recapMode === "inversion" ? "主题倒影" : "主题",
      key: "主调",
      keyMode: settings.mode,
      startBeat: recapStart,
      events: recapSource
    });
    entries.push(recapEntry);
    playbackEvents.push(...recapEntry.events);
    const recapEnd = alignToBar(recapEntry.endBeat + 4);
    sections.push(makeSectionPlan("recap", "再现", "recap", recapStart, recapEnd, {
      summary: recapEntry.voice + " " + recapEntry.form + " → 主调",
      function: "回到主调并重新确认主题，让前面的调性运动收束。",
      material: [recapEntry.form, "可与呈示部交换对题/声部顺序", "紧接或持续音的余波"],
      entrySummary: recapEntry.voice + "：" + recapEntry.form + "（第 " + recapEntry.startBar + " 小节，音域 " + recapEntry.range + "）",
      tonalPlan: "回到主调 " + keyName(baseTonic, settings.mode, preferFlats) + "；避免在再现中途再次建立稳定新调。",
      texture: "主题回到主调，可改变声部顺序或把对题移到另一个声部。",
      cadence: "第 " + barNumber(recapEnd - 1) + " 小节完成主调终止。",
      task: "检查再现与呈示部的材料关系：哪些保持不变，哪些通过声部交换或倒影形成变化。",
      checkpoints: ["主题是否清楚回到主调", "声部交换后是否仍可转位", "终止前是否解决所有悬置不协和"]
    }));

    const codaStart = alignToBar(recapEnd);
    const codaEnd = codaStart + 4;
    const cadenceBass = fitEventsToRange([{ midi: baseTonic, start: 0, duration: 4 }], voiceOrder[voiceOrder.length - 1])[0].midi;
    playbackEvents.push({ voice: voiceOrder[voiceOrder.length - 1], start: codaStart, duration: 4, midi: cadenceBass });
    entries.push({
      id: "coda-1",
      sectionId: "coda",
      section: "尾声",
      voice: "全声部",
      form: "终止",
      key: "主调",
      keyMode: settings.mode,
      startBeat: codaStart,
      endBeat: codaEnd,
      bar: barNumber(codaStart),
      startBar: barNumber(codaStart),
      endBar: barNumber(codaEnd - 1),
      beats: 4,
      notes: [],
      events: [],
      range: "—"
    });
    sections.push(makeSectionPlan("coda", "尾声", "coda", codaStart, codaEnd, {
      summary: "主调终止 · 1 小节",
      function: "用终止、持续音解决或紧接余波结束全曲。",
      material: ["主调终止式", "主题头短引用（可选）"],
      entrySummary: "全声部：主调终止",
      tonalPlan: "主调 V–I 或 iv–V–I；不再引入新的稳定调性。",
      texture: "可全声部收束，也可保留一个声部的主题头作为最后引用。",
      cadence: "第 " + barNumber(codaStart) + " 小节完成完满终止。",
      task: "最后检查终止四六、导音解决与低音进行；不要让密接的余波掩盖终止。",
      checkpoints: ["终止是否落在主音", "导音是否上行解决", "最后低音是否清楚支持主和弦"]
    }));

    const counterSubject = makeCounterSubject(subjectEvents, settings.key, settings.mode);
    const outOfKey = subjectEvents
      .map((event) => midiToName(event.midi, preferFlats))
      .filter((name, index) => !scalePcs.includes(pitchClass(subjectEvents[index].midi)));
    const firstDegree = scalePcs.indexOf(pitchClass(subject[0]));
    if (parsed.invalid.length) addDiagnostic("warning", "parse", "有 " + parsed.invalid.length + " 个主题记号无法识别，已跳过：" + parsed.invalid.join("、") + "。时值写法用 C4:2。", "主题输入");
    if (outOfKey.length) addDiagnostic("warning", "subject-scale", "主题含调外音：" + Array.from(new Set(outOfKey)).join("、") + "。这在半音化主题中可以是特性，但答题与中间进入的调性解释要逐音复核。", "主题");
    if (subjectSpan < 4) addDiagnostic("warning", "subject-length", "主题只有 " + subjectSpan + " 拍；过短会让答题和紧接缺少可辨认的材料。", "主题");
    if (firstDegree < 0) addDiagnostic("warning", "subject-start", "主题首音不在所选调内；请确认这是有意的半音化起句，还是主音/调式输入错误。", "主题");
    else if (firstDegree !== 0 && firstDegree !== 4) addDiagnostic("info", "subject-start", "主题从第 " + (firstDegree + 1) + " 级开始；请确认这是有意的弱起/属音起句，而不是调性输入错误。", "主题");
    if (subjectSpan > 16) addDiagnostic("warning", "subject-memory", "主题长达 " + subjectSpan + " 拍；在紧接与多声部进入中要删减尾部或只保留主题头。", "主题");
    const subjectRange = Math.max(...subject) - Math.min(...subject);
    if (subjectRange > 12) addDiagnostic("warning", "range", "主题音域超过一个八度；检查各声部移位后的实际音域。", "主题");
    if (answerRelation && !answerRelation.dominantRelation) addDiagnostic("warning", "answer", "答题与主题的主音程关系不是典型的五度/四度；请确认答题类型或主题调性。", "答题");
    if (settings.answerType === "tonal") addDiagnostic("info", "tonal-answer", "守调答题只应改写越过主属边界的位置；当前方案保留了主题节奏，具体改写需逐音复核。", "答题");
    if (settings.answerType === "real") addDiagnostic("info", "real-answer", "真实答题逐音移高五度；若主题含主属跳进，检查答题是否越过呈示部的主属范围。", "答题");
    if (counterSubject && counterSubject.invertibility.total) {
      const pass = counterSubject.invertibility.passBoth + "/" + counterSubject.invertibility.total;
      addDiagnostic(counterSubject.invertibility.passRate >= 0.75 ? "info" : "warning", "countersubject", "对题候选与主题原位协和 " + counterSubject.invertibility.directConsonant + "/" + counterSubject.invertibility.total + " 处，八度转位后仍协和 " + pass + " 处；转位失败的位置要改音。", "对题");
    }
    addDiagnostic("info", "draft", "结构计划固定了主题、答题、调性、进入顺序、间插目标与终止位置；具体对位仍需逐段写作。", "交付边界");

    const totalBeats = codaEnd;
    const gridEvents = [];
    entries.forEach((entry) => {
      const gridVoice = entry.voice === "低声部" ? voiceOrder[voiceOrder.length - 1] : entry.voice;
      entry.events.forEach((event) => gridEvents.push(Object.assign({}, event, { voice: gridVoice })));
    });
    const gridRows = voiceOrder.map((voice) => {
      const events = gridEvents.filter((event) => event.voice === voice);
      const grid = fillBeatGrid(events, totalBeats);
      const midis = events.map((event) => event.midi);
      return {
        name: voice,
        marker: grid.marker,
        eventCount: events.length,
        range: midis.length ? midiToName(Math.min(...midis), preferFlats) + "–" + midiToName(Math.max(...midis), preferFlats) : "—"
      };
    });
    playbackEvents.sort((a, b) => a.start - b.start || a.midi - b.midi);

    return {
      settings,
      subject,
      answer,
      subjectEvents,
      answerEvents,
      counterSubject,
      subjectNames: subject.map((midi) => midiToName(midi, preferFlats)),
      answerNames: answer.map((midi) => midiToName(midi, preferFlats)),
      answerRelation,
      entries,
      sections,
      gridRows,
      playbackEvents,
      diagnostics,
      bars: barNumber(totalBeats - 1),
      totalBeats,
      subjectSpan,
      spacingBars,
      source: hasCustomSubject ? "custom" : "preset"
    };
  }
  function analyzeAnswerRelation(subject, answer) {
    const subjectMidis = subject.map(noteToMidi).filter((midi) => midi !== null);
    const answerMidis = answer.map(noteToMidi).filter((midi) => midi !== null);
    if (!subjectMidis.length || !answerMidis.length) return null;
    const differences = subjectMidis.slice(0, answerMidis.length).map((midi, index) => answerMidis[index] - midi);
    const tally = new Map();
    differences.forEach((value) => tally.set(value, (tally.get(value) || 0) + 1));
    const main = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      differences,
      mainDifference: main ? main[0] : null,
      exact: new Set(differences).size === 1,
      dominantRelation: main ? [7, -5, 5, -7, 12].includes(main[0]) : false
    };
  }

  const api = {
    pitchClass,
    noteToMidi,
    midiToName,
    parseVoices,
    intervalInfo,
    analyzeCounterpoint,
    generateSpecies,
    generateCanon,
    planFugue,
    analyzeAnswerRelation,
    CF_PRESETS,
    SUBJECT_PRESETS,
    KEY_SIGNATURES
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CounterpointEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
