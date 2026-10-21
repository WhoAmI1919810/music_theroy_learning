#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "glossary", "terms.json");

function loadScript(relativePath, globalNames) {
  const filename = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const sandbox = {
    console,
    module: { exports: {} },
    exports: {},
    window: {},
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename });
  if (sandbox.module.exports && Object.keys(sandbox.module.exports).length) {
    return sandbox.module.exports;
  }
  for (const name of globalNames) {
    if (sandbox[name] && Object.keys(sandbox[name]).length) return sandbox[name];
  }
  throw new Error("Unable to load data from " + relativePath);
}

const harmony = loadScript("harmony_atlas/app/js/theory-data.js", ["HarmonyData"]);
const counterpoint = loadScript("counterpoint_atlas/app/data/theory-data.js", ["CounterpointData"]);
const orchestration = loadScript("orchestration_atlas/app/data/theory-data.js", ["OrchestrationData"]);
const form = JSON.parse(fs.readFileSync(path.join(ROOT, "form_atlas", "evidence", "theory.json"), "utf8"));

const SUBJECTS = [
  {
    id: "harmony",
    label: "和声",
    en: "Harmony",
    description: "调式、和弦、功能、声部进行、终止、转调与后调性材料。",
    app: "../harmony_atlas/app/",
    manual: "../harmony_atlas/docs/和声学手册.html",
    groups: [
      ["pitch", "调式、音阶与音级"],
      ["chord", "和弦类型"],
      ["function", "功能、声部与不协和"],
      ["cadence", "终止式"],
      ["progression", "常见和声进行"],
      ["chromatic", "半音化与离调"],
      ["modulation", "转调与色彩"],
      ["posttonal", "后调性组织"],
      ["structure", "结构延长与分析"],
    ],
  },
  {
    id: "form",
    label: "曲式",
    en: "Form",
    description: "材料与句法、终止、结构过程、曲式类型、段落功能与结构原则。",
    app: "../form_atlas/app/",
    manual: "../form_atlas/docs/曲式学手册.html",
    groups: [
      ["material", "材料与句法"],
      ["closure", "终止与闭合"],
      ["process", "结构过程与调性"],
      ["types", "曲式类型"],
      ["section", "段落功能"],
      ["principle", "结构原则"],
      ["analysis", "分析概念"],
    ],
  },
  {
    id: "orchestration",
    label: "配器",
    en: "Orchestration",
    description: "声学、乐器能力、结构层、组合方式、平衡、时间过程、历史风格与总谱实现。",
    app: "../orchestration_atlas/app/",
    manual: "../orchestration_atlas/docs/配器法手册.html",
    groups: [
      ["layers", "分析层级"],
      ["layer-acoustics", "声学与听觉"],
      ["layer-instrument", "乐器能力与记谱"],
      ["layer-structure", "结构分析与角色"],
      ["layer-combination", "加倍、分部与排列"],
      ["layer-balance", "平衡、掩蔽与织体"],
      ["layer-time", "时间过程与全奏"],
      ["layer-notation", "历史风格与总谱"],
      ["history", "历史编制"],
    ],
  },
  {
    id: "counterpoint",
    label: "复调",
    en: "Counterpoint",
    description: "对位语法、五类对位、卡农、赋格结构、历史阶段与现当代扩展。",
    app: "../counterpoint_atlas/app/",
    tutorial: "../counterpoint_atlas/tutorial/",
    manual: "../counterpoint_atlas/docs/复调音乐手册.html",
    groups: [
      ["basics", "对位语法"],
      ["species", "五类对位"],
      ["canon", "卡农"],
      ["fugue", "赋格结构"],
      ["history", "历史与现当代语法"],
    ],
  },
];

const subjectById = new Map(SUBJECTS.map((subject) => [subject.id, subject]));
const terms = [];
const ids = new Set();
const coverage = new Map();

function slug(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanProse(value) {
  return String(value)
    .replace("20 世纪并非只有“无调性”：", "20 世纪包括“无调性”及其他写法：")
    .replace("其价值不在长度，而在", "其价值来自");
}

function add(subjectId, groupId, key, title, definition, options = {}) {
  const subject = subjectById.get(subjectId);
  if (!subject) throw new Error("Unknown subject: " + subjectId);
  if (!subject.groups.some(([id]) => id === groupId)) {
    throw new Error("Unknown group " + subjectId + "/" + groupId);
  }
  const id = subjectId + "-" + slug(key);
  if (ids.has(id)) throw new Error("Duplicate term id: " + id);
  ids.add(id);
  const term = {
    id,
    subject: subjectId,
    group: groupId,
    title: String(title).trim(),
    en: String(options.en || "").trim(),
    aliases: Array.from(new Set((options.aliases || []).map((item) => String(item).trim()).filter((item) => item && item !== String(title).trim()))),
    definition: cleanProse(definition).trim(),
    note: cleanProse(options.note || "").trim(),
    see: options.see || [],
  };
  if (!term.title || !term.definition) throw new Error("Incomplete term: " + id);
  terms.push(term);
  for (const sourceKey of options.coverage || []) coverage.set(sourceKey, term.id);
  return term;
}

function requireCoverage(prefix, items, idOf) {
  const missing = items.filter((item) => !coverage.has(prefix + ":" + idOf(item)));
  if (missing.length) {
    throw new Error("Glossary missed " + prefix + ": " + missing.map(idOf).join(", "));
  }
}

function parentheticalName(value) {
  const match = String(value).match(/（([^）]+)）/);
  return match && /^[A-Za-z .'-]+$/.test(match[1]) ? match[1] : "";
}

const intervalNames = {
  0: "根音",
  1: "小二度",
  2: "大二度",
  3: "小三度",
  4: "大三度",
  5: "纯四度",
  6: "减五度",
  7: "纯五度",
  8: "小六度",
  9: "大六度",
  10: "小七度",
  11: "大七度",
  13: "小九度",
  14: "大九度",
  15: "小十度",
  17: "纯十一度",
};

for (const mode of harmony.MODES) {
  const scaleFunctions = mode.degrees.map((degree, index) => degree + " " + mode.functionNotes[index]).join("；");
  add("harmony", "pitch", "mode-" + mode.id, mode.name, "音阶结构与音级功能：" + mode.mood + "。", {
    en: parentheticalName(mode.name),
    aliases: [mode.short],
    note: "音级功能：" + scaleFunctions + "。",
    coverage: ["harmony.mode:" + mode.id],
  });
}

for (const quality of Object.values(harmony.QUALITIES)) {
  const intervals = quality.intervals.map((number) => intervalNames[number] || number + " 个半音").join("、");
  add("harmony", "chord", "quality-" + quality.id, quality.name, "包含" + intervals + "。", {
    aliases: quality.symbol ? [quality.symbol] : [],
    note: quality.seventh ? "七和弦类。" : "三和弦、挂留或加音和弦。",
    coverage: ["harmony.quality:" + quality.id],
  });
}

for (const cadence of harmony.CADENCES) {
  add("harmony", "cadence", "cadence-" + cadence.id, cadence.name, cadence.rule, {
    note: "进行：" + cadence.formula + "；功能：" + cadence.function + "。",
    coverage: ["harmony.cadence:" + cadence.id],
  });
}

for (const recipe of harmony.RECIPES) {
  add("harmony", "progression", "recipe-" + recipe.id, recipe.name, recipe.note, {
    note: "常见变体：" + recipe.variants.join("；") + "。",
    coverage: ["harmony.recipe:" + recipe.id],
  });
}

for (const recipe of harmony.MODULATION_RECIPES) {
  const title = recipe.id === "enharmonic" ? recipe.name + "：操作步骤" : recipe.name;
  add("harmony", "modulation", "modulation-" + recipe.id, title, recipe.principle, {
    note: "步骤：" + recipe.steps.join("；") + "。",
    coverage: ["harmony.modulation:" + recipe.id],
  });
}

const harmonyGroupByLayer = {
  0: { interval: "pitch", scale: "pitch", triad: "chord" },
  1: { diatonic: "function", dominant: "function", voiceLeading: "function", inversion: "function", seventh: "function", cadence: "cadence" },
  2: { sequence: "chromatic", secondaryDominant: "chromatic", tonicization: "chromatic", modalInterchange: "chromatic", neapolitan: "chromatic", aug6: "chromatic", dim7: "chromatic", chromaticism: "chromatic" },
  3: { pivot: "modulation", modulation: "modulation", enharmonicModulation: "modulation", colorHarmony: "modulation", functionNetwork: "modulation" },
  4: { setTheory: "posttonal", symmetry: "posttonal", atonal: "posttonal", serialism: "posttonal" },
  5: { prolongation: "structure", form: "structure" },
};

for (const node of harmony.THEORY_MAP) {
  const group = harmonyGroupByLayer[node.layer] && harmonyGroupByLayer[node.layer][node.id];
  if (!group) throw new Error("Unmapped harmony theory node: " + node.id);
  add("harmony", group, "theory-" + node.id, node.title, node.principle, {
    note: "应用：" + node.applications.join("；") + "。",
    coverage: ["harmony.theory:" + node.id],
  });
}

for (const period of harmony.PERIODS) {
  add("harmony", "structure", "period-" + period.id, period.name, period.tagline + "。" + period.note, {
    aliases: [period.short],
    note: "时间范围：" + period.span + "。",
    coverage: ["harmony.period:" + period.id],
  });
}

const harmonyCurated = [
  ["pitch", "mode", "调式", "以主音、音阶结构和音级关系组织音高材料的系统；同一主音可以对应多种调式。", { en: "Mode" }],
  ["pitch", "key", "调性", "以主音或主和弦为稳定中心，并由功能、终止与音高材料共同建立的音高组织。", { en: "Tonality" }],
  ["pitch", "pitch-class", "音级", "忽略八度位置后得到的十二个音高类别，用 0–11 表示；音名拼写仍保留功能信息。", { en: "Pitch class" }],
  ["function", "tonic-function", "主功能", "以主和弦及主音稳定为中心的功能力量，记作 T；收束与回归通常由它完成。", { en: "Tonic function", aliases: ["T"] }],
  ["function", "subdominant-function", "下属功能", "推动音乐离开主中心、预备属功能的功能力量，记作 S；ii、IV 及其变体常承担这一功能。", { en: "Subdominant function", aliases: ["S"] }],
  ["function", "dominant-function", "属功能", "以属和弦、导音和属七和弦的倾向性推动回到主的功能，记作 D。", { en: "Dominant function", aliases: ["D"] }],
  ["function", "color-function", "色彩功能", "由调式特征音、和弦结构、音区或音色建立的和声作用，记作 C；它不一定服从 T–S–D 的单一方向。", { en: "Color function", aliases: ["C"] }],
  ["function", "tendency-tone", "倾向音", "在特定调性语法中具有固定解决方向的音，例如属七的导音向上、七音向下。", { en: "Tendency tone" }],
  ["function", "voice-leading", "声部进行", "各声部从一音或一和弦移动到下一音或下一和弦的横向轨迹，包括级进、跳进、共同音保持与解决。", { en: "Voice leading" }],
  ["function", "parallel-fifth", "平行五度", "两个声部从纯五度同向进行到另一个纯五度；连续空五度会削弱声部独立性。", { en: "Parallel fifths" }],
  ["function", "parallel-octave", "平行八度", "两个声部从八度或同度同向进行到另一个八度或同度；连续完全协和会让声部合并。", { en: "Parallel octaves" }],
  ["function", "hidden-fifth-octave", "隐伏五度与八度", "外声部同向跳进后进入纯五度或八度，且高声部为跳进；是否受限取决于风格与前后条件。", { en: "Hidden fifths and octaves" }],
  ["function", "nonchord-tone", "和弦外音", "不属于当前和弦结构的音，由经过、辅助、延留、先现等方式连接和弦音。", { en: "Non-chord tone" }],
  ["function", "passing-tone", "经过音", "在两个不同的和弦音之间级进经过的非和弦音，通常位于弱拍或弱位。", { en: "Passing tone" }],
  ["function", "neighbor-tone", "辅助音", "从和弦音级进离开后回到同一和弦音的非和弦音，分为上辅助音与下辅助音。", { en: "Neighbor tone" }],
  ["function", "suspension", "延留音", "前一和弦的音延续到后一和弦形成不协和，再级进解决；需要预备、延留与解决三个阶段。", { en: "Suspension" }],
  ["function", "anticipation", "先现音", "后一和弦的音提前出现在前一和弦中，通常作为弱拍装饰。", { en: "Anticipation" }],
  ["modulation", "tonicization", "离调", "短暂把某一和弦当作临时主音，通过副属、副下属或临时终止建立局部中心，随后回到原调。", { en: "Tonicization" }],
  ["modulation", "modulation-term", "转调", "在新调建立稳定中心，并由新调终止或持续功能确认；它与短暂离调的差别在确认程度与结构层级。", { en: "Modulation" }],
  ["modulation", "near-related-key", "近关系调", "调号相差一个升降号以内、或与主调共享主要功能和弦的调，常用于共同实践时期的转调。", { en: "Closely related key" }],
  ["modulation", "remote-key", "远关系调", "与当前调缺少直接共同功能和弦、需要中介、等音或色彩关系连接的调。", { en: "Remote key" }],
];

for (const [group, key, title, definition, options] of harmonyCurated) {
  add("harmony", group, key, title, definition, options);
}

requireCoverage("harmony.mode", harmony.MODES, (item) => item.id);
requireCoverage("harmony.quality", Object.values(harmony.QUALITIES), (item) => item.id);
requireCoverage("harmony.cadence", harmony.CADENCES, (item) => item.id);
requireCoverage("harmony.recipe", harmony.RECIPES, (item) => item.id);
requireCoverage("harmony.modulation", harmony.MODULATION_RECIPES, (item) => item.id);
requireCoverage("harmony.theory", harmony.THEORY_MAP, (item) => item.id);
requireCoverage("harmony.period", harmony.PERIODS, (item) => item.id);

for (const period of counterpoint.PERIODS) {
  add("counterpoint", "history", "period-" + period.id, period.label, period.shift, {
    note: period.years + "。" + period.problem,
    coverage: ["counterpoint.period:" + period.id],
  });
}

for (const species of counterpoint.SPECIES) {
  add("counterpoint", "species", "species-" + species.id, species.num + "：" + species.title, species.rule, {
    note: species.why,
    coverage: ["counterpoint.species:" + species.id],
  });
}

for (const canon of counterpoint.CANON_TYPES) {
  const definitions = {
    inversion: "应句把主句的旋律方向围绕轴音反向进行；轴音决定哪些音程保持不变。",
    augmentation: "应句把主句的节奏时值按固定比例扩大或缩小，形成时间尺度上的变形。",
  };
  add("counterpoint", "canon", "canon-" + canon.id, canon.title, definitions[canon.id] || canon.formula, {
    note: canon.note,
    coverage: ["counterpoint.canon:" + canon.id],
  });
}

for (const part of counterpoint.FUGUE_PARTS) {
  add("counterpoint", "fugue", "fugue-" + part.id, part.title, part.test, {
    note: "判断问题：" + part.question,
    coverage: ["counterpoint.fugue:" + part.id],
  });
}

const counterpointCurated = [
  ["basics", "counterpoint", "对位", "两个或多个旋律线同时进行时，由横向方向、纵向音程、节拍位置和解决关系共同形成的写作语法。", { en: "Counterpoint" }],
  ["basics", "species-counterpoint", "分类对位", "按固定调与对位声部的节奏比例分级训练的严格对位方法，从一音对一音推进到混合节奏。", { en: "Species counterpoint" }],
  ["basics", "cantus-firmus", "固定调", "作为对位写作骨架的既有旋律，通常按全音符或较长时值陈述，其他声部围绕它组织音程与解决。", { en: "Cantus firmus" }],
  ["basics", "strict-counterpoint", "严格对位", "以教会调式、分类节奏和协和音程等级为核心的对位训练语法。", { en: "Strict counterpoint" }],
  ["basics", "free-counterpoint", "自由对位", "以大小调功能和声为底层，不协和按和弦外音、七和弦与离调解释的对位语法。", { en: "Free counterpoint" }],
  ["basics", "imitation", "模仿", "后一声部重复前一声部材料的写法；重复可以改变音程、时值、方向或进入时间。", { en: "Imitation" }],
  ["basics", "invertible-counterpoint", "复对位", "两条或更多旋律交换上下位置后仍能成立的对位组合；转位音程需预先计算。", { en: "Invertible counterpoint" }],
  ["basics", "interval-inversion", "音程转位", "把下方音移高八度或上方音移低八度后得到的新音程；原音程与转位音程的度数相加为九。", { en: "Interval inversion" }],
  ["basics", "consonance", "协和音程", "在特定对位语法中可以作为独立结构音的音程；严格二声部对位以三度、六度、五度和八度为主要协和音程。", { en: "Consonance" }],
  ["basics", "dissonance", "不协和音程", "需要经过、辅助、延留或解决处理的音程；其合法性取决于节拍位置和前后运动。", { en: "Dissonance" }],
  ["basics", "passing-tone-cp", "经过音", "在两个不同音之间级进经过的弱拍音，用来填充旋律运动。", { en: "Passing tone" }],
  ["basics", "neighbor-tone-cp", "辅助音", "离开结构音后级进返回同一结构音的弱拍音。", { en: "Neighbor tone" }],
  ["basics", "suspension-cp", "延留音", "前一拍预备为协和音，跨过和声变化后在强拍形成不协和，并通常下行级进解决。", { en: "Suspension" }],
  ["basics", "anticipation-cp", "先现音", "后一和声的音提前进入前一拍，形成弱拍不协和或节奏连接。", { en: "Anticipation" }],
  ["basics", "parallel-fifth-cp", "平行五度", "两声部连续同向进入纯五度；严格对位逐对发声音符检查，不只看每拍首音。", { en: "Parallel fifths" }],
  ["basics", "parallel-octave-cp", "平行八度", "两声部连续同向进入八度或同度；完全协和连续出现会让声部失去独立性。", { en: "Parallel octaves" }],
  ["basics", "hidden-perfect-cp", "隐伏五度与八度", "外声部同向跳进进入纯五度或八度；严格写作中需要结合旋律方向与前后音程判断。", { en: "Hidden fifths and octaves" }],
  ["basics", "voice-crossing", "声部超越", "一个声部越过相邻声部后继续停留在其另一侧，导致声部顺序改变。", { en: "Voice crossing" }],
  ["basics", "voice-overlap", "声部交错", "后一音越过相邻声部前一音的位置，造成短暂交叠。", { en: "Voice overlap" }],
  ["canon", "canon", "卡农", "同一主句按固定时间差和音程关系被后续声部模仿，并可叠加变形、重复轮次与更多声部。", { en: "Canon" }],
  ["fugue", "fugue", "赋格", "以一个主题在多个声部依次进入为基础，通过答题、对题、间插段、中间部、密接和应和再现组织全曲的复调体裁。", { en: "Fugue" }],
  ["fugue", "real-answer", "真实答题", "把主题严格移位到属方向，保留主题全部音程的答题。", { en: "Real answer" }],
  ["fugue", "tonal-answer", "守调答题", "在主题越过主属边界处调整音程，使答题继续留在主调范围内的答题。", { en: "Tonal answer" }],
  ["history", "linear-counterpoint", "线性对位", "以各线条的旋律完整、音程关系和音区分离为主要组织手段，功能和声不承担唯一约束。", { en: "Linear counterpoint" }],
  ["history", "polymodality", "多调性", "不同声部或层次同时围绕不同调中心组织音高，纵向关系由音程与材料协调。", { en: "Polytonality" }],
  ["history", "twelve-tone-cp", "十二音", "把十二个音级组织成序列，并通过原型、逆行、倒影与逆行倒影安排音高关系的复调材料。", { en: "Twelve-tone" }],
  ["history", "pitch-class-set-cp", "音级集合", "用无序音高类别及其移位、倒影、补集和音程向量描述无调性音高关系的分析单位。", { en: "Pitch-class set" }],
  ["history", "timbre-layering", "音色分层", "用不同音色、音区和发音法划分同时进行的线条，使音色成为可听辨的结构参数。", { en: "Timbre layering" }],
];

for (const [group, key, title, definition, options] of counterpointCurated) {
  add("counterpoint", group, key, title, definition, options);
}

requireCoverage("counterpoint.period", counterpoint.PERIODS, (item) => item.id);
requireCoverage("counterpoint.species", counterpoint.SPECIES, (item) => item.id);
requireCoverage("counterpoint.canon", counterpoint.CANON_TYPES, (item) => item.id);
requireCoverage("counterpoint.fugue", counterpoint.FUGUE_PARTS, (item) => item.id);

for (const layer of orchestration.LAYERS) {
  add("orchestration", "layers", "layer-" + layer.id, layer.label, "配器分析层级：" + layer.question, {
    coverage: ["orchestration.layer:" + layer.id],
  });
}

for (const node of orchestration.NODES) {
  add("orchestration", "layer-" + node.layer, "node-" + node.id, node.label, node.short, {
    note: node.principle,
    coverage: ["orchestration.node:" + node.id],
  });
}

for (const period of orchestration.PERIODS) {
  add("orchestration", "history", "period-" + period.id, period.label, period.summary, {
    note: period.range + "。" + period.changes.join("；") + "。",
    coverage: ["orchestration.period:" + period.id],
  });
}

const orchestrationCurated = [
  ["layers", "orchestration", "配器", "把音高材料、结构层、乐器能力、音区、响度、音色与演奏条件分配到具体乐器组合的写作与检查过程。", { en: "Orchestration", aliases: ["管弦乐法"] }],
  ["layer-acoustics", "fundamental", "基频", "周期性振动的最低频率，决定听到的基本音高；泛音位于其整数倍附近。", { en: "Fundamental frequency" }],
  ["layer-acoustics", "harmonic", "谐波", "基频整数倍附近的频率成分，其相对强度影响音色与融合。", { en: "Harmonic" }],
  ["layer-acoustics", "formant", "共振峰", "乐器或声道共振形成的频率能量峰，强化特定频带并影响元音感、音色与穿透力。", { en: "Formant" }],
  ["layer-acoustics", "noise-component", "噪声成分", "气流、弓噪、槌击等非周期成分，常集中在起音或特殊演奏法中。", { en: "Noise component" }],
  ["layer-acoustics", "equal-loudness", "等响曲线", "描述不同频率在同一声压级下听感响度差异的曲线；音区改变时，平衡判断也要改变。", { en: "Equal-loudness contour" }],
  ["layer-acoustics", "critical-band", "临界频带", "听觉频率分辨率的一段范围；相近频率落在同一临界带内时更容易互相掩蔽。", { en: "Critical band" }],
  ["layer-instrument", "written-pitch", "记谱音高", "移调乐器谱面上写出的音高，与实际发声音高相差固定音程。", { en: "Written pitch" }],
  ["layer-instrument", "sounding-pitch", "实际发声音高", "乐器发声后到达听者的真实音高，配器中的音区、间距与掩蔽判断以此为准。", { en: "Sounding pitch" }],
  ["layer-instrument", "breath", "换气", "管乐演奏者重新吸气的位置；乐句长度、力度和音区消耗共同决定可行间隔。", { en: "Breath" }],
  ["layer-instrument", "bowing", "换弓与弓法", "弦乐通过弓段、弓速、弓压和换弓方向控制起音、持续与力度；写法需要给换弓留出位置。", { en: "Bowing" }],
  ["layer-instrument", "mute", "弱音器", "附加在乐器上改变振动与辐射的装置，通常削弱高频、改变瞬态与音量。", { en: "Mute" }],
  ["layer-instrument", "vibrato", "揉弦", "通过周期性改变音高或张力形成的波动，影响持续音的色彩、融合与表现。", { en: "Vibrato" }],
  ["layer-notation", "part-extraction", "分谱", "从总谱提取给各演奏者使用的独立声部，需要检查移调、休止、换页、换气和分句。", { en: "Part extraction" }],
  ["layer-notation", "piano-reduction", "缩谱", "把总谱压缩到钢琴或少量谱表用于排练与核对；缩谱上的可行写法仍需回到实际乐器检查。", { en: "Piano reduction" }],
  ["layer-balance", "texture", "织体", "同时发声的结构层、音区占用、节奏密度与音色分工形成的整体组织。", { en: "Texture" }],
];

for (const [group, key, title, definition, options] of orchestrationCurated) {
  add("orchestration", group, key, title, definition, options);
}

requireCoverage("orchestration.layer", orchestration.LAYERS, (item) => item.id);
requireCoverage("orchestration.node", orchestration.NODES, (item) => item.id);
requireCoverage("orchestration.period", orchestration.PERIODS, (item) => item.id);

const formNodesById = new Map(form.nodes.map((node) => [node.id, node]));
const formTitles = new Set(form.forms.map((item) => item.label));
const formNodeGroup = {
  material: "material",
  closure: "closure",
  process: "process",
};

for (const node of form.nodes) {
  if (formTitles.has(node.label)) continue;
  const group = formNodeGroup[node.layer];
  if (!group) throw new Error("Unmapped form node layer: " + node.id);
  add("form", group, "node-" + node.id, node.label, node.summary, {
    en: node.en,
    note: "判断问题：" + node.question,
    coverage: ["form.node:" + node.id],
  });
}

for (const item of form.forms) {
  add("form", "types", "form-" + item.id, item.label, item.definition, {
    en: item.en,
    aliases: item.short ? [item.short] : [],
    note: "判定：" + item.tests.join("；") + "。",
    coverage: ["form.form:" + item.id],
  });
  const matchingNode = form.nodes.find((node) => node.label === item.label);
  if (matchingNode) coverage.set("form.node:" + matchingNode.id, "form-form-" + slug(item.id));
}

for (const [index, principle] of form.principles.entries()) {
  add("form", "principle", "principle-" + (index + 1), principle.label, principle.effect, {
    note: "结构操作：" + principle.operation + "。",
    coverage: ["form.principle:" + principle.label],
  });
}

const formCurated = [
  ["material", "form", "曲式", "由材料身份、句法分组、终止层级、调性布局和段落比例共同形成的结构类型。", { en: "Form" }],
  ["material", "theme", "主题", "能建立作品或段落身份、并可供重复、变化、展开或回归的材料单位。", { en: "Theme" }],
  ["material", "phrase-member", "乐节", "乐句内部由材料分组、重音或和声节奏切出的较小句法单位。", { en: "Phrase member" }],
  ["material", "period-group", "复乐段", "由两个或更多乐段组合成更高一级句法单位的结构；各乐段通常形成呼应或并置。", { en: "Double period" }],
  ["material", "punctuation", "句读", "由材料停顿、和声终止、节奏收束和旋律落点共同形成的句法标点。", { en: "Phrase punctuation" }],
  ["closure", "perfect-cadence", "全终止", "由属到主并在主调形成稳定收束的终止，通常结束乐句、乐段或更大结构层级。", { en: "Authentic cadence" }],
  ["closure", "half-cadence", "半终止", "停在属功能或其他开放和弦上的终止，形成未完成感并保留后续继续。", { en: "Half cadence" }],
  ["closure", "plagal-cadence", "变格终止", "由下属到主的终止，常用于圣咏、尾声或强化主调色彩。", { en: "Plagal cadence" }],
  ["closure", "deceptive-cadence", "阻碍终止", "属和弦本应进入主和弦，却进入六级或其他替代和弦，从而推迟收束并扩展乐句。", { en: "Deceptive cadence" }],
  ["closure", "modulatory-cadence", "转调终止", "在新调中形成终止并确认新调，同时结束前一结构层级。", { en: "Modulatory cadence" }],
  ["closure", "false-cadence", "假终止", "出现类似终止的和声或停顿，但后续材料继续展开，收束层级并未真正完成。", { en: "False cadence" }],
  ["process", "sequence", "模进", "同一材料或和声型按固定音程、级数或节奏反复移位，形成方向明确的结构过程。", { en: "Sequence" }],
  ["process", "expansion", "扩充", "在句法单位内部通过重复、模进、阻碍或延长终止扩大篇幅，结构边界仍保持开放。", { en: "Expansion" }],
  ["process", "supplement", "补充", "结构已经闭合后追加的材料，用来加强终止、延长结束感或引入连接。", { en: "Supplement" }],
  ["process", "development", "展开", "把已有材料拆解、模进、转调、对位化或改变织体，使材料离开原始形态并建立张力。", { en: "Development" }],
  ["section", "exposition", "呈示部", "提出主要主题、建立主调与副部调性关系并完成段落闭合的结构部分。", { en: "Exposition" }],
  ["section", "development-section", "展开部", "以材料发展、调性不稳定和段落重组制造距离，为再现准备回归。", { en: "Development section" }],
  ["section", "recapitulation", "再现部", "主要材料回归，并通过调性服从把呈示部中分离的调性区域统一到主调。", { en: "Recapitulation" }],
  ["section", "main-theme", "主部", "奏鸣曲式中首先建立主调与主要材料的段落。", { en: "Principal theme group" }],
  ["section", "transition", "连接部", "在主部与副部之间完成材料过渡、调性转移并为副部准备新调的段落。", { en: "Transition" }],
  ["section", "subordinate-theme", "副部", "奏鸣曲式中与主部形成材料或调性对比的主题区域，再现时通常回到主调。", { en: "Subordinate theme group" }],
  ["section", "closing-section", "结束部", "呈示部或再现部中巩固副部调性、补充材料并完成段落闭合的部分。", { en: "Closing section" }],
  ["section", "trio", "三声中部", "复三部曲式中间段的常见类型，材料与织体较独立，常带有舞曲或进行性特征。", { en: "Trio" }],
  ["section", "episode", "插部", "回旋或复三部结构中位于主部之间的对比段落，材料通常不承担主部身份。", { en: "Episode" }],
  ["section", "introduction", "引子", "主题或主部出现之前的准备段落，用来建立调性、速度、气氛或材料线索。", { en: "Introduction" }],
  ["section", "coda", "尾声", "主要结构闭合之后用于总结、扩展终止或改变结构重心的结束段落。", { en: "Coda" }],
  ["analysis", "tonal-subordination", "调性服从", "奏鸣原则中副部在再现时回到主调，使呈示部的调性二分在再现部得到统一。", { en: "Tonal subordination" }],
  ["analysis", "false-recapitulation", "假再现", "主部材料在主调尚未真正回归时提前出现，用来延迟或强化真正的再现。", { en: "False recapitulation" }],
  ["analysis", "structural-level", "结构层级", "同一段落可以同时属于乐句、乐段、单曲式或复曲式的不同层级，判断需说明当前分析尺度。", { en: "Structural level" }],
  ["analysis", "arch-form", "拱形结构", "材料、调性或段落关系以中心为轴形成对称对应，常见 A–B–C–B′–A′。", { en: "Arch form" }],
  ["analysis", "symmetry-form", "对称结构", "段落、比例或调性关系围绕中心轴形成镜像或对应；判断需要核对两端材料与调性。", { en: "Symmetrical form" }],
];

for (const [group, key, title, definition, options] of formCurated) {
  add("form", group, key, title, definition, options);
}

requireCoverage("form.node", form.nodes, (item) => item.id);
requireCoverage("form.form", form.forms, (item) => item.id);
requireCoverage("form.principle", form.principles, (item) => item.label);

const termIds = new Set(terms.map((term) => term.id));
for (const term of terms) {
  term.see = term.see.filter((id) => termIds.has(id));
}

const requiredGroups = new Set();
for (const term of terms) requiredGroups.add(term.subject + "/" + term.group);
for (const subject of SUBJECTS) {
  for (const [groupId] of subject.groups) {
    if (!requiredGroups.has(subject.id + "/" + groupId)) {
      throw new Error("Empty glossary group: " + subject.id + "/" + groupId);
    }
  }
}

const output = {
  version: 1,
  scope: "四套理论系统中使用的理论概念、类型、技法与判定术语",
  subjects: SUBJECTS,
  terms,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log("glossary data: %d terms across %d subjects -> %s", terms.length, SUBJECTS.length, path.relative(ROOT, OUT));
