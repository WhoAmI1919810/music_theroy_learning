const test = require("node:test");
const assert = require("node:assert/strict");

const theory = require("../app/data/theory-data.js");
const instruments = require("../app/data/instruments.js");
const mechanismData = require("../app/data/mechanisms.js");
const sources = require("../app/data/sources.js");
const engine = require("../app/js/engine.js");

test("theory graph has valid, acyclic dependencies", () => {
  const ids = new Set(theory.NODES.map((node) => node.id));
  assert.equal(ids.size, theory.NODES.length);
  for (const node of theory.NODES) {
    for (const dependency of node.prereq) assert.ok(ids.has(dependency), node.id + " missing prereq " + dependency);
    for (const dependency of node.next) assert.ok(ids.has(dependency), node.id + " missing next " + dependency);
    for (const claim of node.claims) assert.ok(sources.CLAIM_MAP[claim], node.id + " missing claim " + claim);
    for (const mechanism of node.mechanisms) assert.ok(mechanismData.MECHANISM_MAP[mechanism], node.id + " missing mechanism " + mechanism);
  }
  const visiting = new Set();
  const done = new Set();
  function visit(id) {
    assert.equal(visiting.has(id), false, "cycle at " + id);
    if (done.has(id)) return;
    visiting.add(id);
    for (const next of theory.NODE_MAP[id].next) visit(next);
    visiting.delete(id);
    done.add(id);
  }
  for (const node of theory.NODES) visit(node.id);
});

test("evidence references existing books and pages", () => {
  assert.equal(new Set(sources.BOOKS.map((book) => book.id)).size, sources.BOOKS.length);
  assert.equal(new Set(sources.CLAIMS.map((claim) => claim.id)).size, sources.CLAIMS.length);
  let direct = 0;
  for (const claim of sources.CLAIMS) {
    assert.ok(claim.citations.length > 0, claim.id + " has no citations");
    if (claim.category === "direct") direct += 1;
    for (const citation of claim.citations) {
      const book = sources.BOOK_MAP[citation.book];
      assert.ok(book, claim.id + " unknown book");
      assert.ok(Number.isInteger(citation.pdfPage), claim.id + " page not integer");
      assert.ok(citation.pdfPage >= 1 && citation.pdfPage <= book.pages, claim.id + " page out of range");
      if (claim.category !== "pending") {
        assert.ok(citation.quote && citation.quote.length > 4, claim.id + " quote too short");
      }
    }
  }
  assert.ok(direct >= 8, "expected a meaningful set of direct citations");
});

test("mechanisms reference valid claims and nodes", () => {
  assert.equal(new Set(mechanismData.MECHANISMS.map((item) => item.id)).size, mechanismData.MECHANISMS.length);
  for (const mechanism of mechanismData.MECHANISMS) {
    assert.ok(["direct", "derived"].includes(mechanism.evidence), mechanism.id + " has invalid evidence type");
    assert.ok(theory.LAYERS.some((layer) => layer.id === mechanism.layer), mechanism.id + " bad layer");
    for (const claim of mechanism.claims) assert.ok(sources.CLAIM_MAP[claim], mechanism.id + " missing claim " + claim);
  }
});

test("each historical period has a distinct focus on the theory map", () => {
  const ids = new Set(theory.NODES.map((node) => node.id));
  const signatures = new Set();
  for (const period of theory.PERIODS) {
    assert.ok(Array.isArray(period.focus) && period.focus.length >= 8, period.id + " focus too small");
    assert.ok(period.focus.length < theory.NODES.length, period.id + " focus hides no secondary nodes");
    assert.ok(period.focusNote && period.focusNote.length > 10, period.id + " missing focus note");
    for (const id of period.focus) assert.ok(ids.has(id), period.id + " unknown focus node " + id);
    signatures.add([...period.focus].sort().join(","));
  }
  assert.equal(signatures.size, theory.PERIODS.length, "period focus sets should differ");
});

test("transposing instrument ranges are stored as sounding pitch", () => {
  const anchors = {
    clarinet: [50, 94],
    bassclarinet: [34, 79],
    piccolo: [86, 108],
    doublebass: [28, 67]
  };
  for (const [id, range] of Object.entries(anchors)) {
    const instrument = instruments.INSTRUMENT_MAP[id];
    assert.ok(instrument, "missing " + id);
    assert.deepEqual([instrument.midiLow, instrument.midiHigh], range, id + " sounding range");
  }
  const clarinet = instruments.INSTRUMENT_MAP.clarinet;
  assert.ok(clarinet.comfortable[0] >= clarinet.midiLow, "clarinet comfort below sounding range");
});

test("instrument ranges and role profiles are coherent", () => {
  assert.equal(new Set(instruments.INSTRUMENTS.map((item) => item.id)).size, instruments.INSTRUMENTS.length);
  for (const instrument of instruments.INSTRUMENTS) {
    assert.ok(instrument.midiLow <= instrument.midiHigh, instrument.id);
    if (instrument.id !== "percussion") {
      assert.ok(instrument.comfortable[0] >= instrument.midiLow, instrument.id + " comfort low");
      assert.ok(instrument.comfortable[1] <= instrument.midiHigh, instrument.id + " comfort high");
    }
    for (const role of Object.keys(instruments.ROLE_LABELS)) {
      assert.ok(Number.isFinite(instrument.roles[role]), instrument.id + " missing role " + role);
    }
  }
});

test("every preset yields three non-empty, finite plans", () => {
  for (const preset of theory.PRESETS) {
    const result = engine.analyze(preset);
    assert.equal(result.plans.length, 3);
    assert.deepEqual(result.plans.map((plan) => plan.id), ["clear", "balanced", "thick"]);
    for (const plan of result.plans) {
      assert.ok(plan.layers.length >= 3);
      for (const layer of plan.layers) assert.ok(layer.instruments.length >= 1, preset.label + " empty layer");
      assert.ok(Number.isFinite(plan.metrics.registerLow));
      assert.ok(Number.isFinite(plan.metrics.registerHigh));
      assert.ok(plan.metrics.registerLow < plan.metrics.registerHigh);
      const ids = plan.layers.flatMap((layer) => layer.instruments.map((entry) => entry.instrumentId));
      assert.equal(new Set(ids).size, ids.length, preset.label + " reuses an instrument in one plan");
    }
  }
});

test("assigned sounding ranges stay inside physical ranges", () => {
  for (const preset of theory.PRESETS) {
    const result = engine.analyze(preset);
    for (const plan of result.plans) {
      for (const layer of plan.layers) {
        for (const assignment of layer.instruments) {
          if (assignment.soundingLow == null) continue;
          const instrument = instruments.INSTRUMENT_MAP[assignment.instrumentId];
          if (instrument.id === "percussion") continue;
          assert.ok(assignment.soundingLow >= instrument.midiLow, preset.label + " low " + assignment.instrument);
          assert.ok(assignment.soundingHigh <= instrument.midiHigh, preset.label + " high " + assignment.instrument);
        }
      }
    }
  }
});

test("same-register foreground and harmony triggers a masking warning", () => {
  const result = engine.analyze({
    goal: "transparent",
    ensemble: "classical",
    layers: [
      { id: "melody", role: "melody", lo: 60, hi: 67, dynamic: 6, duration: 8, density: 2, priority: 1 },
      { id: "harmony", role: "harmony", lo: 60, hi: 67, dynamic: 6, duration: 8, density: 2, priority: 3 },
      { id: "bass", role: "bass", lo: 36, hi: 48, dynamic: 4, duration: 8, density: 1, priority: 2 }
    ]
  });
  const warning = result.plans[1].diagnostics.find((item) => item.title === "音区重叠");
  assert.ok(warning);
  assert.equal(warning.severity, "warn");
});

test("manual multi-instrument layers stay fixed across all plan styles", () => {
  const result = engine.analyze({
    goal: "blended",
    ensemble: "romantic",
    layers: [
      {
        id: "melody", role: "melody", mode: "manual",
        manualVoices: [
          { instrumentId: "violin", octaveShift: 0 },
          { instrumentId: "flute", octaveShift: 12 },
          { instrumentId: "oboe", octaveShift: 0 }
        ],
        lo: 67, hi: 79, dynamic: 6, duration: 10, density: 2, priority: 1
      },
      { id: "bass", role: "bass", lo: 40, hi: 52, dynamic: 5, duration: 10, density: 1, priority: 2 }
    ]
  });
  const expected = [
    ["violin", 0, 67, 79],
    ["flute", 12, 79, 91],
    ["oboe", 0, 67, 79]
  ];
  for (const plan of result.plans) {
    const melody = plan.layers.find((layer) => layer.layerId === "melody");
    assert.equal(melody.mode, "manual");
    assert.match(melody.doubling, /手选 3 件/);
    assert.deepEqual(
      melody.instruments.map((item) => [item.instrumentId, item.octaveShift, item.soundingLow, item.soundingHigh]),
      expected
    );
    assert.ok(melody.instruments.every((item) => item.manual));
    assert.equal(plan.manualLayerCount, 1);
  }
});

test("manual selections outside the ensemble or instrument range are preserved with warnings", () => {
  const result = engine.analyze({
    goal: "transparent",
    ensemble: "chamber",
    layers: [{
      id: "manual-check", role: "melody", mode: "manual",
      manualVoices: [
        { instrumentId: "trumpet", octaveShift: 0 },
        { instrumentId: "flute", octaveShift: -12 }
      ],
      lo: 60, hi: 72, dynamic: 5, duration: 8, density: 2, priority: 1
    }]
  });
  for (const plan of result.plans) {
    const layer = plan.layers.find((item) => item.layerId === "manual-check");
    const trumpet = layer.instruments.find((item) => item.instrumentId === "trumpet");
    const flute = layer.instruments.find((item) => item.instrumentId === "flute");
    assert.ok(trumpet && flute, "manual selections must not be silently dropped");
    assert.equal(trumpet.inEnsemble, false);
    assert.equal(flute.inRange, false);
    assert.equal(flute.soundingLow, 48);
    assert.ok(plan.diagnostics.some((item) => item.title === "编制外乐器" && item.detail.includes("小号")));
    assert.ok(plan.diagnostics.some((item) => item.title === "超出实际音域" && item.detail.includes("长笛")));
  }
});

test("markdown export contains the selected plan and a practical caveat", () => {
  const result = engine.analyze(theory.PRESETS[1]);
  const markdown = engine.planToMarkdown({ input: result.input, plans: [result.plans[2]] });
  assert.match(markdown, /配器推演/);
  assert.match(markdown, /扩展全奏/);
  assert.match(markdown, /规则推演/);
});
