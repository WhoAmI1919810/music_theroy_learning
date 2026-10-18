"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../app/js/engine.js");
const D = require("../app/data/theory-data.js");

test("all species combinations generate rule-clean skeletons", () => {
  for (const species of D.SPECIES) {
    for (const preset of D.CF_PRESETS) {
      const result = E.generateSpecies(preset.id, species.id);
      assert.equal(result.diagnostics.summary.errors, 0, species.id + " / " + preset.id);
      assert.ok(result.totalBeats > 0);
      assert.equal(result.cfEvents.length, preset.notes.length);
      assert.ok(result.cpEvents.length > 0);
    }
  }
});

test("subjects begin on the tonic in every supported key and mode", () => {
  for (const key of Object.keys(D.KEY_SIGNATURES)) {
    for (const mode of ["major", "minor"]) {
      const result = E.planFugue({ key, mode, voices: 3, answerType: "tonal", subjectType: "classic" });
      const tonic = D.KEY_SIGNATURES[key].tonic;
      assert.equal(E.pitchClass(result.subject[0]), tonic, key + " " + mode);
      assert.ok(result.subject.every((midi) => midi >= 48 && midi <= 88));
    }
  }
});

test("tonal and real answers keep the dominant relation and response contour", () => {
  for (const key of Object.keys(D.KEY_SIGNATURES)) {
    for (const answerType of ["tonal", "real"]) {
      const result = E.planFugue({ key, mode: "major", voices: 4, answerType, subjectType: "classic" });
      const relation = E.analyzeAnswerRelation(result.subject, result.answer);
      assert.ok(relation);
      assert.ok(relation.dominantRelation, key + " " + answerType);
      assert.equal(result.subject.length, result.answer.length);
      assert.deepEqual(result.subject.slice(0, 2), E.planFugue({ key, mode: "major", voices: 4, answerType, subjectType: "classic" }).subject.slice(0, 2));
    }
  }
});

test("fugue plans expose the expected sections for two through five voices", () => {
  for (const voices of [2, 3, 4, 5]) {
    const result = E.planFugue({ key: "C", mode: "major", voices, answerType: "tonal", subjectType: "classic" });
    assert.equal(result.entries.filter((entry) => entry.section === "呈示部").length, voices);
    assert.ok(result.sections.some((section) => section.id === "exposition"));
    assert.ok(result.sections.some((section) => section.id === "recap"));
    assert.ok(result.sections.some((section) => section.id === "pedal"));
    assert.equal(result.entries.find((entry) => entry.section === "再现").key, "主调");
  }
});

test("canon applies transformation to the comes, not to both voices", () => {
  const subject = ["C4", "D4", "E4", "G4", "A4"];
  const plain = E.generateCanon(subject, { delay: 4, interval: 12, transform: "none" });
  assert.deepEqual(plain.events.filter((event) => event.voice === "dux").map((event) => event.midi), [60, 62, 64, 67, 69]);

  const retrograde = E.generateCanon(subject, { delay: 4, interval: 12, transform: "retrograde" });
  assert.deepEqual(retrograde.events.filter((event) => event.voice === "dux").map((event) => event.midi), [60, 62, 64, 67, 69]);
  assert.deepEqual(retrograde.events.filter((event) => event.voice === "comes").map((event) => event.midi), [81, 79, 76, 74, 72]);

  const augmented = E.generateCanon(subject, { delay: 4, interval: 12, transform: "augmentation" });
  assert.equal(augmented.events.find((event) => event.voice === "dux").duration, 1);
  assert.equal(augmented.events.find((event) => event.voice === "comes").duration, 2);
});

test("multi-voice canon expands every voice across repeated cycles", () => {
  const subject = ["C4", "D4", "E4", "G4", "A4"];
  const result = E.generateCanon(subject, {
    delay: 2,
    interval: 12,
    transform: "none",
    voices: 4,
    cycles: 2,
    entryMode: "cumulative"
  });
  assert.equal(result.rows.length, 4);
  assert.equal(result.entries.length, 8);
  assert.equal(result.events.filter((event) => event.voice === "dux").length, subject.length * 2);
  assert.equal(result.events.filter((event) => event.voice === "voice4").length, subject.length * 2);
  assert.ok(result.entries.some((entry) => entry.round === 2 && entry.voiceId === "voice4"));
  const voice3Start = Math.min(...result.events.filter((event) => event.voice === "voice3").map((event) => event.start));
  const voice4Start = Math.min(...result.events.filter((event) => event.voice === "voice4").map((event) => event.start));
  assert.ok(voice4Start > voice3Start);
  assert.ok(result.totalBeats >= 16);
});

test("fugue accepts a user subject with rhythm and plans every section", () => {
  const subjectText = "C4:1 D4:1 E4:2 G4:1 A4:2 G4:1 E4:1 D4:1 C4:2";
  const result = E.planFugue({
    key: "C",
    mode: "major",
    voices: 4,
    answerType: "tonal",
    subjectText,
    layout: "standard",
    entrySpacing: "auto"
  });
  assert.deepEqual(result.subject, [60, 62, 64, 67, 69, 67, 64, 62, 60]);
  assert.deepEqual(result.subjectEvents.map((event) => event.duration), [1, 1, 2, 1, 2, 1, 1, 1, 2]);
  assert.equal(result.subjectSpan, 12);
  assert.equal(result.source, "custom");
  assert.equal(result.entries.filter((entry) => entry.section === "呈示部").length, 4);
  assert.deepEqual(result.entries.find((entry) => entry.section === "呈示部").events.map((event) => event.duration), [1, 1, 2, 1, 2, 1, 1, 1, 2]);
  assert.ok(result.sections.some((section) => section.type === "episode" && section.material.length));
  assert.ok(result.sections.some((section) => section.type === "stretto" && section.checkpoints.length));
  assert.ok(result.sections.some((section) => section.type === "pedal" && section.cadence));
  assert.ok(result.sections.every((section) => section.function && section.material && section.tonalPlan && section.texture && section.cadence && section.task));
  assert.ok(result.counterSubject.events.length === result.subjectEvents.length);
  assert.ok(result.counterSubject.invertibility.total === result.subjectEvents.length);
  assert.ok(result.playbackEvents.length > result.subjectEvents.length);
});

test("fugue can mark the recap with an inverted subject", () => {
  const result = E.planFugue({
    key: "C",
    mode: "major",
    voices: 3,
    answerType: "tonal",
    subjectType: "classic",
    layout: "compact",
    recapMode: "inversion"
  });
  const recap = result.entries.find((entry) => entry.section === "再现");
  assert.equal(recap.form, "主题倒影");
  assert.notDeepEqual(recap.notes, result.subject);
  assert.equal(recap.key, "主调");
  assert.ok(recap.notes.every((midi) => [0, 2, 4, 5, 7, 9, 11].includes(E.pitchClass(midi))));
});

test("checker identifies parallel fifths and strong-beat dissonance", () => {
  const parallel = E.analyzeCounterpoint("S: C5 D5 E5 F5 G5\nA: F4 G4 A4 B4 C5", { beatsPerBar: 4, style: "strict" });
  assert.ok(parallel.issues.some((issue) => issue.type === "parallel-fifth"));

  const strong = E.analyzeCounterpoint("S: C5 D5 E5 F5 D5\nA: E4 F4 G4 A4 E4", { beatsPerBar: 4, style: "strict" });
  assert.ok(strong.issues.some((issue) => issue.type === "strong-dissonance" && issue.bar === 2));
});

test("free mode does not enforce strict parallel-perfect rules", () => {
  const input = "S: C5 D5 E5 F5 G5\nA: F4 G4 A4 B4 C5";
  const strict = E.analyzeCounterpoint(input, { beatsPerBar: 4, style: "strict" });
  const free = E.analyzeCounterpoint(input, { beatsPerBar: 4, style: "free" });
  assert.ok(strict.issues.some((issue) => issue.type.startsWith("parallel-")));
  assert.ok(!free.issues.some((issue) => issue.type.startsWith("parallel-")));
});
