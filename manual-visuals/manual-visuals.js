/* Table companions for the counterpoint and orchestration manuals.
   The source table is always retained under a details element. */
(function () {
  'use strict';

  var manual = document.body.getAttribute('data-manual');
  if (!manual) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var visualId = 0;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent) {
    for (var index = 1; index < arguments.length; index += 1) {
      if (arguments[index]) parent.appendChild(arguments[index]);
    }
    return parent;
  }

  function svgElement(tag, attributes) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    return node;
  }

  function cellText(cell) {
    return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function cellMarkup(cell) {
    return cell ? cell.innerHTML : '';
  }

  function badge(text, tone) {
    return element('span', 'mtv-badge' + (tone ? ' ' + tone : ''), text);
  }

  function field(label, value, extraClass) {
    var box = element('div', 'mtv-field' + (extraClass ? ' ' + extraClass : ''));
    append(box, element('b', '', label), element('span', '', value));
    return box;
  }

  function note(text, href, linkText) {
    var box = element('p', 'mtv-note');
    box.appendChild(document.createTextNode(text));
    if (href) {
      var link = element('a', '', linkText || href);
      link.href = href;
      box.appendChild(document.createTextNode(' '));
      box.appendChild(link);
    }
    return box;
  }

  function tableRows(table) {
    if (!table || !table.tBodies.length) return [];
    return Array.prototype.map.call(table.tBodies[0].rows, function (row) {
      return Array.prototype.slice.call(row.cells);
    });
  }

  function headersOf(table) {
    if (!table || !table.tHead || !table.tHead.rows.length) return [];
    return Array.prototype.map.call(table.tHead.rows[0].cells, cellText);
  }

  function makeVisual(kicker, title, lead) {
    var section = element('section', 'mtv');
    var header = element('header', 'mtv-head');
    visualId += 1;
    var titleNode = element('h3', 'mtv-title', title);
    titleNode.id = 'mtv-title-' + visualId;
    append(header, element('div', 'mtv-kicker', kicker), titleNode, element('p', 'mtv-lead', lead));
    section.setAttribute('aria-labelledby', titleNode.id);
    section.appendChild(header);
    var body = element('div', 'mtv-body');
    section.appendChild(body);
    return { section: section, body: body };
  }

  function mount(table, visual, label) {
    var container = table.closest ? table.closest('.table-wrap') : table.parentElement;
    if (!container) return;
    var parent = container.parentNode;
    parent.insertBefore(visual.section, container);
    var details = element('details', 'mtv-details');
    append(details, element('summary', '', label || '展开原始表格，用于逐项核对与打印'));
    parent.insertBefore(details, container);
    details.appendChild(container);
  }

  function sectionLead(kind) {
    var text = {
      constraint: '把同一条写法放回四层条件中检查；任何一层未定义，后面的“能不能用”都没有唯一答案。',
      periods: '历史阶段改变材料、不协和处理与结构化方式。',
      intervals: '横轴是半音距离。完全协和、不完全协和与不协和表示这个语法中的位置与解决要求。',
      species: '节奏型决定强拍能放什么、弱拍能容纳什么；难度由不协和的处理条件决定。',
      inversion: '复对位的关键是可计算的转位结果：原形通过交换声部得到新的音程，再逐拍验算。',
      canon: '五个参数共同决定重叠密度与声部空间；先写死主句再整体平移，通常会在重叠段失效。',
      canonTypes: '所有卡农都保留“复制”关系，变化发生在移位、方向、时值与声部组合。',
      fugue: '赋格把主题进入、调性工作、间插与收束组织成三段功能。',
      diagnosis: '按“材料→纵向→横向→结构”的顺序定位问题，避免用声部数量或力度掩盖前面的语法错误。',
      evidence: '色条只表示各组条目数，不表示论证强度；每条论点的页码与原文仍在下方原始表中。',
      books: '这里并排列出每本教材的分工、代表页与引用页面。',
      principles: '每条原理都压缩成“物理/听觉条件→直接操作”。先改变条件，再增加乐器或力度。',
      relations: '配器同时处理纵向、横向、音色与权重四个关系；任何一项单独最优都可能破坏其余三项。',
      orchestrationPeriods: '乐器构造与演奏技术变化会扩大可用手段；声学条件本身没有随时代改变。',
      ranges: '色条给出实际音域与舒适音区。音域是简化范围，实际可用性还受演奏者、力度、连奏与音准控制影响。',
      layers: '先确定听者应辨认的结构层，再决定由谁演奏。',
      roles: '前景、中景、背景必须落实到音区、起音、力度与事件密度；只在分析表上写“前景”不会改变听觉。',
      trouble: '从左到右是修正顺序：先检查条件，再移动音区或错开起音，最后才增加人数与力度。',
      orchestrationBooks: '这里显示每本教材在本手册中的分工与已引用页数，完整页面入口仍在下方原始表中。'
    };
    return text[kind] || '';
  }

  function renderConstraintStack(rows) {
    var visual = makeVisual('约束栈', '四层约束：先定义材料与时间，再判断声部与曲式', sectionLead('constraint'));
    var stack = element('div', 'mtv-stack');
    rows.forEach(function (cells, index) {
      var row = element('article', 'mtv-stack-row');
      var fields = element('div', 'mtv-stack-fields');
      append(fields, field('要先确定', cellText(cells[1])), field('直接后果', cellText(cells[2])));
      append(row,
        element('div', 'mtv-stack-index', String(index + 1).padStart(2, '0')),
        element('div', 'mtv-stack-name', cellText(cells[0])),
        fields);
      stack.appendChild(row);
    });
    visual.body.appendChild(stack);
    visual.body.appendChild(note('四层依次限制：材料与时间先限制可用音程，声部关系再限制纵向写法，曲式功能最后决定该手法在此处是否有意义。'));
    return visual;
  }

  function renderPeriodTimeline(rows) {
    var visual = makeVisual('时间轴', '四个复调阶段：材料、不协和处理与结构化方式', sectionLead('periods'));
    var timeline = element('div', 'mtv-timeline');
    rows.forEach(function (cells) {
      var phase = element('article', 'mtv-phase');
      append(phase, element('h4', '', cellText(cells[0])));
      append(phase,
        field('主要材料', cellText(cells[1])),
        field('不协和', cellText(cells[2])),
        field('结构化', cellText(cells[3])));
      timeline.appendChild(phase);
    });
    visual.body.appendChild(timeline);
    visual.body.appendChild(note('时间轴表示主导语法的变化，不表示旧语法在某一年停止存在。严格对位训练与自由作品写法长期并存。'));
    return visual;
  }

  function intervalTone(identity) {
    if (identity.indexOf('强不协和') >= 0) return { className: 'is-strong', color: 'var(--mtv-violet)', label: '强不协和' };
    if (identity.indexOf('不完全协和') >= 0) return { className: 'is-imperfect', color: 'var(--mtv-gold)', label: '不完全协和' };
    if (identity.indexOf('完全协和') >= 0) return { className: 'is-stable', color: 'var(--mtv-teal)', label: '完全协和' };
    if (identity.indexOf('不协和') >= 0) return { className: 'is-tense', color: 'var(--mtv-warm)', label: '不协和' };
    return { className: '', color: 'var(--mtv-muted)', label: '条件性' };
  }

  function semitonesIn(text) {
    var found = String(text).match(/\d+/g) || [];
    return found.map(Number).filter(function (value) { return value >= 0 && value <= 12; });
  }

  function renderIntervalLattice(rows) {
    var visual = makeVisual('音程格', '十三个半音位置：协和骨架与张力区', sectionLead('intervals'));
    var scroll = element('div', 'mtv-interval-scroll');
    var lattice = element('div', 'mtv-interval-lattice');
    var axis = element('div', 'mtv-interval-axis');
    for (var value = 0; value <= 12; value += 1) axis.appendChild(element('span', '', value));
    var grid = element('div', 'mtv-interval-grid');
    var slots = [];
    for (var slot = 0; slot <= 12; slot += 1) {
      var slotNode = element('div', 'mtv-interval-slot');
      slots.push(slotNode);
      grid.appendChild(slotNode);
    }
    rows.forEach(function (cells) {
      var name = cellText(cells[0]);
      var identity = cellText(cells[2]);
      var tone = intervalTone(identity);
      var semis = semitonesIn(cellText(cells[1]));
      semis.forEach(function (semi) {
        var chip = element('div', 'mtv-interval-chip ' + tone.className);
        chip.title = name + '：' + identity + '。' + cellText(cells[3]);
        append(chip, element('b', '', name), element('span', '', identity));
        slots[semi].appendChild(chip);
      });
    });
    append(lattice, axis, grid);
    scroll.appendChild(lattice);
    visual.body.appendChild(scroll);
    visual.body.appendChild(element('p', 'mtv-scroll-hint', '左右滑动查看全部十三个半音位置。'));
    var legend = element('div', 'mtv-interval-legend');
    [
      ['完全协和', 'var(--mtv-teal)'], ['不完全协和', 'var(--mtv-gold)'],
      ['不协和', 'var(--mtv-warm)'], ['强不协和', 'var(--mtv-violet)']
    ].forEach(function (item) {
      var entry = element('span');
      var swatch = element('i');
      swatch.style.background = item[1];
      append(entry, swatch, document.createTextNode(item[0]));
      legend.appendChild(entry);
    });
    visual.body.appendChild(legend);
    visual.body.appendChild(note('纯四度被放在“二声部中通常不协和”的位置。此语法要求它由三度、六度或终止公式解释。'));
    return visual;
  }

  function renderSpeciesLanes(rows) {
    var visual = makeVisual('节奏剖面', '五类对位：固定调与对位声部的节拍关系', sectionLead('species'));
    var list = element('div', 'mtv-species');
    var patterns = {
      '1:1': [1, 5],
      '1:2': [1, 3, 5, 7],
      '1:4': [1, 2, 3, 4, 5, 6, 7, 8],
      '切分': [2, 3, 6, 7],
      '混合': [1, 2, 4, 5, 7]
    };
    rows.forEach(function (cells) {
      var ratio = cellText(cells[1]);
      var pattern = patterns[ratio] || [1];
      var row = element('article', 'mtv-species-row');
      var rhythm = element('div', 'mtv-rhythm');
      for (var beat = 1; beat <= 8; beat += 1) {
        var dot = element('span', 'mtv-beat');
        if (beat === 1 || beat === 5) dot.classList.add('is-fixed');
        if (pattern.indexOf(beat) >= 0) dot.classList.add('is-on');
        if (ratio === '切分' && pattern.indexOf(beat) >= 0) dot.classList.add('is-off');
        rhythm.appendChild(dot);
      }
      var noteBox = element('div', 'mtv-species-note');
      append(noteBox,
        field('强拍', cellText(cells[2])),
        field('弱拍', cellText(cells[3])));
      append(row,
        element('div', 'mtv-species-name', cellText(cells[0])),
        badge(ratio, ratio === '混合' || ratio === '切分' ? 'warm' : 'gold'),
        rhythm,
        noteBox);
      list.appendChild(row);
    });
    visual.body.appendChild(list);
    visual.body.appendChild(note('圆点表示对位声部的发声音点，竖线位置表示固定调或小节骨架。第四类与第五类的难点在于不协和的进入位置。'));
    return visual;
  }

  function renderInversionFormulas(rows) {
    var visual = makeVisual('转位公式', '三种复对位：原形交换声部后得到什么音程', sectionLead('inversion'));
    var grid = element('div', 'mtv-transform-grid');
    rows.forEach(function (cells) {
      var card = element('article', 'mtv-transform');
      var equation = element('div', 'mtv-equation');
      append(equation,
        element('span', '', '度数 ' + cellText(cells[1])),
        element('b', '', '⇄'),
        element('span', '', '半音 ' + cellText(cells[2])));
      append(card,
        element('h4', '', cellText(cells[0])),
        equation,
        element('p', '', '典型变化：' + cellText(cells[3])));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('公式给出的是交换后的理论音程，不保证纵向结果自动成立；还要检查交换后是否出现未准备的五度、四度、二度或七度。'));
    return visual;
  }

  function renderCanonParameters(rows) {
    var visual = makeVisual('参数面板', '卡农的五个变量：每个选择都会改变重叠段', sectionLead('canon'));
    var grid = element('div', 'mtv-param-grid');
    rows.forEach(function (cells, index) {
      var card = element('article', 'mtv-param');
      append(card,
        element('span', 'mtv-param-index', 'PARAM ' + String(index + 1).padStart(2, '0')),
        element('h4', '', cellText(cells[0])),
        element('p', '', cellText(cells[1])),
        field('直接后果', cellText(cells[2])));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('五个参数相互牵连：改变进入延迟会改变每拍同时发声的声部数，改变时值会改变不协和落在强拍还是弱拍。'));
    return visual;
  }

  function renderCanonBranches(rows) {
    var visual = makeVisual('变形树', '六类卡农：复制关系不变，变形方式不同', sectionLead('canonTypes'));
    var map = element('div', 'mtv-branch');
    var root = element('div', 'mtv-branch-root');
    append(root, element('b', '', '主句'), element('span', '', '复制 → 应句'));
    var list = element('div', 'mtv-branch-list');
    rows.forEach(function (cells) {
      var card = element('article', 'mtv-branch-card');
      append(card,
        element('h4', '', cellText(cells[0])),
        element('p', '', '复制：' + cellText(cells[1])),
        field('写法', cellText(cells[2])));
      list.appendChild(card);
    });
    append(map, root, list);
    visual.body.appendChild(map);
    visual.body.appendChild(note('倒影、逆行、扩大与缩小改变的是轮廓或时值；若应句停止复制并转入自由对位，就不再是完整卡农。'));
    return visual;
  }

  function renderFugueTimeline(rows) {
    var visual = makeVisual('曲式时间轴', '赋格四段：主题进入、调性工作与连接手段', sectionLead('fugue'));
    var timeline = element('div', 'mtv-form-timeline');
    rows.forEach(function (cells) {
      var segment = element('article', 'mtv-form-segment');
      append(segment, element('h4', '', cellText(cells[0])));
      append(segment,
        field('进入', cellText(cells[1])),
        field('调性', cellText(cells[2])),
        field('连接', cellText(cells[3])));
      timeline.appendChild(segment);
    });
    visual.body.appendChild(timeline);
    var tension = element('div', 'mtv-form-tension');
    append(tension,
      document.createTextNode('调性稳定'),
      element('div', 'mtv-form-tension-line'),
      document.createTextNode('离开主调 → 属持续 → 回归'));
    visual.body.appendChild(tension);
    visual.body.appendChild(note('三段功能比固定小节数更重要。呈示部建立主调与属调两极；中间部通过关系调、下属方向或远关系制造离开感；密接与持续音负责回归。'));
    return visual;
  }

  function renderDiagnosticFlow(rows) {
    var visual = makeVisual('诊断顺序', '四个检查层级：先问材料，再问纵向、横向与结构', sectionLead('diagnosis'));
    var scroll = element('div', 'mtv-diagnostic-scroll');
    var flow = element('div', 'mtv-diagnostic');
    rows.forEach(function (cells, index) {
      var step = element('article', 'mtv-diagnostic-step');
      append(step, element('h4', '', String(index + 1).padStart(2, '0') + ' · ' + cellText(cells[0])));
      append(step,
        field('先问', cellText(cells[1])),
        field('常见错误', cellText(cells[2]), 'is-risk'),
        field('修正方向', cellText(cells[3])));
      flow.appendChild(step);
    });
    scroll.appendChild(flow);
    visual.body.appendChild(scroll);
    visual.body.appendChild(note('如果材料层尚未确定，直接增加声部或改变力度只会把问题推迟。结构层的问题也不能靠局部声部进行修补。'));
    return visual;
  }

  function renderEvidenceOverview(rows, totalRows) {
    var grouped = [];
    var byName = {};
    rows.forEach(function (cells) {
      var name = cellText(cells[0]) || '未分组';
      if (!byName[name]) {
        byName[name] = { name: name, rows: 0, claims: [], books: new Set() };
        grouped.push(byName[name]);
      }
      var group = byName[name];
      group.rows += 1;
      var claimLink = cells[1] ? cells[1].querySelector('a') : null;
      if (claimLink) group.claims.push({ text: cellText(cells[1]), href: claimLink.getAttribute('href') });
      if (cells[2]) {
        Array.prototype.forEach.call(cells[2].querySelectorAll('a[href]'), function (link) {
          var match = String(link.getAttribute('href')).match(/books\/([^#]+)\.html/);
          if (match) group.books.add(match[1]);
        });
      }
    });
    var max = Math.max.apply(null, grouped.map(function (group) { return group.rows; }));
    var visual = makeVisual('证据分布', '证据地图：' + grouped.length + ' 组、' + totalRows + ' 条论点的覆盖密度', sectionLead('evidence'));
    var grid = element('div', 'mtv-evidence-grid');
    grouped.forEach(function (group) {
      var card = element('article', 'mtv-evidence-group');
      var head = element('div', 'mtv-evidence-group-head');
      append(head, element('h4', '', group.name), element('span', 'mtv-evidence-count', group.rows));
      var bar = element('div', 'mtv-evidence-bar');
      var fill = element('i');
      fill.style.width = Math.max(7, group.rows / max * 100) + '%';
      bar.appendChild(fill);
      var list = element('ul', 'mtv-evidence-list');
      group.claims.slice(0, 4).forEach(function (claim) {
        var item = element('li');
        var link = element('a', '', claim.text);
        link.href = claim.href;
        item.appendChild(link);
        list.appendChild(item);
      });
      append(card, head, bar, list, element('div', 'mtv-source', group.books.size + ' 本教材参与'));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('这里只显示每组的条目密度和前四条论点入口。教材分工、全文摘录与所有页码仍在下方原始表中。'));
    return visual;
  }

  function renderBookShelf(rows, mode) {
    var values = rows.map(function (cells) {
      var text = cellText(cells[2]);
      return mode === 'counterpoint' ? (Number(text.match(/\d+/)) || 0) : (text.match(/\d+/g) || []).length;
    });
    var max = Math.max.apply(null, values.concat([1]));
    var visual = makeVisual('教材架', mode === 'counterpoint' ? '教材分工与页数：' + rows.length + ' 本参考书' : '教材分工与已引用页：' + rows.length + ' 册',
      sectionLead(mode === 'counterpoint' ? 'books' : 'orchestrationBooks'));
    var shelf = element('div', 'mtv-shelf');
    rows.forEach(function (cells, index) {
      var card = element('article', 'mtv-book');
      var head = element('div', 'mtv-book-head');
      var pageLabel = mode === 'counterpoint' ? cellText(cells[2]) + ' 页' : cellText(cells[2]).split('、').filter(Boolean).length + ' 页';
      append(head, element('h4', '', cellText(cells[0])), element('span', 'mtv-book-pages', pageLabel));
      var bar = element('div', 'mtv-book-bar');
      var fill = element('i');
      fill.style.width = Math.max(5, values[index] / max * 100) + '%';
      bar.appendChild(fill);
      var source = element('div', 'mtv-source');
      source.innerHTML = cellMarkup(cells[3]);
      append(card, head, element('p', '', cellText(cells[1])), bar, source);
      shelf.appendChild(card);
    });
    visual.body.appendChild(shelf);
    return visual;
  }

  function renderPrinciples(rows) {
    var visual = makeVisual('因果链', '八条配器原理：物理条件到直接操作', sectionLead('principles'));
    var grid = element('div', 'mtv-principles');
    rows.forEach(function (cells, index) {
      var card = element('article', 'mtv-principle');
      var head = element('div', 'mtv-principle-head');
      append(head, element('h4', '', String(index + 1).padStart(2, '0') + ' · ' + cellText(cells[0])), badge('原理', 'gold'));
      var flow = element('div', 'mtv-principle-flow');
      append(flow,
        field('物理 / 听觉依据', cellText(cells[1])),
        element('div', 'mtv-arrow', '→'),
        field('直接操作', cellText(cells[2])));
      append(card, head, flow);
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('先改变音区、时间或力度，代价通常低于增加乐器数量；同度与八度重复不会自动产生新的结构层。'));
    return visual;
  }

  function renderRelationQuadrants(rows) {
    var visual = makeVisual('四维关系', '配器：四组同时成立的约束', sectionLead('relations'));
    var grid = element('div', 'mtv-quadrants');
    rows.forEach(function (cells) {
      var card = element('article', 'mtv-quadrant');
      append(card,
        element('h4', '', cellText(cells[0])),
        element('p', '', cellText(cells[1])),
        field('可测变量', cellText(cells[2])));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('四组关系没有固定优先级；当旋律被盖住时，先查纵向音区与横向事件密度，再查音色与权重，最后考虑人数。'));
    return visual;
  }

  function renderOrchestrationTimeline(rows) {
    var visual = makeVisual('历史轴', '三个阶段：新增手段、配器后果与未改变的条件', sectionLead('orchestrationPeriods'));
    var timeline = element('div', 'mtv-timeline');
    rows.forEach(function (cells) {
      var phase = element('article', 'mtv-phase');
      append(phase, element('h4', '', cellText(cells[0])));
      append(phase,
        field('新增手段', cellText(cells[1])),
        field('配器后果', cellText(cells[2])),
        field('未改变', cellText(cells[3])));
      timeline.appendChild(phase);
    });
    visual.body.appendChild(timeline);
    visual.body.appendChild(note('乐器构造、按键与阀键、编制与演奏技术改变可用手段；频率、掩蔽、起音与音区约束仍然有效。'));
    return visual;
  }

  function noteToMidi(name) {
    var match = String(name).match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return null;
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
    var accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    return (Number(match[3]) + 1) * 12 + base + accidental;
  }

  function parseRange(text) {
    var found = String(text).match(/[A-Ga-g][#b]?-?\d+/g) || [];
    if (found.length < 2) return null;
    var low = noteToMidi(found[0]);
    var high = noteToMidi(found[1]);
    if (low === null || high === null) return null;
    return { low: Math.min(low, high), high: Math.max(low, high) };
  }

  function midiLabel(midi) {
    var names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    return names[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function renderInstrumentRanges(rows) {
    var visual = makeVisual('音域尺', '二十一件乐器与声部的实际音域、舒适音区与力度上限', sectionLead('ranges'));
    var minMidi = 9;
    var maxMidi = 108;
    function percent(midi) { return (midi - minMidi) / (maxMidi - minMidi) * 100; }
    var legend = element('div', 'mtv-range-legend');
    [['实际音域', 'color-mix(in srgb, var(--mtv-teal) 45%, transparent)'], ['舒适音区', 'var(--mtv-gold)']].forEach(function (item) {
      var entry = element('span');
      var swatch = element('i');
      swatch.style.background = item[1];
      append(entry, swatch, document.createTextNode(item[0]));
      legend.appendChild(entry);
    });
    visual.body.appendChild(legend);
    visual.body.appendChild(element('p', 'mtv-scroll-hint', '左右滑动查看完整音域；左侧乐器名保持固定。'));
    var scroll = element('div', 'mtv-scroll');
    var chart = element('div', 'mtv-range-chart');
    var axis = element('div', 'mtv-range-axis');
    var axisTrack = element('div', 'mtv-range-axis-track');
    [12, 24, 36, 48, 60, 72, 84, 96, 108].forEach(function (midi) {
      var tick = element('span', 'mtv-range-tick', 'C' + (Math.floor(midi / 12) - 1));
      tick.style.left = percent(midi) + '%';
      axisTrack.appendChild(tick);
    });
    append(axis, element('span'), axisTrack, element('span'));
    chart.appendChild(axis);
    rows.forEach(function (cells) {
      var full = parseRange(cellText(cells[1]));
      var comfort = parseRange(cellText(cells[2]));
      var row = element('div', 'mtv-range-row' + (full ? '' : ' is-percussion'));
      row.title = cellText(cells[0]) + '：' + cellText(cells[1]) + '；舒适 ' + cellText(cells[2]) + '；' + cellText(cells[5]);
      var track = element('div', 'mtv-range-track');
      if (full) {
        var fullBar = element('div', 'mtv-range-full');
        fullBar.style.left = percent(full.low) + '%';
        fullBar.style.width = Math.max(1.2, percent(full.high) - percent(full.low)) + '%';
        track.appendChild(fullBar);
      }
      if (comfort) {
        var comfortBar = element('div', 'mtv-range-comfort');
        comfortBar.style.left = percent(comfort.low) + '%';
        comfortBar.style.width = Math.max(1, percent(comfort.high) - percent(comfort.low)) + '%';
        track.appendChild(comfortBar);
      }
      var nameBox = element('div', 'mtv-range-name');
      append(nameBox, document.createTextNode(cellText(cells[0])), element('small', 'mtv-range-inline-dyn', cellText(cells[3])));
      append(row,
        nameBox,
        track,
        element('div', 'mtv-range-dyn', cellText(cells[3])));
      chart.appendChild(row);
    });
    scroll.appendChild(chart);
    visual.body.appendChild(scroll);
    window.requestAnimationFrame(function () {
      if (scroll.scrollWidth > scroll.clientWidth + 4) {
        scroll.scrollLeft = Math.min(220, scroll.scrollWidth - scroll.clientWidth);
      }
    });
    visual.body.appendChild(note('图中没有把“音域宽”直接当作“更好用”。短笛、小号等高穿透乐器在强奏时会压过其他层；低音乐器密集排列会增加粗糙感。'));
    return visual;
  }

  function renderLayerStack(rows) {
    var visual = makeVisual('结构层', '六个结构层：先识别问题，再分配乐器', sectionLead('layers'));
    var stack = element('div', 'mtv-layers');
    rows.forEach(function (cells) {
      var row = element('article', 'mtv-layer');
      var question = element('p');
      question.appendChild(element('b', '', '识别：'));
      question.appendChild(document.createTextNode(cellText(cells[1])));
      var writing = element('p');
      writing.appendChild(element('b', '', '写法：'));
      writing.appendChild(document.createTextNode(cellText(cells[2])));
      append(row, element('div', 'mtv-layer-name', cellText(cells[0])), question, writing);
      stack.appendChild(row);
    });
    visual.body.appendChild(stack);
    visual.body.appendChild(note('结构层会随乐段变化。分析时应按短小段落标注，避免把整首作品压成一个标签。'));
    return visual;
  }

  function renderRoleLayers(rows) {
    var visual = makeVisual('听觉层级', '前景、中景、背景：音区、起音、力度与乐器', sectionLead('roles'));
    var layers = element('div', 'mtv-role-layers');
    rows.forEach(function (cells) {
      var row = element('article', 'mtv-role');
      var fields = element('div', 'mtv-role-fields');
      append(fields,
        field('音区', cellText(cells[1])),
        field('节奏 / 起音', cellText(cells[2])),
        field('力度', cellText(cells[3])),
        field('常见乐器', cellText(cells[4])));
      append(row, element('div', 'mtv-role-label', cellText(cells[0])), fields);
      layers.appendChild(row);
    });
    visual.body.appendChild(layers);
    visual.body.appendChild(note('层级差异必须同时落到至少一项可听变量上。只在分析表上写“前景/背景”，不会改变实际听觉。'));
    return visual;
  }

  function renderTroubleshooting(rows) {
    var visual = makeVisual('排障图', '八种常见问题：检查顺序与修正代价', sectionLead('trouble'));
    var grid = element('div', 'mtv-trouble-grid');
    rows.forEach(function (cells) {
      var card = element('article', 'mtv-trouble');
      var flow = element('div', 'mtv-trouble-flow');
      [
        ['先检查', cellText(cells[1]), ''],
        ['首选修正', cellText(cells[2]), ''],
        ['再考虑', cellText(cells[3]), ''],
        ['不要先做', cellText(cells[4]), 'is-avoid']
      ].forEach(function (step) {
        var node = element('div', 'mtv-trouble-step' + (step[2] ? ' ' + step[2] : ''));
        append(node, element('b', '', step[0]), element('span', '', step[1]));
        flow.appendChild(node);
      });
      append(card, element('h4', '', cellText(cells[0])), flow);
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('排障顺序按代价从低到高：先查条件与记谱，再移动音区或错开起音，最后才增加人数与力度。'));
    return visual;
  }

  var CONFIGS = {
    counterpoint: [
      { test: function (h) { return h[0] === '层级' && h[1].indexOf('先确定') >= 0; }, render: renderConstraintStack, label: '展开四层约束原始表格' },
      { test: function (h) { return h[0] === '阶段' && h[3] === '复调的结构化方式'; }, render: renderPeriodTimeline, label: '展开四个历史阶段原始表格' },
      { test: function (h) { return h[0].indexOf('音程') === 0 && h[1] === '半音数'; }, render: renderIntervalLattice, label: '展开音程等级原始表格' },
      { test: function (h) { return h[0] === '类型' && h[1].indexOf('固定调') >= 0; }, render: renderSpeciesLanes, label: '展开五类对位原始表格' },
      { test: function (h) { return h[0] === '转位类型'; }, render: renderInversionFormulas, label: '展开复对位公式原始表格' },
      { test: function (h) { return h[0] === '参数' && h[1] === '作用'; }, render: renderCanonParameters, label: '展开卡农参数原始表格' },
      { test: function (h) { return h[0] === '类型' && h[1] === '复制方式'; }, render: renderCanonBranches, label: '展开卡农类型原始表格' },
      { test: function (h) { return h[0] === '段落' && h[1].indexOf('主题') >= 0; }, render: renderFugueTimeline, label: '展开赋格布局原始表格' },
      { test: function (h) { return h[0] === '层级' && h[1] === '先问'; }, render: renderDiagnosticFlow, label: '展开写作诊断原始表格' },
      { test: function (h) { return h[0] === '组' && h[1] === '论点'; }, render: renderEvidenceOverview, label: '展开完整证据索引表格' },
      { test: function (h) { return h[0] === '教材' && h[2] === 'PDF 页数'; }, render: function (rows) { return renderBookShelf(rows, 'counterpoint'); }, label: '展开教材目录原始表格' }
    ],
    orchestration: [
      { test: function (h) { return h[0] === '原理' && h[1].indexOf('物理') >= 0; }, render: renderPrinciples, label: '展开八条原理原始表格' },
      { test: function (h) { return h[0] === '关系' && h[1] === '要决定的事'; }, render: renderRelationQuadrants, label: '展开四组关系原始表格' },
      { test: function (h) { return h[0] === '阶段' && h[1] === '新增手段'; }, render: renderOrchestrationTimeline, label: '展开历史阶段原始表格' },
      { test: function (h) { return h[0] === '乐器' && h[1] === '实际音域'; }, render: renderInstrumentRanges, label: '展开乐器音域原始表格' },
      { test: function (h) { return h[0] === '层' && h[1] === '识别问题'; }, render: renderLayerStack, label: '展开结构层原始表格' },
      { test: function (h) { return h[0] === '层级' && h[1] === '音区'; }, render: renderRoleLayers, label: '展开听觉层级原始表格' },
      { test: function (h) { return h[0] === '症状' && h[1] === '先检查'; }, render: renderTroubleshooting, label: '展开排障顺序原始表格' },
      { test: function (h) { return h[0] === '教材' && h[1] === '本手册中的分工'; }, render: function (rows) { return renderBookShelf(rows, 'orchestration'); }, label: '展开教材目录原始表格' }
    ]
  };

  var configs = CONFIGS[manual] || [];
  var tables = Array.prototype.slice.call(document.querySelectorAll('main table'));
  tables.forEach(function (table) {
    var headers = headersOf(table);
    var config = configs.find(function (candidate) { return candidate.test(headers); });
    if (!config) return;
    var rows = tableRows(table);
    if (!rows.length) return;
    try {
      var visual = config.render(rows, rows.length);
      if (visual) mount(table, visual, config.label);
    } catch (error) {
      if (window.console && console.error) console.error('[manual-visuals] ' + manual, error);
    }
  });
})();
