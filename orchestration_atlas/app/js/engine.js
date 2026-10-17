(function (root) {
  "use strict";

  const instrumentData = typeof require === "function" ? require("../data/instruments.js") : root.ORCH_INSTRUMENTS;
  const theoryData = typeof require === "function" ? require("../data/theory-data.js") : root.ORCH_THEORY;

  const { INSTRUMENTS, INSTRUMENT_MAP, ENSEMBLES, ROLE_LABELS, DYNAMIC_NAMES } = instrumentData;
  const { GOALS, PRESETS } = theoryData;

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const PLAN_STYLES = [
    {
      id: "clear", label: "清晰优先", description: "减少同音区叠加，优先分离结构层。",
      clarityBonus: 0.55, weightBonus: 0.05, octaveBonus: 0.08,
      voices: { melody: 1, counter: 1, harmony: 2, bass: 1, pedal: 1, rhythm: 1 }
    },
    {
      id: "balanced", label: "标准平衡", description: "按目标风格分配，保留常规加倍。",
      clarityBonus: 0.2, weightBonus: 0.22, octaveBonus: 0.25,
      voices: { melody: 1, counter: 1, harmony: 3, bass: 2, pedal: 1, rhythm: 1 }
    },
    {
      id: "thick", label: "扩展全奏", description: "增加八度与混合音色，优先频带宽度。",
      clarityBonus: 0.02, weightBonus: 0.52, octaveBonus: 0.48,
      voices: { melody: 2, counter: 2, harmony: 4, bass: 2, pedal: 1, rhythm: 2 }
    }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function midiToName(midi) {
    const value = Math.round(Number(midi));
    if (!Number.isFinite(value)) return "–";
    const pc = ((value % 12) + 12) % 12;
    const octave = Math.floor(value / 12) - 1;
    return NOTE_NAMES[pc] + octave;
  }

  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (Number(midi) - 69) / 12);
  }

  function dynamicName(value) {
    const index = clamp(Math.round(Number(value) || 0), 1, 8) - 1;
    return DYNAMIC_NAMES[index];
  }

  function normalizeLayer(layer, index) {
    const low = Number(layer.lo);
    const high = Number(layer.hi);
    return {
      id: layer.id || "layer-" + (index + 1),
      role: ROLE_LABELS[layer.role] ? layer.role : "harmony",
      lo: Number.isFinite(low) ? low : 60,
      hi: Number.isFinite(high) ? Math.max(high, low) : 67,
      dynamic: clamp(Number(layer.dynamic) || 4, 1, 8),
      duration: clamp(Number(layer.duration) || 8, 0.5, 120),
      density: clamp(Number(layer.density) || 1, 0, 5),
      priority: clamp(Number(layer.priority) || 3, 1, 5)
    };
  }

  function rangeOverlap(aLow, aHigh, bLow, bHigh) {
    return Math.max(0, Math.min(aHigh, bHigh) - Math.max(aLow, bLow));
  }

  function overlapRatio(aLow, aHigh, bLow, bHigh) {
    const width = Math.max(1, Math.min(aHigh - aLow, bHigh - bLow));
    return clamp(rangeOverlap(aLow, aHigh, bLow, bHigh) / width, 0, 1);
  }

  function comfortableRatio(lo, hi, instrument) {
    if (!instrument.comfortable || instrument.midiLow === instrument.midiHigh) return 0.5;
    const overlap = rangeOverlap(lo, hi, instrument.comfortable[0], instrument.comfortable[1]);
    return clamp(overlap / Math.max(1, hi - lo), 0, 1);
  }

  function instrumentFits(lo, hi, instrument) {
    if (instrument.id === "percussion") return false;
    return lo >= instrument.midiLow && hi <= instrument.midiHigh;
  }

  function familySimilarity(a, b) {
    if (a.family === b.family) return 1;
    if ((a.family === "woodwind" && b.family === "brass") || (a.family === "brass" && b.family === "woodwind")) return 0.55;
    if ((a.family === "string" && b.family === "key") || (a.family === "key" && b.family === "string")) return 0.45;
    return 0.15;
  }

  function candidateFeatures(instrument, layer, low, high, context, style, goal) {
    const targetDynamic = layer.dynamic;
    const comfort = comfortableRatio(low, high, instrument);
    const roleFit = (instrument.roles[layer.role] || 0) / 5;
    const dynamicFit = targetDynamic <= instrument.maxDynamic
      ? 1 - Math.abs(instrument.maxDynamic - targetDynamic) / 16
      : Math.max(0, 1 - (targetDynamic - instrument.maxDynamic) / 3);
    const agilityFit = layer.density <= 2
      ? 0.72 + instrument.agility / 18
      : clamp(1 - Math.abs(instrument.agility - layer.density) / 5, 0, 1);
    const sustainFit = layer.density <= 1
      ? 0.45 + instrument.sustain / 10
      : 0.55 + instrument.agility / 12;
    const blendFit = instrument.blend / 5;
    const penetrationFit = instrument.penetration / 5;

    let maskingPenalty = 0;
    let sameFamilyPenalty = 0;
    const priorAssignments = context.assignments;
    for (const prior of priorAssignments) {
      const priorInstrument = INSTRUMENT_MAP[prior.instrumentId];
      if (!priorInstrument) continue;
      const priorLayer = context.layersById[prior.layerId];
      if (!priorLayer || prior.layerId === layer.id) continue;
      const overlap = overlapRatio(low, high, prior.soundingLow, prior.soundingHigh);
      const dynamicOverlap = Math.min(layer.dynamic, priorLayer.dynamic) / 8;
      const priorityDifference = Math.abs(layer.priority - priorLayer.priority);
      const separation = 1 - clamp(priorityDifference / 4, 0, 0.45);
      const family = familySimilarity(instrument, priorInstrument);
      if (layer.role === "melody" && priorLayer.role !== "melody") {
        maskingPenalty += overlap * dynamicOverlap * family * 0.42;
      } else if (priorLayer.role === "melody") {
        maskingPenalty += overlap * dynamicOverlap * family * 0.6 * separation;
      } else {
        maskingPenalty += overlap * dynamicOverlap * family * 0.24;
      }
      if (instrument.family === priorInstrument.family && overlap > 0.25) sameFamilyPenalty += 0.12;
    }

    let contrastFit = 0.5;
    if (context.melodyFamily) {
      contrastFit = instrument.family === context.melodyFamily ? 0.2 : 0.95;
      if (layer.role === "melody") contrastFit = 0.5;
    }

    const goalScore =
      goal.clarity * (comfort * 0.55 + roleFit * 0.25 + (1 - maskingPenalty) * 0.2) +
      goal.blend * (blendFit * 0.55 + comfort * 0.25 + (1 - Math.abs(instrument.penetration - 3) / 5) * 0.2) +
      goal.weight * (penetrationFit * 0.35 + comfort * 0.3 + 0.35) +
      goal.contrast * (contrastFit * 0.65 + roleFit * 0.35);

    const styleScore = style.id === "clear"
      ? comfort * 0.5 + (1 - maskingPenalty) * 0.4 + roleFit * 0.1
      : style.id === "thick"
        ? penetrationFit * 0.4 + comfort * 0.3 + blendFit * 0.1 + 0.2
        : goalScore * 0.72 + 0.18;

    const total = styleScore + dynamicFit * 0.22 + agilityFit * 0.16 + sustainFit * 0.1 - maskingPenalty * 0.72 - sameFamilyPenalty;
    return { total, comfort, roleFit, dynamicFit, agilityFit, sustainFit, blendFit, penetrationFit, maskingPenalty, contrastFit };
  }

  function reasonFor(instrument, features, layer, goal) {
    const parts = [];
    if (features.comfort >= 0.78) parts.push("舒适音区覆盖 " + Math.round(features.comfort * 100) + "%");
    else if (features.comfort >= 0.4) parts.push("音区可用，边缘占 " + Math.round((1 - features.comfort) * 100) + "%");
    else parts.push("位于音域边缘，需复核力度");
    if (features.roleFit >= 0.8) parts.push("符合" + ROLE_LABELS[layer.role] + "角色");
    if (features.maskingPenalty > 0.32) parts.push("与已分配层有掩蔽风险");
    else if (features.maskingPenalty < 0.1 && goal.clarity >= 0.5) parts.push("与前景层分离");
    if (goal.weight >= 0.8 && instrument.penetration >= 4) parts.push("提供结构点的响度与频带覆盖");
    if (features.blendFit >= 0.8) parts.push("融合度高");
    return parts.join("；");
  }

  function rankCandidates(layer, low, high, available, context, style, goal, assignedIds) {
    const ranked = [];
    for (const instrument of available) {
      if (assignedIds.has(instrument.id)) continue;
      if (!instrumentFits(low, high, instrument)) continue;
      if ((instrument.roles[layer.role] || 0) < 2) continue;
      const features = candidateFeatures(instrument, layer, low, high, context, style, goal);
      ranked.push({ instrument, features });
    }
    ranked.sort((a, b) => b.features.total - a.features.total);
    return ranked;
  }

  function chooseCandidate(layer, low, high, available, context, style, goal, assignedIds) {
    const ranked = rankCandidates(layer, low, high, available, context, style, goal, assignedIds);
    if (!ranked.length) return null;
    return Object.assign({}, ranked[0], { alternatives: ranked.slice(1, 3) });
  }

  function alternativesFor(candidate, layer, goal) {
    return (candidate.alternatives || []).map((item) => ({
      instrumentId: item.instrument.id,
      instrument: item.instrument.name,
      score: Math.round(item.features.total * 1000) / 1000,
      reason: reasonFor(item.instrument, item.features, layer, goal)
    }));
  }

  function shiftedRange(layer, shift) {
    return [layer.lo + shift, layer.hi + shift];
  }

  function planLayer(layer, available, context, style, goal, assignedIds) {
    const wanted = style.voices[layer.role] || 1;
    const instruments = [];
    const shiftChoices = [0];
    if (style.id === "thick" && (layer.role === "melody" || layer.role === "bass")) {
      shiftChoices.push(layer.role === "melody" ? -12 : -12);
    }
    if (style.id === "balanced" && layer.role === "bass") shiftChoices.push(-12);

    for (const shift of shiftChoices) {
      const [low, high] = shiftedRange(layer, shift);
      const candidate = chooseCandidate(layer, low, high, available, context, style, goal, assignedIds);
      if (!candidate) continue;
      const id = candidate.instrument.id;
      assignedIds.add(id);
      const assignment = {
        layerId: layer.id,
        role: layer.role,
        instrumentId: id,
        instrument: candidate.instrument.name,
        family: candidate.instrument.family,
        familyLabel: candidate.instrument.familyLabel,
        octaveShift: shift,
        soundingLow: low,
        soundingHigh: high,
        score: Math.round(candidate.features.total * 1000) / 1000,
        reason: reasonFor(candidate.instrument, candidate.features, layer, goal),
        alternatives: alternativesFor(candidate, layer, goal),
        features: candidate.features
      };
      instruments.push(assignment);
      context.assignments.push(assignment);
      if (layer.role === "melody" && !context.melodyFamily) context.melodyFamily = candidate.instrument.family;
    }

    if (!instruments.length && layer.role === "rhythm") {
      const percussion = INSTRUMENT_MAP.percussion;
      assignedIds.add(percussion.id);
      const assignment = {
        layerId: layer.id, role: layer.role, instrumentId: percussion.id,
        instrument: percussion.name, family: percussion.family, familyLabel: percussion.familyLabel,
        octaveShift: 0, soundingLow: null, soundingHigh: null, score: 0.35,
        reason: "节奏层需要明确的起音与时间边界", alternatives: [],
        features: { comfort: 0, roleFit: 1, maskingPenalty: 0 }
      };
      instruments.push(assignment);
      context.assignments.push(assignment);
    }

    const extraTarget = Math.max(wanted, instruments.length);
    while (instruments.length < extraTarget) {
      const candidate = chooseCandidate(layer, layer.lo, layer.hi, available, context, style, goal, assignedIds);
      if (!candidate) break;
      const id = candidate.instrument.id;
      assignedIds.add(id);
      const assignment = {
        layerId: layer.id, role: layer.role, instrumentId: id,
        instrument: candidate.instrument.name, family: candidate.instrument.family,
        familyLabel: candidate.instrument.familyLabel, octaveShift: 0,
        soundingLow: layer.lo, soundingHigh: layer.hi,
        score: Math.round(candidate.features.total * 1000) / 1000,
        reason: reasonFor(candidate.instrument, candidate.features, layer, goal),
        alternatives: alternativesFor(candidate, layer, goal),
        features: candidate.features
      };
      instruments.push(assignment);
      context.assignments.push(assignment);
    }

    return {
      layerId: layer.id, role: layer.role, roleLabel: ROLE_LABELS[layer.role],
      priority: layer.priority, range: [layer.lo, layer.hi],
      rangeLabel: midiToName(layer.lo) + "–" + midiToName(layer.hi),
      dynamic: dynamicName(layer.dynamic), density: layer.density,
      doubling: doublingLabel(layer, instruments), instruments
    };
  }

  function doublingLabel(layer, assignments) {
    if (!assignments.length) return "未分配";
    if (assignments.length === 1) return "单件/单组";
    if (layer.role === "harmony") return "多声部和弦分配";
    if (layer.role === "rhythm") return "节奏层叠置";
    const shifts = new Set(assignments.map((item) => item.octaveShift));
    if (shifts.size > 1) return "八度加倍";
    return "同度/混合同度";
  }

  function buildPlan(input, style) {
    const goal = GOALS[input.goal] || GOALS.blended;
    const ensemble = ENSEMBLES[input.ensemble] || ENSEMBLES.classical;
    const available = ensemble.ids.map((id) => INSTRUMENT_MAP[id]).filter(Boolean);
    const layers = input.layers.map(normalizeLayer);
    const layersById = Object.fromEntries(layers.map((layer) => [layer.id, layer]));
    const context = { assignments: [], layersById, melodyFamily: null };
    const assignedIds = new Set();
    const ordered = [...layers].sort((a, b) => a.priority - b.priority || a.lo - b.lo);
    const layerPlans = ordered.map((layer) => planLayer(layer, available, context, style, goal, assignedIds));
    const diagnostics = diagnose(layers, layerPlans, goal, ensemble, style);
    const totalVoices = layerPlans.reduce((sum, item) => sum + item.instruments.length, 0);
    const families = [...new Set(layerPlans.flatMap((item) => item.instruments.map((entry) => entry.family)))];
    const assignedLayers = layerPlans.filter((plan) => plan.instruments.length);
    return {
      id: style.id, label: style.label, description: style.description,
      goal: input.goal, ensemble: input.ensemble, ensembleLabel: ensemble.label,
      layers: layerPlans, diagnostics,
      metrics: {
        independentLayers: layers.length,
        assignedInstruments: totalVoices,
        families: families.length,
        registerLow: assignedLayers.length ? Math.min(...assignedLayers.map((p) => p.range[0])) : 24,
        registerHigh: assignedLayers.length ? Math.max(...assignedLayers.map((p) => p.range[1])) : 108,
        warningCount: diagnostics.filter((item) => item.severity !== "info").length
      }
    };
  }

  function diagnose(layers, layerPlans, goal, ensemble, style) {
    const diagnostics = [];
    const allAssignments = layerPlans.flatMap((plan) => plan.instruments);
    const byLayer = Object.fromEntries(layerPlans.map((plan) => [plan.layerId, plan]));

    for (let firstIndex = 0; firstIndex < layers.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < layers.length; secondIndex += 1) {
        const first = layers[firstIndex];
        const second = layers[secondIndex];
        const overlap = overlapRatio(first.lo, first.hi, second.lo, second.hi);
        if (overlap < 0.35) continue;
        const dynamicOverlap = Math.min(first.dynamic, second.dynamic) / 8;
        const sameFamily = byLayer[first.id]?.instruments[0]?.family === byLayer[second.id]?.instruments[0]?.family;
        const priorityDifference = Math.abs(first.priority - second.priority);
        const severityScore = overlap * dynamicOverlap * (sameFamily ? 1.18 : 0.86) * (priorityDifference >= 2 ? 0.72 : 1);
        if (severityScore >= 0.2) {
          diagnostics.push({
            severity: severityScore >= 0.4 ? "warn" : "info",
            layerIds: [first.id, second.id],
            title: "音区重叠",
            detail: ROLE_LABELS[first.role] + "与" + ROLE_LABELS[second.role] + "共享 " + Math.round(overlap * 100) + "% 的音区" + (sameFamily ? "，且组别相同" : "") + "。先移动八度或错开节奏。"
          });
        }
      }
    }

    for (const plan of layerPlans) {
      if (!plan.instruments.length) {
        diagnostics.push({ severity: "warn", layerIds: [plan.layerId], title: "没有可用乐器", detail: plan.roleLabel + "在当前编制中没有找到合适音区；需要换八度或扩大编制。" });
        continue;
      }
      for (const assignment of plan.instruments) {
        const instrument = INSTRUMENT_MAP[assignment.instrumentId];
        if (!instrument || instrument.id === "percussion") continue;
        const comfort = comfortableRatio(assignment.soundingLow, assignment.soundingHigh, instrument);
        if (comfort < 0.45) {
          diagnostics.push({ severity: "warn", layerIds: [plan.layerId], title: "音区边缘", detail: assignment.instrument + "承担" + plan.roleLabel + "时仅 " + Math.round(comfort * 100) + "% 位于舒适音区；核对力度与音准。" });
        }
        if (plan.density >= 4 && instrument.agility <= 2) {
          diagnostics.push({ severity: "warn", layerIds: [plan.layerId], title: "敏捷度不足", detail: assignment.instrument + "的敏捷度较低，不适合当前高事件密度。" });
        }
        if (plan.role === "pedal" && instrument.sustain < 3) {
          diagnostics.push({ severity: "warn", layerIds: [plan.layerId], title: "持续能力不足", detail: assignment.instrument + "不适合承担长踏板音。" });
        }
      }
    }

    const melody = layerPlans.find((plan) => plan.role === "melody");
    if (melody && melody.instruments.length > 2) {
      diagnostics.push({ severity: "info", layerIds: [melody.layerId], title: "旋律层重复过多", detail: "旋律已分配给 " + melody.instruments.length + " 个声部；确认每层都在增加所需响度贡献，未与伴奏争夺同一频带。" });
    }
    if (style.id === "thick" && ensemble.ids.length < 16) {
      diagnostics.push({ severity: "info", layerIds: [], title: "编制限制", detail: "当前编制较小，扩展方案会自动减少可用声部；不要把结果当作完整大型乐队。" });
    }
    if (goal.weight >= 0.8 && allAssignments.filter((item) => item.family === "brass").length >= 2) {
      diagnostics.push({ severity: "info", layerIds: [], title: "铜管权重", detail: "已有两个以上铜管组参与；复核高音木管与弦乐旋律是否仍能穿过。" });
    }
    return diagnostics;
  }

  function analyze(input) {
    const normalized = {
      goal: GOALS[input.goal] ? input.goal : "blended",
      ensemble: ENSEMBLES[input.ensemble] ? input.ensemble : "classical",
      layers: Array.isArray(input.layers) && input.layers.length ? input.layers : PRESETS[0].layers
    };
    return {
      input: normalized,
      plans: PLAN_STYLES.map((style) => buildPlan(normalized, style))
    };
  }

  function planToMarkdown(result) {
    const lines = [];
    const goal = GOALS[result.input.goal];
    lines.push("# 配器推演： " + goal.label);
    lines.push("");
    lines.push("编制： " + (ENSEMBLES[result.input.ensemble]?.label || "未知"));
    lines.push("");
    for (const plan of result.plans) {
      lines.push("## " + plan.label);
      lines.push(plan.description);
      lines.push("");
      for (const layer of plan.layers) {
        lines.push("### " + layer.roleLabel + "（" + layer.rangeLabel + "，" + layer.dynamic + "）");
        lines.push("- 写法： " + layer.doubling);
        for (const assignment of layer.instruments) {
          const shift = assignment.octaveShift === 0 ? "" : "，移 " + (assignment.octaveShift > 0 ? "+" : "") + assignment.octaveShift + " 半音";
          lines.push("- " + assignment.instrument + "（" + assignment.familyLabel + shift + "）：" + assignment.reason);
        }
        lines.push("");
      }
      if (plan.diagnostics.length) {
        lines.push("### 检查");
        for (const item of plan.diagnostics) lines.push("- [" + item.severity + "] " + item.title + "：" + item.detail);
        lines.push("");
      }
    }
    lines.push("> 规则推演只生成候选方案；所有音区与力度仍需回到实际总谱和试奏核对。");
    return lines.join("\n");
  }

  const exports = {
    PLAN_STYLES, midiToName, midiToFrequency, dynamicName, overlapRatio, comfortableRatio,
    analyze, planToMarkdown
  };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  root.OrchestrationEngine = exports;
})(typeof window !== "undefined" ? window : globalThis);
