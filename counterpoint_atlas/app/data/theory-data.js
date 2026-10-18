(function (root) {
  "use strict";

  const PERIODS = [
    {
      id: "renaissance",
      label: "文艺复兴严格对位",
      years: "约 1450–1600",
      eyebrow: "模态 · 固定调 · 分类对位",
      problem: "没有功能和声作为兜底，两个声部要靠音程等级、节拍位置和解决方式直接组织纵向关系。",
      shift: "协和由音程类别决定；不协和必须出现在可解释的位置。纯四度在二声部中被当作不协和，五度与八度虽稳定，却会因连续进行而让声部失去独立性。",
      rules: [
        "首尾用完全协和确认终止；中段主要靠三度、六度获得可辨的声部。",
        "经过音、辅助音放在弱拍；延留音从弱拍预备，在强拍形成不协和，再下行级进解决。",
        "平行五度、平行八度按实际发声音程逐对检查，不只看每拍第一个音。"
      ],
      techniques: ["五类对位", "固定调", "单对位", "八/十/十二度复对位", "严格卡农"],
      caution: "严格对位是约束训练，覆盖文艺复兴对位的基本语法；作品还会使用装饰、节奏与终止上的自由。",
      claims: ["hist.style-system", "species.first-boundaries", "species.second-passing", "species.fourth-suspension"],
      manual: "periods"
    },
    {
      id: "baroque",
      label: "巴洛克自由对位与赋格",
      years: "约 1600–1750",
      eyebrow: "大小调 · 功能和声 · 主题展开",
      problem: "低音和声成为骨架，对位声部必须同时服从旋律独立与功能进行。赋格要把一个主题变成整首曲子的结构。",
      shift: "“自由”对位让不协和按和弦外音、延留、七和弦与离调来解释。主题、答题、对题、间插段和持续音形成可扩展的调性结构。",
      rules: [
        "答题通常把主题移高五度或移低四度；守调答题只改会越过主属边界的位置。",
        "呈示部完成所有声部的主题/答题进入；中间部用关系调、下属方向和间插段展开。",
        "密接和应让主题在未结束时再次进入；持续音把属到主的结构支点拉长。"
      ],
      techniques: ["主题/答题/对题", "呈示部", "间插段", "中间部", "密接和应", "持续音", "二重赋格"],
      caution: "真实答题与守调答题取决于主题是否包含主属冲突、是否转调。",
      claims: ["hist.tonal-basis", "fugue.answer-dominant", "fugue.tonal-answer", "fugue.exposition-order", "fugue.stretto-definition"],
      manual: "periods"
    },
    {
      id: "romantic",
      label: "古典—浪漫时期的复调化",
      years: "约 1750–1900",
      eyebrow: "奏鸣曲 · 卡农 · 赋格引用",
      problem: "复调不再只属于独立赋格或教会调式作品，而要在奏鸣曲、交响曲、室内乐与歌剧中承担动机发展和结构连接。",
      shift: "严格复对位被系统化为教材与可转位练习，同时作曲家把卡农、赋格、倒影和密接嵌入主调织体。半音化扩展和声，但声部解决仍重要。",
      rules: [
        "可转位写作从“纸面交换”变成结构手段：同一对素材可在再现中交换音区与功能。",
        "赋格常作为乐章、展开段或局部段落出现，未必从头到尾保持独立赋格体裁。",
        "卡农与密接不仅制造统一，也能通过叠加、延迟和音区差制造高潮。"
      ],
      techniques: ["动机贯穿", "复调化织体", "可转位对位", "卡农式展开", "赋格段"],
      caution: "不要把十九世纪作品里的每一条对位线都按分类对位的强弱拍规则判错；功能和声与非和弦音语法已经改变。",
      claims: ["hist.strict-training", "invert.definition", "canon.delay", "fugue.recap"],
      manual: "periods"
    },
    {
      id: "modern",
      label: "二十世纪以来的现代对位",
      years: "约 1900–今",
      eyebrow: "线条 · 音阶集合 · 不协和解放",
      problem: "功能和声不再是共同语法后，纵向协和、解决方向与调性中心都可以重新定义。复调仍要靠线条、音程与结构组织。",
      shift: "五度可以与八度不再同权；平行五度可被允许，不协和未必需要解决。音阶集合、十二音、多调性与音色分层成为新的约束系统。",
      rules: [
        "先确定音高材料：五声、七声、九声、十一声音阶、全音阶、十二音或音级集合。",
        "再确定哪些音程需要解决、哪些可以独立；不要直接套用巴洛克规则。",
        "线条形态、声部交错、音区分离与节奏独立仍决定复调是否可听辨。"
      ],
      techniques: ["线性对位", "平行音程", "多调性", "十二音", "音级集合", "音色分层"],
      caution: "米德尔顿允许平行五度；八度限制、音阶材料与作品内部规则仍可能更严。",
      claims: ["modern.parallels", "modern.intervals", "modern.scale", "modern.linear"],
      manual: "modern"
    }
  ];

  const SPECIES = [
    {
      id: "first",
      num: "第一类",
      title: "一音对一音",
      ratio: "1 : 1",
      rule: "每个固定调音对一个小节级或同级的对位音；所有纵向音程都必须是协和音程；首尾用完全协和确认调性。",
      why: "一音对一时没有经过音可以缓冲，任何不协和都会直接成为结构音。纯四度在二声部中缺乏三度、六度的填充，因此归入不协和。",
      strong: "每个音都是结构音，必须协和。",
      weak: "不存在弱拍经过音；所有音都要按和声检查。",
      checks: ["平行五度/八度", "连续三个以上完全协和", "声部超越", "首尾终止"],
      claims: ["species.first-boundaries"],
      manual: "species-1"
    },
    {
      id: "second",
      num: "第二类",
      title: "一音对二音",
      ratio: "1 : 2",
      rule: "每小节第一个音是强拍结构音，后一个音可以是不协和，但必须是级进经过音或辅助音。",
      why: "节奏加快后，弱拍可以用旋律运动填满和声空隙；不协和因此从“结构音”降为“连接音”。",
      strong: "强拍必须协和。",
      weak: "弱拍可经过/辅助不协和；跳进到弱拍时应落在和弦音。",
      checks: ["强拍不协和", "弱拍不协和是否有级进前后", "实际发声音程的平行五/八度"],
      claims: ["species.second-passing"],
      manual: "species-2"
    },
    {
      id: "third",
      num: "第三类",
      title: "一音对四音",
      ratio: "1 : 4",
      rule: "每小节第一个音通常是结构音；其余音可由经过音、辅助音或和弦音组成，但不能让平行五/八度在相邻发声音符间出现。",
      why: "音符更密，和声节奏仍由固定调和小节首音决定；装饰音越自由，越需要检查相邻实际音程。",
      strong: "小节首音优先协和。",
      weak: "其余三音可作级进装饰；跳进落点要能和声解释。",
      checks: ["四个四分音符内的平行五/八度", "弱拍装饰是否级进", "一小节是否被读成两个和弦"],
      claims: ["species.third-parallels"],
      manual: "species-3"
    },
    {
      id: "fourth",
      num: "第四类",
      title: "切分音与延留",
      ratio: "syncopation",
      rule: "延留音先在弱拍作为和弦音出现，连线进入下一强拍；若在新和声上不协和，就必须向下级进解决。",
      why: "切分让同一音跨越和声变化。协和音变成不协和音时，张力来自和声改变；解决方向因此必须是下行级进。",
      strong: "强拍可协和，也可由延留音形成不协和；后者必须解决。",
      weak: "弱拍是预备或解决的位置，不能随意制造未准备的不协和。",
      checks: ["预备音是否为和弦音", "强拍延留是否下行级进解决", "链式延留是否每步合法"],
      claims: ["species.fourth-suspension"],
      manual: "species-4"
    },
    {
      id: "fifth",
      num: "第五类",
      title: "混合节奏",
      ratio: "mixed",
      rule: "合并前四类的音型。结构强拍仍要能读出和声，弱拍可用经过、辅助和延留；节奏重音不能每小节机械重复。",
      why: "第五类把多种不协和处理放在同一小节内。判断标准从单一节奏型转为：每个结构点是否有和声解释。",
      strong: "结构强拍仍优先协和。",
      weak: "根据所在节奏位置判断经过、辅助、延留或和弦音。",
      checks: ["强拍不协和", "节奏型连续重复", "整小节切分造成固定调空隙", "终止前的解决"],
      claims: ["species.fifth-rhythm"],
      manual: "species-5"
    }
  ];

  const CANON_TYPES = [
    { id: "interval", title: "音程卡农", formula: "应句 = 主句移高/移低固定音程", note: "非八度卡农常需调性调整，避免把旋律推入远关系。" },
    { id: "inversion", title: "倒影卡农", formula: "旋律围绕轴音反向", note: "轴音决定哪些音程保持不变、哪些会改变性质。" },
    { id: "retrograde", title: "逆行卡农", formula: "应句从主句末尾向开头复制", note: "节奏与和声必须从两端同时成立，写作难度高于同向卡农。" },
    { id: "augmentation", title: "扩大/缩小卡农", formula: "应句时值成倍扩大或缩小", note: "时值扩大后，原本弱拍的不协和可能落到强拍，必须重新检查。" },
    { id: "infinite", title: "无终卡农", formula: "结尾同时可作为开头的对位", note: "关键是最后一句既要接回开头，又要成为前一句的合法对位。" },
    { id: "double", title: "二重卡农", formula: "两条主句同时被两条应句模仿", note: "除横向卡农关系外，还要保证纵向可转位或可结合。" }
  ];

  const FUGUE_PARTS = [
    { id: "subject", title: "主题", question: "它是否短到能记住，又长到能成为完整乐思？", test: "首部动机清楚；调性明确；能承受答题、对题、紧接与变形。", manual: "fugue-subject" },
    { id: "answer", title: "答题", question: "主题的主属冲突是否需要守调调整？", test: "通常上五度/下四度；真实答题或守调答题；尾部是否回主调。", manual: "fugue-answer" },
    { id: "countersubject", title: "对题", question: "它能否在主题与答题之间保持节奏与音调对比？", test: "固定对题要与主题构成可转位组合；自由对题可只出现一次。", manual: "fugue-countersubject" },
    { id: "exposition", title: "呈示部", question: "所有声部是否都在主属范围内完成进入？", test: "二声部 T–A；三声部 T–A–T；四声部 T–A–T–A；可加补充进入。", manual: "fugue-exposition" },
    { id: "episode", title: "间插段", question: "它是否承担连接、模进或转调？", test: "材料来自主题/对题/小结尾；和声不稳定；结尾导入下一调。", manual: "fugue-episode" },
    { id: "middle", title: "中间部", question: "调性是否离开主属轴心，同时保持主题轮廓？", test: "完整主题进入与间插段交替；关系调、下属方向、远关系按篇幅安排。", manual: "fugue-middle" },
    { id: "stretto", title: "密接和应", question: "主题能否在未结束时叠入另一声部？", test: "进入间隔、音程、音区、调性都要设计；常在高潮或再现前出现。", manual: "fugue-stretto" },
    { id: "pedal", title: "持续音", question: "它是否在和弦音上开始并以和弦音结束？", test: "属持续加强回归；主持续确认收束；可在任何声部或形成持续和弦。", manual: "fugue-recap" },
    { id: "recap", title: "再现与尾声", question: "主调是否回归，材料是否获得总结？", test: "不原样重复；可改变声部顺序、对题、紧接、倒影、扩大或织体。", manual: "fugue-recap" },
    { id: "multiple", title: "多重赋格", question: "每个主题是否都能独立呈示并与其它主题结合？", test: "二重/三重主题通常先写成八度或其它音程的二/三重对位。", manual: "fugue-multiple" }
  ];

  const CF_PRESETS = [
    {
      id: "c-major-arch",
      label: "C 大调 · 拱形固定调",
      key: "C",
      mode: "major",
      scale: [0, 2, 4, 5, 7, 9, 11],
      notes: ["C4", "D4", "E4", "F4", "G4", "A4", "G4", "F4", "E4", "D4", "C4"]
    },
    {
      id: "d-dorian",
      label: "D 多利亚 · 级进固定调",
      key: "D",
      mode: "dorian",
      scale: [2, 4, 5, 7, 9, 11, 0],
      notes: ["D4", "E4", "F4", "G4", "A4", "B4", "A4", "G4", "F4", "E4", "D4"]
    },
    {
      id: "a-minor",
      label: "a 小调 · 下行固定调",
      key: "A",
      mode: "minor",
      scale: [9, 11, 0, 2, 4, 5, 7],
      notes: ["A4", "B4", "C5", "D5", "E5", "D5", "C5", "B4", "A4"]
    }
  ];

  const SUBJECT_PRESETS = [
    { id: "classic", label: "清晰级进型", notes: ["C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4", "C4"] },
    { id: "leaping", label: "跳进型", notes: ["C4", "G4", "E4", "A4", "G4", "D4", "E4", "C4"] },
    { id: "chromatic", label: "半音型", notes: ["C4", "D4", "Eb4", "E4", "F4", "Ab4", "G4", "C4"] },
    { id: "compact", label: "短小型", notes: ["C4", "Eb4", "F4", "G4", "Bb4", "G4", "C4"] }
  ];

  const CHECK_EXAMPLE = {
    soprano: "C5 D5 E5 F5 G5 F5 E5 D5 C5",
    alto: "E4 F4 G4 A4 B4 A4 G4 F4 E4"
  };

  const KEY_SIGNATURES = {
    C: { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], tonic: 0 },
    G: { major: [7, 9, 11, 0, 2, 4, 6], minor: [7, 9, 10, 0, 2, 3, 5], tonic: 7 },
    D: { major: [2, 4, 6, 7, 9, 11, 1], minor: [2, 4, 5, 7, 9, 10, 0], tonic: 2 },
    A: { major: [9, 11, 1, 2, 4, 6, 8], minor: [9, 11, 0, 2, 4, 5, 7], tonic: 9 },
    F: { major: [5, 7, 9, 10, 0, 2, 4], minor: [5, 7, 8, 10, 0, 1, 3], tonic: 5 },
    Bb: { major: [10, 0, 2, 3, 5, 7, 9], minor: [10, 0, 1, 3, 5, 6, 8], tonic: 10 },
    Eb: { major: [3, 5, 7, 8, 10, 0, 2], minor: [3, 5, 6, 8, 10, 11, 1], tonic: 3 }
  };

  const CLAIM_TITLES = {
    "hist.style-system": "对位规则依附于当时的调式与和声语言",
    "hist.strict-training": "严格复对位作为写作训练",
    "hist.tonal-basis": "巴洛克赋格以大小调功能和声为底层",
    "species.first-boundaries": "首尾完全协和，内部避免连续完全协和",
    "species.second-passing": "强拍协和，弱拍经过/辅助",
    "species.third-parallels": "按实际发声音程检查平行完全音程",
    "species.fourth-suspension": "预备—强拍不协和—下行级进解决",
    "species.fifth-rhythm": "混合节奏仍服从结构强拍",
    "invert.definition": "交换声部后和声仍成立",
    "invert.formula": "转位度数加一，再减原音程",
    "invert.fifth": "八度转位中五度变成四度",
    "invert.multiple": "同一对声部可服务多种转位",
    "canon.definition": "卡农是完全模仿",
    "canon.interval-adjust": "非八度卡农要作调性调整",
    "canon.process": "分段写卡农，不先写完主句",
    "canon.delay": "进入距离通常一到三小节",
    "canon.overlap": "紧接进入会压缩声部空间",
    "fugue.definition": "赋格的结构",
    "fugue.subject-identity": "主题必须可辨认、可重复、可发展",
    "fugue.subject-properties": "主题的调性、长度、音域与收束",
    "fugue.answer-dominant": "答题在属方向回答",
    "fugue.tonal-answer": "守调答题只改主属冲突处",
    "fugue.countersubject": "固定对题要构成可转位关系",
    "fugue.exposition-order": "呈示部按声部数交替进入",
    "fugue.exposition-principles": "所有声部出场并建立主属调性",
    "fugue.episode-definition": "间插段位于主题再进入之前",
    "fugue.episode-function": "间插段承担转调与动力",
    "fugue.middle": "中间部是主题进入与间插段交替",
    "fugue.stretto-definition": "密接和应是主题未结束就再次进入",
    "fugue.stretto-difference": "密接和应的结构位置",
    "fugue.recap": "再现以主调回归为骨架",
    "fugue.pedal": "持续音加强属到主的支点",
    "fugue.overall": "整体布局把主题进入与调性对齐",
    "fugue.multiple": "多重赋格每个主题都要独立",
    "fugue.bach-structure": "巴赫式赋格：起段、中段、结段",
    "fugue.subject-memory": "长度由可记忆与可处理共同决定",
    "modern.parallels": "现代对位可以允许平行五度",
    "modern.intervals": "音程选择服从音阶与语境",
    "modern.scale": "调性材料可扩张到十七声音阶",
    "modern.linear": "线条形态与声部独立仍优先"
  };

  const data = {
    PERIODS,
    SPECIES,
    CANON_TYPES,
    FUGUE_PARTS,
    CF_PRESETS,
    SUBJECT_PRESETS,
    CHECK_EXAMPLE,
    KEY_SIGNATURES,
    CLAIM_TITLES
  };

  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.CP_THEORY = data;
})(typeof window !== "undefined" ? window : globalThis);
