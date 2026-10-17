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
    return midis.slice();
  }

  function generateCanon(subjectNotes, options) {
    const settings = Object.assign({ delay: 4, interval: 12, transform: "none", duration: 1 }, options || {});
    const subject = (Array.isArray(subjectNotes) ? subjectNotes : String(subjectNotes).split(/\s+/)).map(noteToMidi).filter((midi) => midi !== null);
    const transformed = transformSubject(subject, settings.transform);
    const duxDuration = settings.duration;
    const comesDuration = settings.transform === "augmentation" ? settings.duration * 2 : settings.duration;
    const duxEvents = subject.map((midi, index) => ({ voice: "dux", start: index * duxDuration, duration: duxDuration, midi }));
    const comesEvents = transformed.map((midi, index) => ({
      voice: "comes",
      start: settings.delay + index * comesDuration,
      duration: comesDuration,
      midi: midi + settings.interval
    }));
    const events = duxEvents.concat(comesEvents);
    const totalBeats = Math.ceil(Math.max(...events.map((event) => event.start + event.duration)) / 4) * 4;
    const duxGrid = fillBeatGrid(duxEvents, totalBeats);
    const comesGrid = fillBeatGrid(comesEvents, totalBeats);
    const diagnostics = analyzeCounterpoint([
      { name: "Dux", notes: duxGrid.grid },
      { name: "Comes", notes: comesGrid.grid }
    ], { beatsPerBar: 4, style: "free" });
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
    return {
      subject,
      transformed,
      events,
      totalBeats,
      marker: { dux: duxGrid.marker, comes: comesGrid.marker },
      diagnostics,
      settings
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

  const VOICE_LABELS = ["S", "A", "T", "B"];

  function planFugue(input) {
    const settings = Object.assign({ key: "C", mode: "major", voices: 3, answerType: "tonal", subjectType: "classic", layout: "standard" }, input || {});
    const subject = makeSubject(settings.key, settings.mode, settings.subjectType);
    const answer = makeAnswer(subject, settings.key, settings.mode, settings.answerType);
    const subjectLength = Math.max(8, subject.length);
    const step = 4;
    const entries = [];
    const sections = [];
    let cursor = 1;
    const voiceOrder = Array.from({ length: settings.voices }, (_, index) => VOICE_LABELS[index] || "V" + (index + 1));
    for (let index = 0; index < settings.voices; index += 1) {
      const form = index % 2 === 0 ? "主题" : "答题";
      entries.push({
        section: "呈示部",
        voice: voiceOrder[index],
        form,
        key: form === "主题" ? "主调" : "属调",
        bar: cursor,
        beats: subjectLength,
        notes: form === "主题" ? subject : answer
      });
      cursor += step;
    }
    sections.push({ id: "exposition", label: "呈示部", start: 1, end: cursor - step + subjectLength - 1, note: "所有声部在主、属范围完成进入。" });
    cursor += 4;
    entries.push({ section: "间插段 I", voice: "—", form: "间插", key: "转调", bar: cursor, beats: 8, notes: [] });
    sections.push({ id: "episode1", label: "间插段 I", start: cursor, end: cursor + 7, note: "从主题或对题抽取动机，模进到下一调。" });
    cursor += 8;

    const middleKeys = settings.mode === "major" ? ["关系小调", "下属调", "下属关系小调"] : ["关系大调", "下属调", "下属关系大调"];
    const middleCount = settings.layout === "compact" ? 0 : 2;
    for (let index = 0; index < middleCount; index += 1) {
      entries.push({
        section: "中间部",
        voice: voiceOrder[(index + 1) % voiceOrder.length],
        form: "主题",
        key: middleKeys[index] || "近关系调",
        bar: cursor,
        beats: subjectLength,
        notes: subject
      });
      sections.push({ id: "middle-" + (index + 1), label: "中间进入 " + (index + 1), start: cursor, end: cursor + subjectLength - 1, note: "离开主属轴心，保持主题完整轮廓。" });
      cursor += subjectLength + 2;
      entries.push({ section: "间插段 " + (index + 2), voice: "—", form: "间插", key: "转调", bar: cursor, beats: 6, notes: [] });
      sections.push({ id: "episode-" + (index + 2), label: "间插段 " + (index + 2), start: cursor, end: cursor + 5, note: "把和声送回主调或下一进入。" });
      cursor += 6;
    }

    const strettoStart = cursor;
    entries.push({ section: "密接和应", voice: voiceOrder[0], form: "主题", key: "主调", bar: cursor, beats: subjectLength, notes: subject, overlap: true });
    cursor += 2;
    entries.push({ section: "密接和应", voice: voiceOrder[1] || voiceOrder[0], form: "答题", key: "属调", bar: cursor, beats: subjectLength, notes: answer, overlap: true });
    sections.push({ id: "stretto", label: "密接和应", start: strettoStart, end: cursor + subjectLength - 1, note: "主题未结束即再次进入；先检查重叠处的纵向音程。" });
    cursor += subjectLength;
    entries.push({ section: "属持续", voice: "低声部", form: "持续音", key: "属持续", bar: cursor, beats: 8, notes: [] });
    sections.push({ id: "pedal", label: "属持续", start: cursor, end: cursor + 7, note: "属音持续加强回到主调的倾向。" });
    cursor += 8;
    entries.push({ section: "再现", voice: voiceOrder[0], form: "主题", key: "主调", bar: cursor, beats: subjectLength, notes: subject });
    sections.push({ id: "recap", label: "再现", start: cursor, end: cursor + subjectLength - 1, note: "回到主调；常改变声部顺序、对题或紧接写法。" });
    cursor += subjectLength;
    entries.push({ section: "尾声", voice: "全声部", form: "终止", key: "主调", bar: cursor, beats: 4, notes: [] });
    sections.push({ id: "coda", label: "尾声", start: cursor, end: cursor + 3, note: "用终止、持续音或紧接余波完成收束。" });

    const diagnostics = [];
    const range = Math.max(...subject) - Math.min(...subject);
    if (range > 12) diagnostics.push({ severity: "warning", message: "主题音域超过一个八度；声乐赋格通常更窄，器乐赋格也要确认多声部进入时的音区。" });
    if (settings.answerType === "tonal") diagnostics.push({ severity: "info", message: "调性答题已把首次属音位置改回主音一侧；请在实际旋律中复核是否仍保留主题轮廓。" });
    if (settings.answerType === "real") diagnostics.push({ severity: "info", message: "真实答题保持逐音移位；若主题首部含主属跳进，检查答题是否越过呈示部的主属范围。" });
    if (settings.voices > 4) diagnostics.push({ severity: "warning", message: "五声部以上会显著压缩主题音区与紧接空间；需逐次进入复核。" });
    diagnostics.push({ severity: "ok", message: "骨架只安排结构位置、调性与进入顺序，不生成完整可演奏赋格。" });

    return {
      settings,
      subject,
      answer,
      subjectNames: subject.map((midi) => midiToName(midi)),
      answerNames: answer.map((midi) => midiToName(midi)),
      entries,
      sections,
      diagnostics,
      bars: cursor + 4
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
