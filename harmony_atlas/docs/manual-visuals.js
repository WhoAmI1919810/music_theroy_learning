/* Interactive figures generated from the same tables and engine data as the manual. */
(function () {
  'use strict';

  var dataHost = document.getElementById('manual-visual-data');
  var DATA = {};
  try {
    DATA = JSON.parse(dataHost ? dataHost.textContent : '{}');
  } catch (error) {
    DATA = {};
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var visualId = 0;
  var arrowId = 0;

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

  function badge(text, tone) {
    return element('span', 'mv-badge' + (tone ? ' ' + tone : ''), text);
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

  function tableInfo(anchorId) {
    var anchor = document.getElementById(anchorId);
    if (!anchor) return null;
    var current = anchor.nextElementSibling;
    var guard = 0;
    while (current && guard < 30) {
      if (current.classList && current.classList.contains('table-wrap')) {
        return { anchor: anchor, source: current, table: current.querySelector('table') };
      }
      if (current.tagName === 'TABLE') return { anchor: anchor, source: current, table: current };
      if (/^H[234]$/.test(current.tagName)) break;
      current = current.nextElementSibling;
      guard += 1;
    }
    return { anchor: anchor, source: null, table: null };
  }

  function tableRows(anchorId) {
    var info = tableInfo(anchorId);
    if (!info || !info.table || !info.table.tBodies.length) return [];
    return Array.prototype.map.call(info.table.tBodies[0].rows, function (row) {
      return Array.prototype.slice.call(row.cells);
    });
  }

  function makeHeader(kicker, title, lead) {
    var header = element('header', 'mv-head');
    var titleNode = element('h3', 'mv-title', title);
    visualId += 1;
    titleNode.id = 'manual-visual-title-' + visualId;
    append(header, element('div', 'mv-kicker', kicker), titleNode, element('p', 'mv-lead', lead));
    return { node: header, titleId: titleNode.id };
  }

  function makeVisual(kicker, title, lead) {
    var section = element('section', 'manual-visual');
    var header = makeHeader(kicker, title, lead);
    section.setAttribute('aria-labelledby', header.titleId);
    section.appendChild(header.node);
    var body = element('div', 'mv-body');
    section.appendChild(body);
    return { section: section, body: body };
  }

  function placeVisual(anchorId, section, tableLabel) {
    var info = tableInfo(anchorId);
    if (!info) return;
    var parent = info.anchor.parentNode;
    if (!info.source) {
      parent.insertBefore(section, info.anchor.nextSibling);
      return;
    }
    parent.insertBefore(section, info.source);
    var details = element('details', 'manual-table-source');
    details.appendChild(element('summary', '', tableLabel || '展开原始表格，用于逐项核对与打印'));
    parent.insertBefore(details, info.source);
    details.appendChild(info.source);
  }

  function note(text, href, linkText) {
    var box = element('p', 'mv-note');
    box.appendChild(document.createTextNode(text));
    if (href) {
      var anchor = element('a', '', linkText || href);
      anchor.href = href;
      box.appendChild(document.createTextNode(' '));
      box.appendChild(anchor);
    }
    return box;
  }

  function sourceFromCell(cell) {
    var source = element('div', 'mv-source');
    source.innerHTML = cell ? cell.innerHTML : '';
    return source;
  }

  function arrowMarkers(prefix, colors) {
    var defs = svgElement('defs');
    var ids = {};
    Object.keys(colors).forEach(function (key) {
      var id = prefix + '-' + key;
      ids[key] = id;
      var marker = svgElement('marker', {
        id: id, viewBox: '0 0 8 8', refX: 7, refY: 4,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
      });
      marker.appendChild(svgElement('path', { d: 'M 0 0 L 8 4 L 0 8 Z', fill: colors[key] }));
      defs.appendChild(marker);
    });
    return { defs: defs, ids: ids };
  }

  function pathBetween(svg, container, from, to, options) {
    if (!from || !to) return null;
    var box = container.getBoundingClientRect();
    var start = from.getBoundingClientRect();
    var end = to.getBoundingClientRect();
    var x1 = start.left - box.left + start.width / 2;
    var y1 = start.bottom - box.top;
    var x2 = end.left - box.left + end.width / 2;
    var y2 = end.top - box.top;
    var bend = Math.max(24, Math.min(95, Math.abs(y2 - y1) * 0.52));
    var path = svgElement('path', {
      d: 'M ' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        ' C ' + x1.toFixed(1) + ' ' + (y1 + bend).toFixed(1) +
        ', ' + x2.toFixed(1) + ' ' + (y2 - bend).toFixed(1) +
        ', ' + x2.toFixed(1) + ' ' + y2.toFixed(1),
      fill: 'none'
    });
    if (options && options.className) path.setAttribute('class', options.className);
    if (options && options.stroke) path.setAttribute('stroke', options.stroke);
    if (options && options.width) path.setAttribute('stroke-width', options.width);
    if (options && options.dash) path.setAttribute('stroke-dasharray', options.dash);
    if (options && options.opacity) path.setAttribute('stroke-opacity', options.opacity);
    if (options && options.marker) path.setAttribute('marker-end', 'url(#' + options.marker + ')');
    svg.appendChild(path);
    return path;
  }

  function sizeSvg(svg, container) {
    var box = container.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + Math.max(1, Math.ceil(box.width)) + ' ' + Math.max(1, Math.ceil(box.height)));
  }

  function redrawOnResize(container, callback) {
    var frame = 0;
    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(function () {
        callback();
      });
    }
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(schedule);
      observer.observe(container);
    }
    window.addEventListener('resize', schedule);
    window.requestAnimationFrame(function () { window.requestAnimationFrame(callback); });
  }

  function renderPrinciples() {
    var rows = tableRows('visual-principles');
    if (!rows.length) return;
    var visual = makeVisual('机制图', '八条原理：从可检验机制到直接操作',
      '每张卡把原理拆成“为什么成立”和“现场怎么做”。教材页码保留在卡片底部。');
    var grid = element('div', 'mv-principles');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-principle');
      var head = element('div', 'mv-principle-head');
      append(head, element('span', 'mv-principle-no', cellText(cells[0])));
      var titleBox = element('div');
      titleBox.appendChild(element('h4', '', cellText(cells[1])));
      head.appendChild(titleBox);
      var flow = element('div', 'mv-principle-flow');
      var mechanism = element('div');
      append(mechanism, element('b', '', '机制'), document.createTextNode(cellText(cells[2])));
      var operation = element('div');
      append(operation, element('b', '', '操作'), document.createTextNode(cellText(cells[3])));
      append(flow, mechanism, element('div', 'mv-flow-arrow', '→'), operation);
      append(card, head, flow, sourceFromCell(cells[4]));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    placeVisual('visual-principles', visual.section, '展开八条原理原始表格');
  }

  function renderLevels() {
    var rows = tableRows('visual-levels');
    if (!rows.length) return;
    var visual = makeVisual('层级图', '六个层级：问题、材料与输出的对应关系',
      '从上到下增加分析尺度；左侧标签是系统中的层级，不是教材章节号。');
    var stack = element('div', 'mv-levels');
    rows.forEach(function (cells) {
      var row = element('div', 'mv-level');
      var main = element('div', 'mv-level-main');
      append(main, element('b', '', cellText(cells[1])), element('span', '', cellText(cells[2])));
      append(row, element('div', 'mv-level-tag', cellText(cells[0])), main,
        element('div', 'mv-level-out', '输出：' + cellText(cells[3])));
      stack.appendChild(row);
    });
    visual.body.appendChild(stack);
    placeVisual('visual-levels', visual.section, '展开六层结构原始表格');
  }

  function renderTheory() {
    var nodes = Array.isArray(DATA.theory) ? DATA.theory : [];
    if (!nodes.length) return;
    var visual = makeVisual('先修图', '28 个理论节点：从先修到后续的有向图',
      '箭头由先修指向后续。点击节点会高亮它的全部上游与下游；横向滚动可查看较宽的分层。');
    var scroll = element('div', 'mv-dag-scroll');
    var canvas = element('div', 'mv-dag-canvas');
    var prefix = 'mv-dag-' + (++arrowId);
    var markerSet = arrowMarkers(prefix, { base: '#708ea9', active: '#efb45b', upstream: '#61c7bd', downstream: '#df8c7b' });
    var svg = svgElement('svg', { class: 'mv-dag-svg', 'aria-hidden': 'true' });
    svg.appendChild(markerSet.defs);
    canvas.appendChild(svg);
    var nodeEls = {};
    var byLayer = {};
    nodes.forEach(function (item) { (byLayer[item.layer] || (byLayer[item.layer] = [])).push(item); });

    Object.keys(byLayer).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (layer) {
      var row = element('div', 'mv-dag-layer');
      row.appendChild(element('span', 'mv-layer-label', 'L' + layer));
      byLayer[layer].forEach(function (item) {
        var button = element('button', 'mv-dag-node', item.title);
        button.type = 'button';
        button.dataset.nodeId = item.id;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', function () { activate(item.id); });
        nodeEls[item.id] = button;
        row.appendChild(button);
      });
      canvas.appendChild(row);
    });

    var detail = element('div', 'mv-dag-detail');
    detail.setAttribute('aria-live', 'polite');
    detail.appendChild(element('span', 'mv-muted', '点击任一节点，查看原理、操作、应用与上游/下游。'));
    visual.body.appendChild(scroll);
    scroll.appendChild(canvas);
    visual.body.appendChild(detail);

    var prerequisites = {};
    var enables = {};
    nodes.forEach(function (item) {
      prerequisites[item.id] = item.prerequisites || [];
      enables[item.id] = item.enables || [];
    });

    function ancestorsOf(id) {
      var result = new Set();
      var queue = (prerequisites[id] || []).slice();
      while (queue.length) {
        var current = queue.shift();
        if (!current || result.has(current)) continue;
        result.add(current);
        queue.push.apply(queue, prerequisites[current] || []);
      }
      return result;
    }

    function descendantsOf(id) {
      var result = new Set();
      var queue = (enables[id] || []).slice();
      while (queue.length) {
        var current = queue.shift();
        if (!current || result.has(current)) continue;
        result.add(current);
        queue.push.apply(queue, enables[current] || []);
      }
      return result;
    }

    function detailList(label, values) {
      var paragraph = element('p');
      paragraph.appendChild(element('strong', '', label + '：'));
      paragraph.appendChild(document.createTextNode((values || []).join('；') || '无'));
      return paragraph;
    }

    function activate(id) {
      var item = nodes.find(function (candidate) { return candidate.id === id; });
      if (!item) return;
      var upstream = ancestorsOf(id);
      var downstream = descendantsOf(id);
      nodes.forEach(function (candidate) {
        var button = nodeEls[candidate.id];
        button.classList.toggle('is-active', candidate.id === id);
        button.classList.toggle('is-upstream', upstream.has(candidate.id));
        button.classList.toggle('is-downstream', downstream.has(candidate.id));
        button.setAttribute('aria-pressed', candidate.id === id ? 'true' : 'false');
      });
      Array.prototype.forEach.call(svg.querySelectorAll('.mv-dag-edge'), function (edge) {
        var from = edge.dataset.from;
        var to = edge.dataset.to;
        edge.classList.remove('is-active', 'is-upstream', 'is-downstream');
        var marker = markerSet.ids.base;
        if (to === id) {
          edge.classList.add('is-active');
          marker = markerSet.ids.active;
        } else if (upstream.has(from) && upstream.has(to)) {
          edge.classList.add('is-upstream');
          marker = markerSet.ids.upstream;
        } else if (downstream.has(from) && downstream.has(to)) {
          edge.classList.add('is-downstream');
          marker = markerSet.ids.downstream;
        }
        edge.setAttribute('marker-end', 'url(#' + marker + ')');
      });
      detail.replaceChildren();
      var title = element('div', 'mv-detail-title');
      append(title, element('strong', '', item.title), badge('L' + item.layer, 'gold'));
      if (upstream.size) title.appendChild(badge('上游 ' + upstream.size, ''));
      if (downstream.size) title.appendChild(badge('下游 ' + downstream.size, ''));
      append(detail, title, element('p', '', item.principle),
        detailList('操作', item.operations), detailList('应用', item.applications),
        detailList('教材依据', item.sources));
      var sourceLink = element('a', '', '查看教材分工与代表页码');
      sourceLink.href = '#visual-books';
      detail.appendChild(sourceLink);
    }

    function draw() {
      Array.prototype.forEach.call(svg.querySelectorAll('.mv-dag-edge'), function (edge) { edge.remove(); });
      sizeSvg(svg, canvas);
      nodes.forEach(function (item) {
        (item.prerequisites || []).forEach(function (preId) {
          var path = pathBetween(svg, canvas, nodeEls[preId], nodeEls[item.id], {
            className: 'mv-dag-edge', stroke: 'rgba(112,142,169,.42)', width: 1.25,
            marker: markerSet.ids.base
          });
          if (path) {
            path.dataset.from = preId;
            path.dataset.to = item.id;
          }
        });
      });
    }

    visual.body.appendChild(note('先修图由 theory-data.js 的 prerequisites 与 enables 生成；它表示理解依赖，不等同于历史先后。'));
    placeVisual('visual-theory', visual.section, '展开 28 个节点的原始表格');
    redrawOnResize(canvas, draw);
  }

  function renderPeriods() {
    var rows = tableRows('visual-periods');
    if (!rows.length) return;
    var visual = makeVisual('时间轴', '三阶段：新增变量、和声结果与未改变的条件',
      '时间只作旁证。每张卡更重要的信息是：这一阶段新增了哪些可控变量，以及哪些底层约束仍在。');
    var timeline = element('div', 'mv-timeline');
    rows.forEach(function (cells) {
      var stage = element('article', 'mv-stage');
      var name = cellText(cells[0]).replace(/\s*\([^)]*\)\s*$/, '');
      append(stage, element('div', 'mv-stage-dot'), element('h4', '', name), element('span', 'mv-stage-time', cellText(cells[1])));
      append(stage, element('p', '', '新增变量：' + cellText(cells[2])));
      stage.appendChild(element('p', '', '和声结果：' + cellText(cells[3])));
      stage.appendChild(element('p', '', '未改变：' + cellText(cells[4])));
      timeline.appendChild(stage);
    });
    visual.body.appendChild(timeline);
    visual.body.appendChild(note('分期判断看调中心、功能语法与组织参数；具体作品可以同时使用相邻阶段的语法。'));
    placeVisual('visual-periods', visual.section, '展开三阶段原始表格');
  }

  function renderPeriodEvidence() {
    var rows = tableRows('visual-period-evidence');
    if (!rows.length) return;
    var visual = makeVisual('依据链', '分期依据：教材原文与可跳转页码',
      '按阶段归组。每一条保留教材名、PDF 页码与原文，便于直接回到教材核对。');
    var groups = {};
    rows.forEach(function (cells) {
      var stage = cellText(cells[0]);
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(cells);
    });
    var grid = element('div', 'mv-evidence-groups');
    Object.keys(groups).forEach(function (stage) {
      var group = element('section', 'mv-evidence-group');
      group.appendChild(element('h4', '', stage));
      groups[stage].forEach(function (cells) {
        var item = element('div', 'mv-evidence-item');
        var sourceLine = element('div');
        append(sourceLine, element('strong', '', cellText(cells[1]) + ' '));
        var pages = element('span');
        pages.innerHTML = cells[2] ? cells[2].innerHTML : '';
        sourceLine.appendChild(pages);
        append(item, sourceLine, element('p', '', '“' + cellText(cells[3]) + '”'));
        group.appendChild(item);
      });
      grid.appendChild(group);
    });
    visual.body.appendChild(grid);
    placeVisual('visual-period-evidence', visual.section, '展开分期依据原始表格');
  }

  function renderTendencies() {
    var rows = tableRows('visual-tendencies');
    if (!rows.length) return;
    var visual = makeVisual('解决箭头', '倾向音：起点、方向与边界条件',
      '矩形左侧是待解决的音或音程，右侧是解决目标；下方说明适用条件。');
    var list = element('div', 'mv-resolution-list');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-resolution');
      var from = element('div', 'from');
      append(from, element('b', '', cellText(cells[0])), element('span', '', '待解决'));
      var to = element('div', 'to');
      append(to, element('b', '', cellText(cells[1])), element('span', '', '解决目标'));
      append(card, from, element('div', 'arrow', '→'), to,
        element('div', 'mv-resolution-note', cellText(cells[2])));
      list.appendChild(card);
    });
    visual.body.appendChild(list);
    placeVisual('visual-tendencies', visual.section, '展开倾向音原始表格');
  }

  function renderModes() {
    var modes = Array.isArray(DATA.modes) ? DATA.modes : [];
    if (!modes.length) return;
    var visual = makeVisual('音轮', '十六种调式：音阶结构、特征音与调内三和弦',
      '外圈固定为十二个音级；金色节点是当前调式音阶，橙红节点是特征音。切换调式可比较结构差异。');
    var picker = element('div', 'mv-mode-list');
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', '选择调式');
    var layout = element('div', 'mv-mode-layout');
    var wheel = element('div', 'mv-mode-wheel');
    var info = element('div', 'mv-mode-info');
    layout.appendChild(wheel);
    layout.appendChild(info);
    append(visual.body, picker, layout);

    var chromatic = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    var buttons = {};

    function scaleLabels(mode) {
      var labels = {};
      (mode.intervals || []).forEach(function (interval, index) {
        labels[((interval % 12) + 12) % 12] = mode.scale[index] || chromatic[((interval % 12) + 12) % 12];
      });
      return labels;
    }

    function drawWheel(mode) {
      wheel.replaceChildren();
      var svg = svgElement('svg', { viewBox: '0 0 360 360', role: 'img' });
      svg.setAttribute('aria-label', mode.name + ' 的十二音音轮');
      var center = 180;
      var labels = scaleLabels(mode);
      var selected = new Set((mode.intervals || []).map(function (value) { return ((value % 12) + 12) % 12; }));
      var characteristics = new Set((mode.characteristic || []).map(function (value) { return ((value % 12) + 12) % 12; }));
      svg.appendChild(svgElement('circle', { cx: center, cy: center, r: 146, fill: 'none', stroke: 'rgba(152,171,192,.15)', 'stroke-width': 1 }));
      svg.appendChild(svgElement('circle', { cx: center, cy: center, r: 99, fill: 'none', stroke: 'rgba(152,171,192,.11)', 'stroke-width': 1 }));
      var points = [];
      for (var index = 0; index < 12; index += 1) {
        var angle = (-90 + index * 30) * Math.PI / 180;
        var markerRadius = 111;
        var labelRadius = 144;
        var x = center + Math.cos(angle) * markerRadius;
        var y = center + Math.sin(angle) * markerRadius;
        var lx = center + Math.cos(angle) * labelRadius;
        var ly = center + Math.sin(angle) * labelRadius;
        var isScale = selected.has(index);
        var isCharacteristic = characteristics.has(index);
        if (isScale) points.push(x.toFixed(1) + ',' + y.toFixed(1));
        var label = element('span');
        label.textContent = labels[index] || chromatic[index];
        var text = svgElement('text', {
          x: lx.toFixed(1), y: (ly + 4).toFixed(1), 'text-anchor': 'middle',
          fill: isScale ? '#f4d8a8' : '#6f8399', 'font-size': isCharacteristic ? 14 : 12,
          'font-weight': isCharacteristic ? 700 : 500, 'font-family': 'Segoe UI, Microsoft YaHei, sans-serif'
        });
        text.textContent = labels[index] || chromatic[index];
        svg.appendChild(text);
        var title = svgElement('title');
        title.textContent = (labels[index] || chromatic[index]) + (isCharacteristic ? '（特征音）' : (isScale ? '（调式音级）' : '（调外音）'));
        var dot = svgElement('circle', {
          cx: x.toFixed(1), cy: y.toFixed(1), r: isCharacteristic ? 9 : (isScale ? 6.5 : 3.2),
          fill: isCharacteristic ? '#df8c7b' : (isScale ? '#efb45b' : '#384b60'),
          stroke: isCharacteristic ? 'rgba(255,255,255,.35)' : 'none', 'stroke-width': 1
        });
        dot.appendChild(title);
        svg.appendChild(dot);
      }
      if (points.length > 1) {
        svg.appendChild(svgElement('polygon', {
          points: points.join(' '), fill: 'rgba(239,180,91,.075)', stroke: 'rgba(239,180,91,.5)',
          'stroke-width': 1.8, 'stroke-linejoin': 'round'
        }));
      }
      svg.appendChild(svgElement('circle', { cx: center, cy: center, r: 47, fill: 'rgba(13,23,35,.9)', stroke: 'rgba(239,180,91,.3)', 'stroke-width': 1 }));
      var centerText = svgElement('text', {
        x: center, y: center - 4, 'text-anchor': 'middle', fill: '#fff',
        'font-size': 20, 'font-weight': 700, 'font-family': 'Segoe UI, Microsoft YaHei, sans-serif'
      });
      centerText.textContent = 'C';
      var centerMode = svgElement('text', {
        x: center, y: center + 17, 'text-anchor': 'middle', fill: '#efb45b',
        'font-size': 10, 'font-family': 'Segoe UI, Microsoft YaHei, sans-serif'
      });
      centerMode.textContent = mode.short;
      append(svg, centerText, centerMode);
      wheel.appendChild(svg);
    }

    function renderInfo(mode) {
      info.replaceChildren();
      info.appendChild(element('h4', '', mode.name));
      info.appendChild(element('p', '', mode.mood));
      var labels = scaleLabels(mode);
      var scaleLine = element('div', 'mv-scale-line');
      (mode.intervals || []).forEach(function (interval, index) {
        var pc = ((interval % 12) + 12) % 12;
        var chip = element('span', 'mv-note-chip', mode.scale[index] || labels[pc]);
        if ((mode.characteristic || []).includes(interval)) chip.classList.add('mv-char-note');
        scaleLine.appendChild(chip);
      });
      info.appendChild(scaleLine);
      var characteristicNames = (mode.characteristic || []).map(function (interval) {
        var pc = ((interval % 12) + 12) % 12;
        return labels[pc] || chromatic[pc];
      });
      info.appendChild(element('p', '', '特征音：' + (characteristicNames.length ? characteristicNames.join('、') : '无固定特征音')));
      info.appendChild(element('p', '', '完整和弦库存：' + mode.catalogCount + ' 个；调内三和弦：' +
        (mode.heptatonic ? mode.triads.length : mode.subsetCount + ' 个音阶子集和弦')));
      if (mode.heptatonic && mode.triads.length) {
        var list = element('div', 'mv-triad-list');
        mode.triads.forEach(function (triad) {
          var row = element('div', 'mv-triad');
          append(row, element('b', '', triad.roman + ' ' + triad.notes.join('·')), element('span', '', triad.functionLabel));
          list.appendChild(row);
        });
        info.appendChild(list);
      }
      info.appendChild(note('调式中心由中心音、音程结构、低音与落点共同建立；音轮只显示静态音高关系。'));
    }

    modes.forEach(function (mode) {
      var button = element('button', 'mv-mode-pick', mode.short);
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () { choose(mode.id); });
      buttons[mode.id] = button;
      picker.appendChild(button);
    });

    function choose(id) {
      var mode = modes.find(function (candidate) { return candidate.id === id; });
      if (!mode) return;
      Object.keys(buttons).forEach(function (key) {
        var active = key === id;
        buttons[key].classList.toggle('is-active', active);
        buttons[key].setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      drawWheel(mode);
      renderInfo(mode);
    }

    placeVisual('visual-modes', visual.section, '展开十六种调式原始表格');
    choose(modes[0].id);
  }

  function renderGoals() {
    var rows = tableRows('visual-goals');
    if (!rows.length) return;
    var visual = makeVisual('配器卡', '目标效果：材料、进行与风险修正',
      '从“想得到什么效果”反查可用材料；每张卡同时列出最容易出错的地方。');
    var grid = element('div', 'mv-goals');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-goal');
      card.appendChild(element('h4', '', cellText(cells[0])));
      var rowsToAdd = [
        ['材料', cellText(cells[1]), false],
        ['进行', cells[2] ? cells[2].innerHTML : cellText(cells[2]), true]
      ];
      rowsToAdd.forEach(function (definition) {
        var row = element('div', 'mv-goal-row');
        var value = element('span');
        if (definition[2]) value.innerHTML = definition[1];
        else value.textContent = definition[1];
        append(row, element('b', '', definition[0]), value);
        card.appendChild(row);
      });
      card.appendChild(element('div', 'mv-goal-risk', '风险与修正：' + cellText(cells[3])));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    visual.body.appendChild(note('这些是可操作的编配建议，不是教材强制规则；效果还受旋律、节奏、音区、织体与持续时间影响。'));
    placeVisual('visual-goals', visual.section, '展开目标效果原始表格');
  }

  function renderModeActions() {
    var modeActions = (Array.isArray(DATA.modeActions) ? DATA.modeActions : []).filter(function (mode) {
      return mode.heptatonic && mode.chords && mode.chords.length;
    });
    if (!modeActions.length) return;
    var visual = makeVisual('和弦有向图', '逐和弦速查：留在此调式，或把同一音集重释到别处',
      '选择调式与当前和弦。金色实线是当前调式内的直接连接；青色虚线是同一音集在另一个调式中的解释。点击目标可查看级数、功能与确认要求。');
    var controls = element('div', 'mv-controls');
    var label = element('label');
    label.appendChild(document.createTextNode('当前调式'));
    var select = element('select', 'mv-select');
    select.setAttribute('aria-label', '选择和弦图调式');
    modeActions.forEach(function (mode) {
      var option = element('option', '', 'C · ' + mode.name);
      option.value = mode.id;
      select.appendChild(option);
    });
    label.appendChild(select);
    append(controls, label, element('span', 'mv-hint', '节点与边由引擎数据生成；转调仍要由新调终止与结构位置确认'));
    var legend = element('div', 'mv-legend');
    append(legend,
      append(el('span'), element('i', 'mv-key'), document.createTextNode('同调式直接连接')),
      append(el('span'), element('i', 'mv-key dashed'), document.createTextNode('同一音集重释')));
    var rail = element('div', 'mv-chord-rail');
    var stage = element('div', 'mv-graph-stage');
    var detail = element('div', 'mv-detail');
    detail.setAttribute('aria-live', 'polite');
    append(visual.body, controls, legend, rail, stage, detail);
    visual.body.appendChild(note('图中的连线只表示可解释的级数关系，不表示历史作品已经使用该转调。中介和弦还需新调 V–I、终止式和结构位置共同确认。', '#claim-pivot-common-chord', '查看中介和弦依据'));

    var currentMode = null;
    var railButtons = {};
    var graphObserver = null;

    function el(tag) { return element(tag); }

    function modeName(id) {
      var found = (DATA.modes || []).find(function (mode) { return mode.id === id; });
      return found ? found.name : id;
    }

    function showInstruction() {
      detail.replaceChildren();
      var title = element('div', 'mv-detail-title');
      append(title, element('strong', '', '读图方法'), badge('程序关系', 'gold'));
      append(detail, title,
        element('p', '', '先选当前和弦，再沿金色实线留在原调式，或沿青色虚线查看同一音集的另一个调式身份。'),
        element('p', '', '青色目标只说明“这个音集在那里也有级数解释”；是否形成转调，取决于后续确认。'));
    }

    function showTarget(mode, chord, target) {
      detail.replaceChildren();
      var title = element('div', 'mv-detail-title');
      append(title, element('strong', '', target.label), badge(target.isPivot ? '中介和弦' : '重释目标', target.isPivot ? 'gold' : ''));
      if (String(target.category || '').indexOf('borrow') >= 0) title.appendChild(badge('借用/交替', 'warm'));
      var meta = element('p');
      meta.appendChild(element('strong', '', '当前：'));
      meta.appendChild(document.createTextNode('C ' + mode.name + ' 的 ' + chord.roman + '（' + chord.notes.join('·') + '）'));
      var targetLine = element('p');
      targetLine.appendChild(element('strong', '', '目标：'));
      targetLine.appendChild(document.createTextNode(target.tonic + ' ' + modeName(target.modeId) + ' 的 ' + target.roman +
        '，功能为 ' + target.function + '。'));
      var relation = element('p');
      relation.appendChild(element('strong', '', '关系：'));
      relation.appendChild(document.createTextNode(target.relation + '。两个写法共享同一组音，级数与功能解释不同。'));
      var confirmation = element('p');
      confirmation.appendChild(element('strong', '', '确认：'));
      confirmation.appendChild(document.createTextNode('目标音集出现后，需要用目标调的属—主、终止式或持续音建立新中心；只出现一次重释通常不足以判为转调。'));
      append(detail, title, meta, targetLine, relation, confirmation);
      var links = element('p');
      var pivotLink = element('a', '', '中介和弦依据');
      pivotLink.href = '#claim-pivot-common-chord';
      var confirmLink = element('a', '', '转调确认依据');
      confirmLink.href = '#claim-modulation-confirmation';
      append(links, pivotLink, document.createTextNode(' · '), confirmLink);
      detail.appendChild(links);
      var targetMode = modeActions.find(function (candidate) { return candidate.id === target.modeId; });
      if (targetMode) {
        var switchButton = element('button', 'mv-mode-pick', '在图中查看目标调式');
        switchButton.type = 'button';
        switchButton.addEventListener('click', function () { selectMode(target.modeId, target.roman); });
        detail.appendChild(switchButton);
      }
    }

    function drawGraph(stageNode, currentNode, nextButtons, targetButtons) {
      var prefix = 'mv-chord-' + (++arrowId);
      var markers = arrowMarkers(prefix, { next: '#efb45b', target: '#61c7bd' });
      var svg = svgElement('svg', { class: 'mv-graph-svg', 'aria-hidden': 'true' });
      svg.appendChild(markers.defs);
      stageNode.insertBefore(svg, stageNode.firstChild);
      sizeSvg(svg, stageNode);
      nextButtons.forEach(function (button) {
        pathBetween(svg, stageNode, currentNode, button, {
          className: 'mv-graph-edge is-next', stroke: '#efb45b', width: 1.8, opacity: 0.82,
          marker: markers.ids.next
        });
      });
      targetButtons.forEach(function (button) {
        pathBetween(svg, stageNode, currentNode, button, {
          className: 'mv-graph-edge is-target', stroke: '#61c7bd', width: 1.45,
          dash: '5 5', opacity: 0.82, marker: markers.ids.target
        });
      });
    }

    function renderGraph(modeId, roman) {
      var mode = modeActions.find(function (candidate) { return candidate.id === modeId; }) || modeActions[0];
      var chord = mode.chords.find(function (candidate) { return candidate.roman === roman; }) || mode.chords[0];
      currentMode = mode;
      Object.keys(railButtons).forEach(function (key) {
        var active = key === chord.roman;
        railButtons[key].classList.toggle('is-active', active);
        railButtons[key].setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (graphObserver) graphObserver.disconnect();
      stage.replaceChildren();
      var currentRow = element('div', 'mv-current-row');
      var currentNode = element('div', 'mv-graph-node is-current');
      append(currentNode,
        element('span', 'mv-node-roman', chord.roman),
        element('span', 'mv-node-notes', chord.notes.join(' · ')),
        element('span', 'mv-node-meta', 'C ' + mode.name + ' · ' + chord.functionLabel));
      currentRow.appendChild(currentNode);
      stage.appendChild(currentRow);
      var nextButtons = [];
      var nextLane = element('div', 'mv-graph-lane');
      nextLane.appendChild(element('div', 'mv-lane-label', '留在此调式'));
      var nextGrid = element('div', 'mv-node-grid');
      (chord.next || []).forEach(function (next) {
        if (next.roman === chord.roman) return;
        var button = element('button', 'mv-graph-node is-next');
        button.type = 'button';
        append(button,
          element('span', 'mv-node-roman', next.roman),
          element('span', 'mv-node-notes', (next.notes || []).join(' · ')),
          element('span', 'mv-node-meta', (next.reason || '程序候选') + (next.score != null ? ' · 得分 ' + Number(next.score).toFixed(2) : '')));
        button.addEventListener('click', function () { renderGraph(mode.id, next.roman); });
        nextButtons.push(button);
        nextGrid.appendChild(button);
      });
      if (!nextButtons.length) nextGrid.appendChild(element('span', 'mv-muted', '当前数据没有同调式候选。'));
      nextLane.appendChild(nextGrid);
      stage.appendChild(nextLane);
      var targetButtons = [];
      var targetLane = element('div', 'mv-graph-lane');
      targetLane.appendChild(element('div', 'mv-lane-label', '同一音集重释'));
      var targetGrid = element('div', 'mv-node-grid targets');
      (chord.targets || []).forEach(function (target) {
        var button = element('button', 'mv-graph-node is-target');
        button.type = 'button';
        append(button,
          element('span', 'mv-node-roman', target.roman),
          element('span', 'mv-node-notes', target.tonic + ' ' + modeName(target.modeId)),
          element('span', 'mv-node-meta', (target.isPivot ? '中介 · ' : '') + target.function));
        button.addEventListener('click', function () {
          targetButtons.forEach(function (candidate) { candidate.classList.remove('is-selected'); });
          button.classList.add('is-selected');
          showTarget(mode, chord, target);
        });
        targetButtons.push(button);
        targetGrid.appendChild(button);
      });
      if (!targetButtons.length) targetGrid.appendChild(element('span', 'mv-muted', '当前库存没有同音集目标；仍可用半音声部、等音或色彩中介另行连接。'));
      targetLane.appendChild(targetGrid);
      stage.appendChild(targetLane);
      showInstruction();
      window.requestAnimationFrame(function () {
        drawGraph(stage, currentNode, nextButtons, targetButtons);
        if (typeof ResizeObserver === 'function') {
          graphObserver = new ResizeObserver(function () {
            var old = stage.querySelector('.mv-graph-svg');
            if (old) old.remove();
            drawGraph(stage, currentNode, nextButtons, targetButtons);
          });
          graphObserver.observe(stage);
        }
      });
    }

    function selectMode(modeId, roman) {
      var mode = modeActions.find(function (candidate) { return candidate.id === modeId; }) || modeActions[0];
      select.value = mode.id;
      rail.replaceChildren();
      railButtons = {};
      mode.chords.forEach(function (chord) {
        var button = element('button', 'mv-chord-pick');
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        append(button,
          element('b', '', chord.roman),
          element('span', '', chord.notes.join(' · ')),
          element('span', '', chord.functionLabel));
        button.addEventListener('click', function () { renderGraph(mode.id, chord.roman); });
        railButtons[chord.roman] = button;
        rail.appendChild(button);
      });
      renderGraph(mode.id, roman || mode.chords[0].roman);
    }

    select.addEventListener('change', function () { selectMode(select.value); });
    placeVisual('visual-mode-actions', visual.section, '展开 3.5 逐和弦速查原始表格');
    selectMode(modeActions[0].id);
  }

  function renderCadences() {
    var rows = tableRows('visual-cadences');
    if (!rows.length) return;
    var visual = makeVisual('终止路径', '八种终止式：公式、功能方向与判据',
      '公式按箭头拆成节点；功能徽标说明收束方向，判据说明同一公式在什么条件下才成为终止。');
    var list = element('div', 'mv-cadences');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-cadence');
      card.appendChild(element('div', 'mv-cadence-name', cellText(cells[0])));
      var path = element('div', 'mv-cadence-path');
      cellText(cells[1]).split('→').forEach(function (part, index, parts) {
        if (index > 0) path.appendChild(element('span', 'mv-formula-arrow', '→'));
        var token = element('span', 'mv-formula-node' + (part.indexOf('或') >= 0 ? ' alt' : ''), part.trim());
        path.appendChild(token);
      });
      path.appendChild(badge(cellText(cells[2]), 'gold'));
      append(card, path, element('div', 'mv-cadence-rule', cellText(cells[3])));
      list.appendChild(card);
    });
    visual.body.appendChild(list);
    visual.body.appendChild(note('终止强度还取决于低音、旋律位置、节拍强弱、前文准备与后文是否继续。'));
    placeVisual('visual-cadences', visual.section, '展开终止式原始表格');
  }

  var RELATION_META = {
    near: { short: '近关系', color: '#61c7bd', note: '调号与功能都接近' },
    relative: { short: '关系调', color: '#8399d4', note: '共享同一音阶集合' },
    parallel: { short: '同主音', color: '#efb45b', note: '主音不变，改变调式' },
    medium: { short: '中关系', color: '#df8c7b', note: '调号较远，但仍有共同和弦' },
    common: { short: '共同音多', color: '#9fc47a', note: '音阶重叠多，但功能关系较松' },
    chromatic: { short: '色彩关系', color: '#b8a6ff', note: '三度或半音色彩，中介较少' },
    distant: { short: '远关系', color: '#9aa8b8', note: '共同音和共同和弦都很少' }
  };

  function relationMeta(type) {
    return RELATION_META[type] || { short: type || '关系待定', color: '#9aa8b8', note: '按音集与调号计算' };
  }

  function renderRoutes() {
    var groups = Array.isArray(DATA.routes) ? DATA.routes : [];
    if (!groups.length) return;

    var coreModes = {
      naturalMinor: true, harmonicMinor: true, melodicMinor: true, dorian: true,
      phrygian: true, lydian: true, mixolydian: true, locrian: true
    };
    var metaOrder = ['near', 'relative', 'parallel', 'medium', 'common', 'chromatic', 'distant'];
    var counts = {};
    groups.forEach(function (target) {
      var type = target.relation && target.relation.type ? target.relation.type : 'distant';
      counts[type] = (counts[type] || 0) + 1;
    });

    var visual = makeVisual('转调网络', '6.3 从 C 大调出发：' + groups.length + ' 个目标调',
      '外环是大小调中心，中环是七声调式，内环是对称音阶与五声材料。箭头从源调指向目标调；选择节点后可切换完整和弦路线。');

    var filterBar = element('div', 'mv-network-filters');
    filterBar.setAttribute('role', 'group');
    filterBar.setAttribute('aria-label', '按调性关系筛选目标');
    var controls = element('div', 'mv-network-controls');
    var legend = element('div', 'mv-network-legend');
    append(controls, filterBar, legend);
    visual.body.appendChild(controls);

    var scroll = element('div', 'mv-network-scroll');
    var stage = element('div', 'mv-network-stage');
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', 'C 大调转调目标有向图');
    var svg = svgElement('svg', { class: 'mv-network-svg', 'aria-hidden': 'true' });
    stage.appendChild(svg);

    var sourceNode = element('div', 'mv-network-source');
    append(sourceNode,
      element('b', '', 'C 大调'),
      element('span', '', '源调中心'),
      element('small', '', '选择目标调查看路线'));
    stage.appendChild(sourceNode);

    var nodeRecords = [];
    groups.forEach(function (target, index) {
      var type = target.relation && target.relation.type ? target.relation.type : 'distant';
      var meta = relationMeta(type);
      var ring = target.ring === 'key' ? 'outer' : (coreModes[target.targetMode] ? 'middle' : 'inner');
      var node = element('button', 'mv-network-node is-' + ring);
      node.type = 'button';
      node.setAttribute('aria-pressed', 'false');
      node.setAttribute('aria-label', target.targetLabel + '，' + meta.short + '，' + (target.routes || []).length + ' 条路线');
      node.style.setProperty('--mv-relation-color', meta.color);
      append(node,
        element('span', 'mv-network-label', target.targetLabel),
        element('span', 'mv-network-relation', meta.short),
        element('span', 'mv-network-count', (target.routes || []).length + ' 条路线'));
      node.addEventListener('click', function () { selectTarget(index, true); });
      node.addEventListener('mouseenter', function () { highlightEdge(index, true); });
      node.addEventListener('mouseleave', function () { highlightEdge(index, false); });
      node.addEventListener('focus', function () { highlightEdge(index, true); });
      node.addEventListener('blur', function () { highlightEdge(index, false); });
      stage.appendChild(node);
      nodeRecords.push({ node: node, target: target, type: type, ring: ring, index: index, edge: null });
    });
    scroll.appendChild(stage);
    visual.body.appendChild(scroll);

    var detail = element('div', 'mv-network-detail');
    detail.setAttribute('aria-live', 'polite');
    visual.body.appendChild(detail);
    visual.body.appendChild(note('箭头只表示“可以从源调转向目标调”，不表示历史作品已经这样转调。每条路线仍需由新调 V–I、终止式、持续音或结构位置确认。得分是功能、共同音、声部平滑与确认强度的启发式排序。',
      '#claim-modulation-confirmation', '查看转调确认依据'));

    var filterButtons = [];
    function makeFilter(type, label, count) {
      var button = element('button', 'mv-network-filter');
      button.type = 'button';
      button.setAttribute('aria-pressed', type === 'all' ? 'true' : 'false');
      append(button, element('span', '', label), element('b', '', count));
      button.style.setProperty('--mv-relation-color', type === 'all' ? '#efb45b' : relationMeta(type).color);
      button.addEventListener('click', function () { applyFilter(type); });
      filterButtons.push({ type: type, node: button });
      filterBar.appendChild(button);
      return button;
    }
    makeFilter('all', '全部', groups.length);
    metaOrder.forEach(function (type) {
      if (counts[type]) makeFilter(type, relationMeta(type).short, counts[type]);
    });

    metaOrder.forEach(function (type) {
      if (!counts[type]) return;
      var meta = relationMeta(type);
      var item = element('span', 'mv-network-legend-item');
      var swatch = element('i');
      swatch.style.background = meta.color;
      append(item, swatch, document.createTextNode(meta.short + '：' + meta.note + '（' + counts[type] + '）'));
      legend.appendChild(item);
    });
    controls.appendChild(element('p', 'mv-network-pan-hint', '图较宽：左右滑动浏览，中心节点是 C 大调。'));

    var activeType = 'all';
    var activeIndex = 0;
    var markerPrefix = 'mv-network-' + (++arrowId);
    var colors = {};
    metaOrder.forEach(function (type) { colors[type] = relationMeta(type).color; });
    var markers = arrowMarkers(markerPrefix, colors);
    svg.appendChild(markers.defs);

    function boundaryPoint(rect, towardX, towardY) {
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = towardX - cx;
      var dy = towardY - cy;
      if (!dx && !dy) return { x: cx, y: cy };
      var sx = dx ? (rect.width / 2) / Math.abs(dx) : Infinity;
      var sy = dy ? (rect.height / 2) / Math.abs(dy) : Infinity;
      var scale = Math.min(sx, sy);
      return { x: cx + dx * scale, y: cy + dy * scale };
    }

    function layoutNetwork() {
      var width = stage.clientWidth;
      var height = stage.clientHeight;
      if (!width || !height) return;
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      var cx = width / 2;
      var cy = height / 2;
      sourceNode.style.left = (cx - sourceNode.offsetWidth / 2) + 'px';
      sourceNode.style.top = (cy - sourceNode.offsetHeight / 2) + 'px';

      var rings = {
        inner: { rx: Math.min(width * 0.135, 112), ry: Math.min(height * 0.135, 108), offset: Math.PI / 7 },
        middle: { rx: Math.min(width * 0.255, 208), ry: Math.min(height * 0.25, 190), offset: Math.PI / 8 },
        outer: { rx: Math.min(width * 0.41, 335), ry: Math.min(height * 0.40, 300), offset: -Math.PI / 2 }
      };
      ['inner', 'middle', 'outer'].forEach(function (ringName) {
        var records = nodeRecords.filter(function (record) { return record.ring === ringName; });
        var ring = rings[ringName];
        records.forEach(function (record, index) {
          var angle = ring.offset + (Math.PI * 2 * index / Math.max(1, records.length));
          var x = cx + Math.cos(angle) * ring.rx;
          var y = cy + Math.sin(angle) * ring.ry;
          record.node.style.left = (x - record.node.offsetWidth / 2) + 'px';
          record.node.style.top = (y - record.node.offsetHeight / 2) + 'px';
        });
      });

      Array.prototype.slice.call(svg.querySelectorAll('.mv-network-edge')).forEach(function (edge) { edge.remove(); });
      var stageRect = stage.getBoundingClientRect();
      var sourceRect = sourceNode.getBoundingClientRect();
      var sourceCx = sourceRect.left - stageRect.left + sourceRect.width / 2;
      var sourceCy = sourceRect.top - stageRect.top + sourceRect.height / 2;
      nodeRecords.forEach(function (record) {
        var targetRect = record.node.getBoundingClientRect();
        var targetCx = targetRect.left - stageRect.left + targetRect.width / 2;
        var targetCy = targetRect.top - stageRect.top + targetRect.height / 2;
        var from = boundaryPoint({
          left: sourceRect.left - stageRect.left, top: sourceRect.top - stageRect.top,
          width: sourceRect.width, height: sourceRect.height
        }, targetCx, targetCy);
        var to = boundaryPoint({
          left: targetRect.left - stageRect.left, top: targetRect.top - stageRect.top,
          width: targetRect.width, height: targetRect.height
        }, sourceCx, sourceCy);
        var path = svgElement('path', {
          class: 'mv-network-edge',
          d: 'M ' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + ' L ' + to.x.toFixed(1) + ' ' + to.y.toFixed(1),
          fill: 'none',
          stroke: relationMeta(record.type).color,
          'stroke-width': record.index === activeIndex ? 1.8 : 0.9,
          'stroke-opacity': activeType === 'all' || activeType === record.type ? (record.index === activeIndex ? 0.95 : 0.38) : 0.06,
          'marker-end': 'url(#' + (markers.ids[record.type] || markers.ids.distant) + ')'
        });
        record.edge = path;
        svg.appendChild(path);
      });
      if (!scroll.dataset.centered && scroll.scrollWidth > scroll.clientWidth + 4) {
        scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
        scroll.dataset.centered = '1';
      }
    }

    function highlightEdge(index, active) {
      var record = nodeRecords[index];
      if (!record || !record.edge) return;
      record.edge.setAttribute('stroke-width', active ? '2.4' : (index === activeIndex ? '1.8' : '0.9'));
      record.edge.setAttribute('stroke-opacity', active ? '1' : (activeType === 'all' || activeType === record.type ? (index === activeIndex ? '0.95' : '0.38') : '0.06'));
    }

    function showRoute(target, routeIndex, view, tabs) {
      var route = target.routes[routeIndex];
      if (!route) return;
      Array.prototype.forEach.call(tabs.children, function (tab, index) {
        tab.classList.toggle('is-active', index === routeIndex);
        tab.setAttribute('aria-pressed', index === routeIndex ? 'true' : 'false');
      });
      view.replaceChildren();
      var path = element('div', 'mv-route-graph');
      path.setAttribute('role', 'list');
      path.setAttribute('aria-label', target.targetLabel + ' 的和弦路线');
      (route.steps || []).forEach(function (step, stepIndex, steps) {
        if (stepIndex > 0) path.appendChild(element('span', 'mv-route-arrow', '→'));
        var isPivot = step.category === 'pivot' || String(step.roman || '').indexOf('=') >= 0;
        var node = element('div', 'mv-route-step' +
          (stepIndex === 0 ? ' is-source' : '') +
          (stepIndex === steps.length - 1 ? ' is-target' : '') +
          (isPivot ? ' is-pivot' : ''));
        node.setAttribute('role', 'listitem');
        append(node,
          element('b', '', step.roman || '—'),
          element('span', 'mv-route-step-notes', (step.notes || []).join(' · ')),
          element('small', '', step.key || step.function || ''));
        if (isPivot && step.sourceRoman && step.targetRoman) {
          node.appendChild(element('small', 'mv-route-pivot-label', step.sourceRoman + ' → ' + step.targetRoman));
        }
        path.appendChild(node);
      });
      view.appendChild(path);
      view.appendChild(element('p', 'mv-route-explain', route.explanation || ''));
    }

    function selectTarget(index, userInitiated) {
      activeIndex = index;
      var target = groups[index];
      var meta = relationMeta(target.relation && target.relation.type);
      nodeRecords.forEach(function (record, nodeIndex) {
        var selected = nodeIndex === index;
        record.node.classList.toggle('is-selected', selected);
        record.node.setAttribute('aria-pressed', selected ? 'true' : 'false');
        if (record.edge) {
          record.edge.setAttribute('stroke-width', selected ? '1.8' : '0.9');
          var dim = activeType !== 'all' && activeType !== record.type;
          record.edge.setAttribute('stroke-opacity', dim ? '0.06' : (selected ? '0.95' : '0.38'));
        }
      });
      detail.replaceChildren();
      var head = element('div', 'mv-network-detail-head');
      var title = element('div');
      append(title, element('h4', '', target.targetLabel), element('p', '', meta.note + '；从 C 大调出发。'));
      append(head, title, badge(target.relation && target.relation.label ? target.relation.label : meta.short, 'gold'));
      detail.appendChild(head);

      var tabs = element('div', 'mv-route-tabs');
      tabs.setAttribute('role', 'group');
      tabs.setAttribute('aria-label', '选择转调方案');
      var view = element('div', 'mv-route-view');
      (target.routes || []).forEach(function (route, routeIndex) {
        var tab = element('button', 'mv-route-tab');
        tab.type = 'button';
        tab.setAttribute('aria-pressed', routeIndex === 0 ? 'true' : 'false');
        append(tab,
          element('b', '', route.recipe || ('方案 ' + (routeIndex + 1))),
          element('span', '', '得分 ' + Number(route.score || 0).toFixed(3)));
        tab.addEventListener('click', function () { showRoute(target, routeIndex, view, tabs); });
        tabs.appendChild(tab);
      });
      detail.appendChild(tabs);
      detail.appendChild(view);
      showRoute(target, 0, view, tabs);
      if (userInitiated && detail.scrollIntoView && detail.getBoundingClientRect().top > window.innerHeight) {
        detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    function applyFilter(type) {
      activeType = type;
      filterButtons.forEach(function (button) {
        button.node.setAttribute('aria-pressed', button.type === type ? 'true' : 'false');
        button.node.classList.toggle('is-active', button.type === type);
      });
      var hasVisible = false;
      nodeRecords.forEach(function (record, index) {
        var visible = type === 'all' || record.type === type;
        record.node.classList.toggle('is-muted', !visible);
        if (visible && !hasVisible) hasVisible = true;
        if (record.edge) {
          record.edge.setAttribute('stroke-opacity', visible ? (index === activeIndex ? '0.95' : '0.38') : '0.06');
          record.edge.setAttribute('stroke-width', index === activeIndex ? '1.8' : '0.9');
        }
      });
      var firstVisible = nodeRecords.findIndex(function (record) { return type === 'all' || record.type === type; });
      if (firstVisible >= 0) selectTarget(firstVisible);
    }

    placeVisual('visual-routes', visual.section, '展开 6.3 全部路线原始表格');
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(layoutNetwork).observe(stage);
    } else {
      window.addEventListener('resize', layoutNetwork);
    }
    window.requestAnimationFrame(function () {
      layoutNetwork();
      applyFilter('all');
    });
  }

  function renderModulationTypes() {
    var rows = tableRows('visual-modulation-types');
    if (!rows.length) return;
    var visual = makeVisual('方法卡', '十种转调方法：做法、适用场景与失效条件',
      '每张卡聚焦一个操作入口，并把它最容易出错的条件放在同一视线内。');
    var grid = element('div', 'mv-methods');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-method');
      append(card, element('b', '', cellText(cells[0])));
      var method = element('p');
      method.appendChild(element('strong', '', '做法：'));
      method.appendChild(document.createTextNode(cellText(cells[1])));
      var use = element('p');
      use.appendChild(element('strong', '', '适用：'));
      use.appendChild(document.createTextNode(cellText(cells[2])));
      append(card, method, use, element('span', '', '风险：' + cellText(cells[3])));
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    placeVisual('visual-modulation-types', visual.section, '展开转调类型原始表格');
  }

  function renderTonicization() {
    var rows = tableRows('visual-tonicization');
    if (!rows.length) return;
    var visual = makeVisual('判据谱', '离调与转调：六项证据的强弱变化',
      '每一行按同一维度比较两种分析。实际作品常落在两端之间，应写明证据，而不是只贴一个标签。');
    var list = element('div', 'mv-spectrum');
    rows.forEach(function (cells) {
      var row = element('div', 'mv-spectrum-row');
      var track = element('div', 'mv-spectrum-track');
      append(track,
        element('div', 'mv-spectrum-left', cellText(cells[1])),
        element('div', 'mv-spectrum-arrow', '⇄'),
        element('div', 'mv-spectrum-right', cellText(cells[2])));
      append(row, element('div', 'mv-spectrum-label', cellText(cells[0])), track);
      list.appendChild(row);
    });
    visual.body.appendChild(list);
    visual.body.appendChild(note('持续时间、结构位置与终止确认通常是最有区分力的证据；单看某一和弦不能完成判断。'));
    placeVisual('visual-tonicization', visual.section, '展开离调/转调判据原始表格');
  }

  function renderBooks() {
    var rows = tableRows('visual-books');
    if (!rows.length) return;
    var visual = makeVisual('教材索引', '十五本教材：角色、代表页与互证位置',
      '卡片保留每本教材在本体系中的分工与代表页。页码可直接跳到影印页与 OCR 对照。');
    var grid = element('div', 'mv-books');
    rows.forEach(function (cells) {
      var card = element('article', 'mv-book');
      var head = element('div', 'mv-book-head');
      append(head, element('h4', '', cellText(cells[0])), badge(cellText(cells[4]) || 'complete', 'gold'));
      card.appendChild(head);
      card.appendChild(element('p', '', cellText(cells[1])));
      card.appendChild(element('p', '', cellText(cells[2])));
      var pages = element('div', 'mv-source');
      pages.innerHTML = cells[3] ? cells[3].innerHTML : '';
      card.appendChild(pages);
      grid.appendChild(card);
    });
    visual.body.appendChild(grid);
    var archive = element('p', 'mv-note');
    archive.appendChild(document.createTextNode('逐页影印与全文：'));
    var archiveLink = element('a', '', '打开教材库');
    archiveLink.href = 'books/index.html';
    archive.appendChild(archiveLink);
    visual.body.appendChild(archive);
    placeVisual('visual-books', visual.section, '展开十五本教材原始表格');
  }

  function run(render, label) {
    try {
      render();
    } catch (error) {
      if (window.console && console.error) console.error('[manual-visuals] ' + label, error);
    }
  }

  run(renderPrinciples, 'principles');
  run(renderLevels, 'levels');
  run(renderTheory, 'theory');
  run(renderPeriods, 'periods');
  run(renderPeriodEvidence, 'period evidence');
  run(renderTendencies, 'tendencies');
  run(renderModes, 'modes');
  run(renderGoals, 'goals');
  run(renderModeActions, 'mode actions');
  run(renderCadences, 'cadences');
  run(renderRoutes, 'routes');
  run(renderModulationTypes, 'modulation types');
  run(renderTonicization, 'tonicization');
  run(renderBooks, 'books');
})();
