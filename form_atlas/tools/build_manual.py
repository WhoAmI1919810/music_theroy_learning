#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the static form-theory manual and Markdown companion from evidence JSON."""
import html
import json
import os
import re


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE = os.path.join(ROOT, "evidence")
DOCS = os.path.join(ROOT, "docs")
THEORY = os.path.join(EVIDENCE, "theory.json")
SOURCE_MAP = os.path.join(EVIDENCE, "source-map.json")
CASES = os.path.join(EVIDENCE, "cases.json")
BOOKS = os.path.join(ROOT, "corpus", "books.json")
OUT_HTML = os.path.join(DOCS, "曲式学手册.html")
OUT_MD = os.path.join(DOCS, "曲式理论体系.md")


def read_json(path):
    with open(path, encoding="utf-8-sig") as handle:
        return json.load(handle)


def esc(value):
    return html.escape(str(value or ""))


def page_tag(page):
    return "p%04d" % int(page)


def ref_anchor(claim_id, page):
    slug = re.sub(r"[^0-9A-Za-z_-]+", "-", str(claim_id)).strip("-").lower()
    return "ref-%s-p%04d" % (slug, int(page))


def case_ref_anchor(case_id, page):
    slug = re.sub(r"[^0-9A-Za-z_-]+", "-", str(case_id)).strip("-").lower()
    return "case-ref-%s-p%04d" % (slug, int(page))


THEME_INIT = '''<script data-site-theme-init>(function(){var d=document.documentElement;var t='light';try{var s=localStorage.getItem('music-site-theme');if(s==='dark'||s==='light')t=s;}catch(e){}d.setAttribute('data-theme',t);d.style.colorScheme=t;var p=location.pathname;var section='home';if(p.indexOf('/form_atlas/docs/books/')>=0)section='form-books';else if(p.indexOf('/form_atlas/docs/')>=0)section='form-manual';else if(p.indexOf('/form_atlas/app/')>=0)section='form-app';else if(p.indexOf('/harmony_atlas/docs/books/')>=0)section='harmony-books';else if(p.indexOf('/harmony_atlas/docs/')>=0)section='harmony-manual';else if(p.indexOf('/harmony_atlas/app/')>=0)section='harmony-app';else if(p.indexOf('/counterpoint_atlas/docs/books/')>=0)section='counterpoint-books';else if(p.indexOf('/counterpoint_atlas/docs/')>=0)section='counterpoint-manual';else if(p.indexOf('/counterpoint_atlas/tutorial/')>=0)section='counterpoint-tutorial';else if(p.indexOf('/counterpoint_atlas/app/')>=0)section='counterpoint-app';else if(p.indexOf('/orchestration_atlas/docs/books/')>=0)section='orchestration-books';else if(p.indexOf('/orchestration_atlas/docs/')>=0)section='orchestration-manual';else if(p.indexOf('/orchestration_atlas/app/')>=0)section='orchestration-app';d.setAttribute('data-site-section',section);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0b1119':'#f5efe4');})();</script>'''


CSS = r'''
:root{--paper:var(--theme-surface);--ink:var(--theme-text);--muted:var(--theme-muted);--line:var(--theme-line);--gold:var(--theme-gold);--teal:var(--theme-teal);--violet:var(--theme-violet);--red:var(--theme-red)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:66px}body{margin:0;min-width:320px;background:transparent;color:var(--ink);font:16px/1.8 "Noto Serif SC","Source Han Serif SC","Songti SC",Georgia,serif;-webkit-font-smoothing:antialiased}img,svg{max-width:100%}a{color:var(--teal);text-decoration:none}a:hover{text-decoration:underline}
.skip{position:absolute;left:-9999px;top:8px;z-index:50;background:var(--gold);color:#17120b;padding:9px 13px;border-radius:8px}.skip:focus{left:12px}
.manual-layout{width:min(calc(100% - 30px),1320px);margin:0 auto;display:grid;grid-template-columns:250px minmax(0,1fr);gap:22px;padding:22px 0 55px;align-items:start}
.manual-aside{position:sticky;top:calc(var(--music-site-nav-height,46px) + 12px);max-height:calc(100vh - var(--music-site-nav-height,46px) - 24px);overflow:auto;padding:16px 16px 16px 0;border:0;border-right:1px solid var(--line);border-radius:0;background:transparent;box-shadow:none;font-family:"Segoe UI","Noto Sans SC","Microsoft YaHei",sans-serif}
.manual-brand{display:flex;gap:9px;align-items:center;margin-bottom:13px}.manual-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(145deg,var(--gold),color-mix(in srgb,var(--gold) 60%,#754616));color:#17120b;font:800 18px/1 serif}.manual-brand b{display:block;font-size:14px}.manual-brand small{display:block;color:var(--muted);font-size:9px;letter-spacing:.09em;text-transform:uppercase}.manual-aside nav{display:grid;gap:2px}.manual-aside nav a{padding:5px 7px;border-radius:6px;color:var(--theme-soft);font-size:11px}.manual-aside nav a:hover{background:var(--theme-surface-2);color:var(--ink);text-decoration:none}.manual-aside nav .sub{padding-left:18px;color:var(--muted);font-size:10px}.aside-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:12px}.aside-links a{border:1px solid var(--line);border-radius:6px;padding:4px 7px;font-size:9px;background:var(--theme-surface-2)}
.manual-main{min-width:0}.manual-head{padding:clamp(26px,5vw,58px) 0 25px;border-bottom:2px solid var(--line)}.eyebrow{margin:0 0 9px;color:var(--teal);font-size:10px;font-weight:750;letter-spacing:.16em;text-transform:uppercase;font-family:"Segoe UI",sans-serif}.manual-head h1{margin:0;font-size:clamp(34px,5vw,58px);line-height:1.12;letter-spacing:-.04em}.manual-head .lead{max-width:800px;margin:17px 0 0;color:var(--theme-soft);font-size:15px}.meta-line{margin-top:11px;color:var(--muted);font:10px/1.7 ui-monospace,monospace}
section.chapter{margin:35px 0 0;scroll-margin-top:66px}.chapter>h2{margin:0 0 13px;padding-bottom:8px;border-bottom:1px solid var(--line);font-size:clamp(23px,3.5vw,34px);line-height:1.35;letter-spacing:-.02em}.chapter h3{margin:24px 0 8px;font-size:20px}.chapter h4{margin:18px 0 6px;font-size:15px;color:var(--gold)}.chapter p{margin:8px 0;color:var(--theme-soft)}.chapter ul,.chapter ol{padding-left:23px;color:var(--theme-soft)}.chapter li{margin:5px 0}.criterion{margin:14px 0;padding:10px 0 0;border-top:1px solid var(--line);color:var(--theme-soft);font-size:14px}.criterion strong{color:var(--gold)}.principle-prose{margin:14px 0;color:var(--theme-soft);font-size:14px;line-height:1.85}.principle-prose strong{color:var(--gold)}
.chain{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:15px 0}.chain div{padding:10px 0 0;border:0;border-top:2px solid var(--gold);border-radius:0;background:transparent;font-size:12px}.chain b{display:block;color:var(--gold);font-size:11px}.chain span{display:block;color:var(--muted);margin-top:4px;line-height:1.55}
.concept-graph{overflow:auto;margin:16px 0 20px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--theme-surface-2);-webkit-overflow-scrolling:touch}.concept-graph svg{display:block;width:100%;min-width:760px;height:auto}.graph-edge{stroke:var(--theme-line-strong,#6b7280);stroke-width:1.25;fill:none}.graph-edge-label{font:9px ui-sans-serif,"Microsoft YaHei",sans-serif;fill:var(--muted);paint-order:stroke;stroke:var(--theme-surface-2);stroke-width:4px;stroke-linejoin:round}.graph-node rect{stroke:var(--line);stroke-width:1}.graph-node text{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;fill:var(--ink);text-anchor:middle;dominant-baseline:middle}.graph-node .node-label{font-size:11px;font-weight:700}.graph-node .node-en{font-size:7px;fill:var(--muted);letter-spacing:.03em}.graph-node.layer-material rect{fill:color-mix(in srgb,var(--gold) 20%,var(--paper))}.graph-node.layer-closure rect{fill:color-mix(in srgb,var(--red) 15%,var(--paper))}.graph-node.layer-process rect{fill:color-mix(in srgb,var(--violet) 17%,var(--paper))}.graph-node.layer-type rect{fill:color-mix(in srgb,var(--teal) 16%,var(--paper))}.graph-node.layer-large rect{fill:color-mix(in srgb,var(--theme-soft) 16%,var(--paper))}.graph-legend{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 0}.graph-legend span{padding:3px 7px;border:1px solid var(--line);border-radius:20px;color:var(--muted);font:9px ui-sans-serif,sans-serif}
.node-card{margin:16px 0;padding:14px 0 0;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;break-inside:avoid}.node-card h3{margin:0;font-size:18px}.node-card .en{color:var(--muted);font:9px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.node-card p{font-size:13px}.node-card dl{display:grid;grid-template-columns:70px 1fr;gap:6px;margin:10px 0 0;font-size:12px}.node-card dt{color:var(--muted)}.node-card dd{margin:0;color:var(--theme-soft)}
.form-section{margin:26px 0 0;padding:18px 0 0;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;break-inside:avoid;scroll-margin-top:66px}.form-section h3{margin:0;font-size:23px}.form-section>.en{color:var(--muted);font:9px ui-monospace,monospace}.form-section p{font-size:13px}.strip{display:flex;min-height:52px;margin:12px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--theme-surface-2)}.seg{display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:0;padding:7px;border-right:1px solid var(--line);text-align:center;font-size:11px}.seg:last-child{border-right:0}.seg b{line-height:1.25}.seg small{color:var(--muted);font-size:9px}.seg.a{background:var(--theme-gold-soft)}.seg.b{background:var(--theme-teal-soft)}.seg.c{background:var(--theme-violet-soft)}.seg.d{background:var(--theme-blue-soft)}.seg.development{background:var(--theme-red-soft)}.seg.closing{background:var(--theme-surface-3)}.seg.neutral{background:var(--theme-surface-2)}
.cites{margin:10px 0 0;padding:7px 0 0 12px;border-left:3px solid var(--gold);background:transparent;border-radius:0;font:11px/1.65 "Segoe UI","Microsoft YaHei",sans-serif}.cites b{display:block;color:var(--gold);margin-bottom:4px}.cites a{display:inline;padding:0;border:0;border-bottom:1px solid color-mix(in srgb,var(--gold) 38%,transparent);background:none;font-size:10px}.cites a:hover{text-decoration:none;border-bottom-color:var(--gold)}
.case-entry{margin:22px 0;padding:16px 0 0;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;break-inside:avoid;scroll-margin-top:66px}.case-entry h3{margin:0}.case-entry .case-kicker{color:var(--teal);font:10px "Segoe UI",sans-serif;letter-spacing:.08em}.case-entry p{font-size:13px}.case-note{font-size:12px;color:var(--muted)}.source-list{margin:9px 0 0;padding:0;list-style:none;display:grid;gap:5px}.source-list li{font-size:10px;color:var(--muted)}.source-list a{font-size:10px}
.claim{scroll-margin-top:66px;margin:16px 0;padding:14px 0 0;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;font-family:"Segoe UI","Noto Sans SC","Microsoft YaHei",sans-serif}.claim h3{margin:0;font-size:14px}.claim .statement{color:var(--theme-soft);font-size:12px}.claim blockquote{margin:7px 0 2px;padding-left:10px;border-left:2px solid var(--line);color:var(--theme-soft);font-size:11px}.claim cite{font-style:normal;color:var(--muted);font-size:10px}
.manual-footer{margin-top:42px;padding:18px 0 0;border-top:1px solid var(--line);color:var(--muted);font:10px/1.65 "Segoe UI",sans-serif}
@media(max-width:960px){.manual-layout{display:block;width:calc(100% - 20px);padding-top:12px}.manual-aside{position:relative;top:auto;max-height:none;margin-bottom:13px;padding:0 0 13px;border-right:0;border-bottom:1px solid var(--line)}.manual-aside nav{grid-template-columns:1fr 1fr}.manual-aside nav .sub{padding-left:7px}.manual-main{min-width:0}.chain{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.manual-head h1{font-size:33px}.manual-head .lead{font-size:13px}.chain{grid-template-columns:1fr}.manual-aside nav{grid-template-columns:1fr}.form-section,.case-entry,.claim{padding:12px 0 0}.cites a{font-size:9px}.strip{min-height:46px}.seg{padding:5px 3px;font-size:9px}.seg small{font-size:8px}}
@media print{.manual-aside,.skip{display:none}.manual-layout{display:block;width:auto;padding:0}.manual-head{padding:0 0 15px}.form-section,.case-entry,.claim,.node-card{box-shadow:none}.cites a{border:0;background:none;padding:0}}
'''


def source_links_for_claim(claim, manual_prefix=""):
    links = []
    for source in claim.get("books", []):
        links.append('<a href="books/%s.html#%s">%s · PDF p.%d</a>' % (
            source["book"], ref_anchor(claim["id"], source["page"]), esc(book_by_id[source["book"]]["short"]), source["page"]
        ))
    return " · ".join(links)


def claims_for(form):
    return [claim_by_id[claim_id] for claim_id in form.get("claims", []) if claim_id in claim_by_id]


def all_claim_links(form):
    links = []
    seen = set()
    for claim in claims_for(form):
        for source in claim.get("books", []):
            key = (source["book"], source["page"])
            if key in seen:
                continue
            seen.add(key)
            links.append('<a href="books/%s.html#%s">%s · p.%d</a>' % (
                source["book"], ref_anchor(claim["id"], source["page"]), esc(book_by_id[source["book"]]["short"]), source["page"]
            ))
    return " · ".join(links)


def render_strip(segments):
    return '<div class="strip" role="img" aria-label="%s">%s</div>' % (
        esc(" — ".join(segment["label"] for segment in segments)),
        "".join('<div class="seg %s" style="flex:%s 1 0"><b>%s</b><small>%s</small></div>' % (
            esc(segment.get("role", "neutral")), max(6, segment.get("weight", 1)), esc(segment["label"]), esc(segment.get("sub", ""))
        ) for segment in segments)
    )


def render_concept_graph(theory):
    nodes = theory["nodes"]
    node_by_id = {node["id"]: node for node in nodes}
    min_x = min(node["x"] for node in nodes) - 75
    max_x = max(node["x"] for node in nodes) + 75
    min_y = min(node["y"] for node in nodes) - 35
    max_y = max(node["y"] for node in nodes) + 35
    parts = [
        '<div class="concept-graph" role="img" aria-label="曲式概念关系图：动机构成乐句，乐句形成乐段，终止提供闭合；重复、变化、对比、回归与调性布局生成各种曲式类型。">',
        '<svg viewBox="%d %d %d %d" xmlns="http://www.w3.org/2000/svg">' % (min_x, min_y, max_x - min_x, max_y - min_y),
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>'
    ]
    for edge in theory["edges"]:
        source = node_by_id.get(edge["from"])
        target = node_by_id.get(edge["to"])
        if not source or not target:
            continue
        x1, y1 = source["x"], source["y"]
        x2, y2 = target["x"], target["y"]
        mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
        parts.append('<path class="graph-edge" d="M%.1f %.1f L%.1f %.1f" marker-end="url(#arrow)" style="color:var(--muted)"/>' % (x1, y1, x2, y2))
        parts.append('<text class="graph-edge-label" x="%.1f" y="%.1f" text-anchor="middle">%s</text>' % (mid_x, mid_y - 4, esc(edge.get("label", ""))))
    for node in nodes:
        label = node["label"]
        box_width = max(88, min(142, len(label) * 13 + 24))
        box_height = 34
        x = node["x"] - box_width / 2
        y = node["y"] - box_height / 2
        parts.append('<g class="graph-node layer-%s"><rect x="%.1f" y="%.1f" width="%d" height="%d" rx="8"/><text class="node-label" x="%d" y="%d">%s</text><text class="node-en" x="%d" y="%d">%s</text></g>' % (
            esc(node["layer"]), x, y, box_width, box_height, node["x"], node["y"] - 5, esc(label), node["x"], node["y"] + 10, esc(node.get("en", ""))))
    parts.append('</svg></div>')
    parts.append('<div class="graph-legend">%s</div>' % "".join(
        '<span class="layer-%s">%s</span>' % (esc(layer["id"]), esc(layer["label"])) for layer in theory["layers"]))
    return "".join(parts)


def build_html(theory, claims, cases):
    layers = {layer["id"]: layer["label"] for layer in theory["layers"]}
    nodes_by_layer = {}
    for node in theory["nodes"]:
        nodes_by_layer.setdefault(node["layer"], []).append(node)

    aside = ['<aside class="manual-aside"><div class="manual-brand"><span class="manual-mark">F</span><span><b>曲式学手册</b><small>Form Atlas Manual</small></span></div><nav>']
    aside.append('<a href="#overview">总览与判断链</a>')
    aside.append('<a href="#principles">结构原则</a>')
    aside.append('<a href="#concepts">概念地图</a>')
    for layer in theory["layers"]:
        aside.append('<a class="sub" href="#layer-%s">%s</a>' % (esc(layer["id"]), esc(layer["label"])))
    aside.append('<a href="#forms">曲式类型</a>')
    for form in theory["forms"]:
        aside.append('<a class="sub" href="#form-%s">%s</a>' % (esc(form["id"]), esc(form["label"])))
    aside.append('<a href="#cases">教材案例</a>')
    aside.append('<a href="#analysis">分析流程</a>')
    aside.append('<a href="#evidence">逐条依据</a>')
    aside.append('</nav><div class="aside-links"><a href="../app/">理论地图</a><a href="books/">教材证据</a></div></aside>')

    body = []
    body.append('''<header class="manual-head"><p class="eyebrow">Theory Manual · 教材页可回查</p><h1>曲式理论体系</h1>
<p class="lead">曲式分析先从材料、句读、终止和调性建立证据，再用类型名称概括。本文把概念关系、类型判定、教材案例和分析流程放在同一条证据链上；每个判断都链接到实际 PDF 页。</p>
<div class="meta-line">%d 本教材 · %d 条论点 · %d 种曲式 · %d 个案例 · 页码均为 PDF 物理页</div></header>''' % (
        len(book_by_id), len(claims), len(theory["forms"]), len(cases)))

    body.append('<section class="chapter" id="overview"><h2>1. 总览：不要先报曲式名</h2>')
    body.append('<p>曲式名称是对一组结构关系的概括。先回答四个问题，再决定名称；如果名称无法覆盖全部段落，就明确说明作品组合了哪些曲式原则。</p>')
    body.append('<div class="chain"><div><b>01 材料</b><span>动机、主题、乐句之间是同一、变化、对比还是展开？</span></div><div><b>02 闭合</b><span>终止在哪里形成句读？哪个层级真正结束？</span></div><div><b>03 调性</b><span>调性在哪里离开、建立、回归？是否服从主调？</span></div><div><b>04 类型</b><span>用材料布局、终止层级、调性路径和比例共同命名。</span></div></div>')
    body.append('<p class="criterion"><strong>核心判据：</strong>主题数量不能单独定义奏鸣曲式；段落数量不能单独区分二部与三部；篇幅不能单独区分单三部与复三部。类型由关系决定，不由标签数量决定。</p>')
    body.append('</section>')

    body.append('<section class="chapter" id="principles"><h2>2. 四种结构操作</h2>')
    principle_text = "；".join(
        "<strong>%s</strong>：%s，%s" % (esc(principle["label"]), esc(principle["operation"]), esc(principle["effect"]))
        for principle in theory["principles"])
    body.append('<p class="principle-prose">%s。</p>' % principle_text)
    body.append('</section>')

    body.append('<section class="chapter" id="concepts"><h2>3. 概念地图：从材料到类型</h2>')
    body.append('<p>下图表示概念之间的生成关系。实际作品可以跳过某一级，也可以把多个原则叠在同一段落中；箭头表示“在什么条件下生成下一层结构”。</p>')
    body.append(render_concept_graph(theory))
    for layer in theory["layers"]:
        body.append('<h3 id="layer-%s">%s</h3>' % (esc(layer["id"]), esc(layer["label"])))
        for node in nodes_by_layer.get(layer["id"], []):
            body.append('<article class="node-card"><span class="en">%s</span><h3>%s</h3><p>%s</p><dl><dt>它回答</dt><dd>%s</dd><dt>判断条件</dt><dd>%s</dd><dt>常见误判</dt><dd>%s</dd></dl>' % (
                esc(node.get("en", "")), esc(node["label"]), esc(node["summary"]), esc(node.get("question", "")), esc(node.get("test", "")), esc(node.get("error", ""))))
            related = claims_for({"claims": node.get("claims", [])})
            links = []
            seen = set()
            for claim in related:
                for source in claim.get("books", []):
                    key = (source["book"], source["page"])
                    if key in seen:
                        continue
                    seen.add(key)
                    links.append('<a href="books/%s.html#%s">%s · p.%d</a>' % (
                        source["book"], ref_anchor(claim["id"], source["page"]), esc(book_by_id[source["book"]]["short"]), source["page"]))
            if links:
                body.append('<div class="cites"><b>教材依据</b>%s</div>' % "".join(links))
            body.append('</article>')
    body.append('</section>')

    body.append('<section class="chapter" id="forms"><h2>4. 曲式类型与判定条件</h2>')
    for form in theory["forms"]:
        body.append('<article class="form-section" id="form-%s"><span class="en">%s</span><h3>%s</h3>' % (esc(form["id"]), esc(form["en"]), esc(form["label"])))
        body.append(render_strip(form["structure"]))
        body.append('<p>%s</p>' % esc(form["definition"]))
        body.append('<p><strong>判定条件：</strong>%s</p>' % esc(sentence_join(form.get("tests", []))))
        body.append('<p><strong>容易混淆：</strong>%s</p>' % esc(sentence_join(form.get("errors", []))))
        tonal_note = esc(form.get("tonalNote", ""))
        if tonal_note:
            body.append('<p><strong>调性与结构张力：</strong>%s</p>' % tonal_note)
        related_cases = [item for item in cases if item["id"] in form.get("cases", [])]
        if related_cases:
            body.append('<p class="case-note">相关案例：%s</p>' % " · ".join('<a href="#case-%s">%s《%s》</a>' % (esc(item["id"]), esc(item["composer"]), esc(item["title"])) for item in related_cases))
        links = all_claim_links(form)
        if links:
            body.append('<div class="cites"><b>本节的直接教材依据</b>%s</div>' % links)
        body.append('</article>')
    body.append('</section>')

    body.append('<section class="chapter" id="cases"><h2>5. 教材案例：把判断落到作品</h2>')
    body.append('<p>案例以教材中已有的作品分析为入口。段落条带压缩显示结构关系，具体小节、谱例和临时记号应回到影印页核对。</p>')
    for item in cases:
        form = form_by_id.get(item["form"], {})
        body.append('<article class="case-entry" id="case-%s"><span class="case-kicker">%s</span><h3>%s《%s》</h3>' % (
            esc(item["id"]), esc(form.get("label", "")), esc(item["composer"]), esc(item["title"])))
        body.append(render_strip(item["structure"]))
        body.append('<p>%s</p>' % esc(item["analysis"]))
        body.append('<p><strong>听什么：</strong>%s</p>' % esc(sentence_join(item.get("cues", []))))
        body.append('<h4>教材依据</h4><ul class="source-list">')
        for source in item.get("sources", []):
            body.append('<li><a href="books/%s.html#%s">%s · PDF p.%d ↗</a> %s</li>' % (
                source["book"], case_ref_anchor(item["id"], source["page"]), esc(book_by_id[source["book"]]["title"]), source["page"], esc(source.get("label", ""))))
        body.append('</ul></article>')
    body.append('</section>')

    body.append('<section class="chapter" id="analysis"><h2>6. 分析流程</h2>')
    body.append('<ol>')
    for step in theory["analysisSteps"]:
        body.append('<li><strong>%s</strong><br>%s<br><span class="case-note">检查点：%s</span></li>' % (
            esc(step["title"]), esc(step["detail"]), esc(step["check"])))
    body.append('</ol></section>')

    body.append('<section class="chapter" id="evidence"><h2>7. 逐条依据</h2>')
    body.append('<p>同一理论问题在多种教材中出现时，以下并列全部对应页。链接进入整版影印页，页内反向列出所有引用它的论点。</p>')
    for claim in claims:
        body.append('<article class="claim" id="%s"><h3>%s</h3><p class="statement">%s</p>' % (esc(claim["id"]), esc(claim["topic"]), esc(claim["statement"])))
        for source in claim.get("books", []):
            body.append('<blockquote>“%s”</blockquote><cite>%s · <a href="books/%s.html#%s">PDF p.%d ↗</a></cite>' % (
                esc(source["quote"]), esc(book_by_id[source["book"]]["title"]), source["book"], ref_anchor(claim["id"], source["page"]), source["page"]))
        body.append('</article>')
    body.append('</section>')
    body.append('<footer class="manual-footer">曲式理论地图 · 静态手册。教材页码均为 PDF 物理页；OCR 只辅助检索，谱例以影印为准。</footer>')

    return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1119"><meta name="description" content="曲式理论体系：材料、句法、终止、调性布局与曲式类型，附教材页依据和作品案例。"><title>曲式学手册 · Form Atlas</title>%s<link rel="stylesheet" href="../../site-theme.css" data-site-theme-css><style>%s</style></head><body><a class="skip" href="#main">跳到主要内容</a><div class="manual-layout">%s<main class="manual-main" id="main">%s</main></div><script src="../../site-nav.js" data-site-nav></script></body></html>''' % (
        THEME_INIT, CSS, "".join(aside), "".join(body))


def build_markdown(theory, claims, cases):
    lines = ["# 曲式理论体系", "", "> 页码均为 PDF 物理页。每个引用链接进入教材整版影印；OCR 只用于检索，谱例以影印为准。", ""]
    lines += ["## 1. 判断链", "", "1. 材料：同一、变化、对比或展开。", "2. 闭合：终止形成哪一级句读。", "3. 调性：离开、建立、回归与服从。", "4. 类型：用层级、比例和结构原则共同命名。", ""]
    lines += ["## 2. 概念", ""]
    for node in theory["nodes"]:
        lines += ["### %s" % node["label"], "", node["summary"], "", "- 它回答：%s" % node.get("question", ""), "- 判断条件：%s" % node.get("test", ""), "- 常见误判：%s" % node.get("error", ""), ""]
        related = [claim_by_id[cid] for cid in node.get("claims", []) if cid in claim_by_id]
        links = []
        seen = set()
        for claim in related:
            for source in claim["books"]:
                key = (source["book"], source["page"])
                if key in seen:
                    continue
                seen.add(key)
                links.append("[%s，PDF p.%d](books/%s.html#%s)" % (book_by_id[source["book"]]["short"], source["page"], source["book"], ref_anchor(claim["id"], source["page"])))
        if links:
            lines += ["教材依据：" + "；".join(links), ""]
    lines += ["## 3. 曲式类型", ""]
    for form in theory["forms"]:
        lines += ["### %s" % form["label"], "", form["definition"], "", "结构：`%s`" % " | ".join(segment["label"] for segment in form["structure"]), "", "判定条件：" + sentence_join(form.get("tests", [])), "", "容易混淆：" + sentence_join(form.get("errors", [])), "", "调性与结构张力：" + form.get("tonalNote", ""), ""]
    lines += ["## 4. 教材案例", ""]
    for item in cases:
        lines += ["### %s《%s》" % (item["composer"], item["title"]), "", item["analysis"], "", "结构：`%s`" % " | ".join(segment["label"] for segment in item["structure"]), "", "听什么：" + sentence_join(item.get("cues", []))]
        lines += ["", "教材依据："]
        for source in item.get("sources", []):
            lines.append("- [%s，PDF p.%d](books/%s.html#%s) %s" % (book_by_id[source["book"]]["title"], source["page"], source["book"], case_ref_anchor(item["id"], source["page"]), source.get("label", "")))
        lines.append("")
    lines += ["## 5. 分析流程", ""]
    for index, step in enumerate(theory["analysisSteps"], 1):
        lines += ["%d. **%s**：%s。检查点：%s。" % (index, step["title"], step["detail"], step["check"])]
    lines += ["", "## 6. 逐条教材依据", ""]
    for claim in claims:
        lines += ["### %s" % claim["topic"], "", claim["statement"], ""]
        for source in claim["books"]:
            lines.append("- “%s” —— [%s，PDF p.%d](books/%s.html#%s)" % (source["quote"], book_by_id[source["book"]]["title"], source["page"], source["book"], ref_anchor(claim["id"], source["page"])))
        lines.append("")
    return "\n".join(lines) + "\n"


book_by_id = {}
claim_by_id = {}
form_by_id = {}


def sentence_join(items):
    parts = []
    for item in items:
        text = str(item or "").strip()
        if not text:
            continue
        if text[-1] not in "。！？":
            text += "。"
        parts.append(text)
    return "".join(parts)


def main():
    global book_by_id, claim_by_id, form_by_id
    theory = read_json(THEORY)
    claims = read_json(SOURCE_MAP)["claims"]
    cases = read_json(CASES)["cases"]
    book_by_id = {book["id"]: book for book in read_json(BOOKS)["books"]}
    claim_by_id = {claim["id"]: claim for claim in claims}
    form_by_id = {form["id"]: form for form in theory["forms"]}
    os.makedirs(DOCS, exist_ok=True)
    with open(OUT_HTML, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(build_html(theory, claims, cases))
    with open(OUT_MD, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(build_markdown(theory, claims, cases))
    print("manual html:", OUT_HTML)
    print("manual markdown:", OUT_MD)


if __name__ == "__main__":
    main()
