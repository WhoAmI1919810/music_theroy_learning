#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build static SVG diagrams from shared evidence data. No PDF rasterization."""
import html
import json
import os
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE = os.path.join(ROOT, "evidence")
OUT_DIR = os.path.join(ROOT, "docs", "assets", "figures")

FONT = "'Noto Sans SC','Source Han Sans SC','Microsoft YaHei',sans-serif"
SERIF = "'Noto Serif SC','Source Han Serif SC','Songti SC',serif"
INK = "#172123"
MUTED = "#66716d"
LINE = "#d5cbbb"
PAPER = "#fffdf8"
FAMILY_COLORS = {
    "string": "#2c6c68",
    "woodwind": "#b36b32",
    "brass": "#9b5a24",
    "percussion": "#8b7d49",
    "key": "#6f6292",
}


def esc(value):
    return html.escape(str(value), quote=True)


def load(name):
    with open(os.path.join(EVIDENCE, name), encoding="utf-8") as handle:
        return json.load(handle)


def note_name(midi):
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    midi = int(round(float(midi)))
    return names[midi % 12] + str(midi // 12 - 1)


def text_block(x, y, lines, size=12, weight=400, fill=INK, line_height=None, anchor="start", family=FONT):
    line_height = line_height or size * 1.55
    spans = "".join(
        '<tspan x="%s" y="%s">%s</tspan>' % (x, y + index * line_height, esc(line))
        for index, line in enumerate(lines)
    )
    return '<text font-family="%s" font-size="%s" font-weight="%s" fill="%s" text-anchor="%s">%s</text>' % (
        family, size, weight, fill, anchor, spans
    )


def build_instrument_ranges(instruments):
    rows = instruments["INSTRUMENTS"]
    width = 1200
    top = 94
    row_height = 25
    left = 205
    right = 44
    bottom = 112
    height = top + len(rows) * row_height + bottom
    x_min, x_max = 20, 110

    def x_for(midi):
        return left + (midi - x_min) * (width - left - right) / (x_max - x_min)

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-labelledby="title desc">' % (width, height),
        '<title id="title">管弦乐器实际发声音域与舒适音区</title>',
        '<desc id="desc">横轴为实际发声音高，浅色为物理音域，深色为常用舒适音区。</desc>',
        '<rect width="%d" height="%d" fill="%s"/>' % (width, height, PAPER),
        text_block(28, 36, ["配器速查：实际发声音域与舒适音区"], 22, 700, INK, 28, family=SERIF),
        text_block(28, 62, ["横轴为实际发声音高；移调乐器已换算。浅色带为物理音域，深色带为常用工作区，不等同于技巧极限。"], 12, 400, MUTED),
    ]

    for midi in range(24, 109, 12):
        x = x_for(midi)
        parts.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="1"/>' % (
            x, top - 10, x, top + len(rows) * row_height + 4, LINE
        ))
        parts.append('<text x="%.1f" y="%d" text-anchor="middle" font-family="%s" font-size="10" fill="%s">C%d</text>' % (
            x, top - 16, FONT, MUTED, midi // 12 - 1
        ))

    previous_family = None
    for index, item in enumerate(rows):
        y = top + index * row_height
        color = FAMILY_COLORS.get(item["family"], "#777")
        if index % 2 == 0:
            parts.append('<rect x="18" y="%d" width="%d" height="%d" fill="#f8f3e9"/>' % (y, width - 36, row_height))
        if item["family"] != previous_family:
            parts.append('<line x1="18" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (y, width - 18, y, LINE))
            parts.append('<text x="28" y="%d" font-family="%s" font-size="10" font-weight="700" fill="%s">%s</text>' % (
                y + 17, FONT, color, esc(item["familyLabel"])
            ))
            previous_family = item["family"]
        parts.append('<text x="192" y="%d" text-anchor="end" font-family="%s" font-size="11" font-weight="600" fill="%s">%s</text>' % (
            y + 17, FONT, INK, esc(item["name"])
        ))
        if item["id"] == "percussion":
            parts.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3" stroke-dasharray="4 5" opacity=".55"/>' % (
                left, y + 13, left + 92, y + 13, color
            ))
            parts.append('<text x="%d" y="%d" font-family="%s" font-size="10" fill="%s">无固定音高</text>' % (
                left + 104, y + 17, FONT, MUTED
            ))
            continue
        low, high = item["midiLow"], item["midiHigh"]
        comfort_low, comfort_high = item["comfortable"]
        x_low, x_high = x_for(low), x_for(high)
        xc_low, xc_high = x_for(comfort_low), x_for(comfort_high)
        parts.append('<rect x="%.1f" y="%d" width="%.1f" height="10" rx="5" fill="%s" opacity=".2" stroke="%s" stroke-opacity=".55"/>' % (
            x_low, y + 8, max(3, x_high - x_low), color, color
        ))
        parts.append('<rect x="%.1f" y="%d" width="%.1f" height="6" rx="3" fill="%s" opacity=".9"/>' % (
            xc_low, y + 10, max(3, xc_high - xc_low), color
        ))
        parts.append('<text x="%.1f" y="%d" text-anchor="middle" font-family="%s" font-size="8" fill="%s">%s</text>' % (
            (x_low + x_high) / 2, y + 7, FONT, MUTED, note_name(low) + "–" + note_name(high)
        ))

    legend_y = top + len(rows) * row_height + 34
    parts.append('<rect x="28" y="%d" width="34" height="10" rx="5" fill="#2c6c68" opacity=".2" stroke="#2c6c68"/>' % legend_y)
    parts.append('<text x="72" y="%d" font-family="%s" font-size="11" fill="%s">物理音域</text>' % (legend_y + 9, FONT, MUTED))
    parts.append('<rect x="142" y="%d" width="34" height="8" rx="4" fill="#2c6c68"/>' % (legend_y + 1))
    parts.append('<text x="186" y="%d" font-family="%s" font-size="11" fill="%s">常用舒适音区</text>' % (legend_y + 9, FONT, MUTED))
    parts.append(text_block(28, legend_y + 34, [
        "读法：先确认实际发声音高，再判断目标音区落在物理边缘还是舒适区。高音与低音两端的力度、音准和音色控制成本都会上升。"
    ], 11, 400, MUTED))
    parts.append("</svg>")
    return "\n".join(parts)


def build_doubling_matrix():
    width, height = 1100, 590
    matrix_x, matrix_y = 205, 150
    col_width, row_height = 420, 170
    cells = [
        ("同度或八度", "增加已有声部的支撑", ["同度增加人数、音准稳定与音色融合。", "八度扩展音高平面与频带。", "结构层数不变。"], "#2c6c68"),
        ("不同音高", "平行音程或和弦分配", ["平行三/六度、和弦音分配、弦乐分部。", "增加已有旋律或和声的频带与响度。", "通常仍归入同一结构层。"], "#4b7b9c"),
        ("同音或八度", "节奏化重叠或冲突", ["同音交错、切分、hocket 可形成节奏层。", "若没有节奏设计，会被听成声部竞争。", "结构结果取决于节奏与句法。"], "#9e4d5b"),
        ("不同音高", "对位或独立结构层", ["独立旋律、副旋律、固定音型。", "需要独立音区、起音或句法支撑。", "听者能把它追成另一条线。"], "#78699a"),
    ]
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-labelledby="title desc">' % (width, height),
        '<title id="title">加倍方式与结构层关系</title>',
        '<desc id="desc">按音高关系和节奏句法两个维度区分同度、八度、平行音程、节奏分层和对位。</desc>',
        '<rect width="%d" height="%d" fill="%s"/>' % (width, height, PAPER),
        text_block(28, 36, ["加倍是否新增声部：先看音高关系，再看节奏与句法"], 22, 700, INK, 28, family=SERIF),
        text_block(28, 62, ["音高关系与节奏/句法共同决定结构层数是否增加。"], 12, 400, MUTED),
        text_block(matrix_x + col_width / 2, 102, ["节奏与句法：相同"], 12, 700, INK, 18, "middle"),
        text_block(matrix_x + col_width * 1.5, 102, ["节奏与句法：不同"], 12, 700, INK, 18, "middle"),
        text_block(matrix_x - 18, matrix_y + row_height / 2, ["音高关系", "同音或八度"], 12, 700, INK, 19, "end"),
        text_block(matrix_x - 18, matrix_y + row_height * 1.5, ["音高关系", "不同音高"], 12, 700, INK, 19, "end"),
    ]
    for index, (axis, title, lines, color) in enumerate(cells):
        col, row = index % 2, index // 2
        x = matrix_x + col * col_width
        y = matrix_y + row * row_height
        parts.append('<rect x="%d" y="%d" width="%d" height="%d" rx="12" fill="%s" fill-opacity=".07" stroke="%s" stroke-width="1.2"/>' % (
            x, y, col_width, row_height, color, color
        ))
        parts.append(text_block(x + 18, y + 28, [axis], 10, 700, color))
        parts.append(text_block(x + 18, y + 56, [title], 17, 700, INK, 24, family=SERIF))
        parts.append(text_block(x + 18, y + 88, lines, 11, 400, MUTED, 19))
    parts.append(text_block(28, 535, [
        "判断顺序：先问这段是否需要新的独立线。若不需要，同度、八度、平行音程与和弦分配只是改变响度贡献、频谱与音高平面；"
    ], 11, 400, MUTED))
    parts.append(text_block(28, 556, [
        "若需要新的线，就必须在音高、节奏、起音或句法上提供独立信息。"
    ], 11, 400, MUTED))
    parts.append("</svg>")
    return "\n".join(parts)


def envelope_panel(x, y, width, height, title, gap, note):
    parts = [text_block(x, y - 18, [title], 14, 700, INK, 20, family=SERIF)]
    base = y + height - 36
    left = x + 22
    right = x + width - 22
    parts.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (left, base, right, base, LINE))
    a_end = left + int(width * 0.59)
    b_start = left + int(width * (0.61 if gap else 0.49))
    if gap:
        parts.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#9e4d5b" opacity=".08"/>' % (
            a_end, y + 18, max(8, b_start - a_end), base - y - 18
        ))
        gap_x = (a_end + b_start) / 2
        parts.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#9e4d5b" stroke-width="1.3" stroke-dasharray="4 4"/>' % (
            gap_x, y + 28, gap_x, base
        ))
        parts.append('<text x="%.1f" y="%d" text-anchor="middle" font-family="%s" font-size="10" font-weight="700" fill="#9e4d5b">留缝</text>' % (
            gap_x, y + 42, FONT
        ))
    else:
        overlap_end = left + int(width * 0.58)
        parts.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#2c6c68" opacity=".1"/>' % (
            b_start, y + 18, max(8, overlap_end - b_start), base - y - 18
        ))
        parts.append('<text x="%d" y="%d" text-anchor="middle" font-family="%s" font-size="10" font-weight="700" fill="#2c6c68">交叠</text>' % (
            (b_start + overlap_end) / 2, y + 42, FONT
        ))
    a_peak = y + 45
    b_peak = y + 52
    a_path = "M %d %d C %d %d, %d %d, %d %d L %d %d C %d %d, %d %d, %d %d Z" % (
        left, base, left + 18, y + 63, left + 55, a_peak, left + 92, a_peak,
        a_end - 28, a_peak, a_end - 12, a_peak + 25, a_end - 5, base - 30, a_end, base
    )
    b_path = "M %d %d C %d %d, %d %d, %d %d C %d %d, %d %d, %d %d Z" % (
        b_start, base, b_start + 10, y + 82, b_start + 30, b_peak, b_start + 54, b_peak,
        right - 8, b_peak + 16, right, base - 45, right, base
    )
    parts.append('<path d="%s" fill="#2c6c68" fill-opacity=".18" stroke="#2c6c68" stroke-width="1.8"/>' % a_path)
    parts.append('<path d="%s" fill="#bb5d2b" fill-opacity=".18" stroke="#bb5d2b" stroke-width="1.8"/>' % b_path)
    parts.append('<text x="%d" y="%d" font-family="%s" font-size="11" font-weight="700" fill="#2c6c68">A 渐退</text>' % (
        left + 34, a_peak - 10, FONT
    ))
    parts.append('<text x="%d" y="%d" font-family="%s" font-size="11" font-weight="700" fill="#bb5d2b">B 进入</text>' % (
        right - 76, b_peak - 10, FONT
    ))
    parts.append(text_block(x, y + height - 8, [note], 10, 400, MUTED, 16))
    return parts


def build_transfer_overlap():
    width, height = 1100, 500
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-labelledby="title desc">' % (width, height),
        '<title id="title">乐器转接的交叠与留缝</title>',
        '<desc id="desc">平滑转接让前后乐器短暂交叠；需要清晰断句或重新起音时留出间隙。</desc>',
        '<rect width="%d" height="%d" fill="%s"/>' % (width, height, PAPER),
        text_block(28, 36, ["转接方式由断句目标决定：平滑交叠或清晰留缝"], 22, 700, INK, 28, family=SERIF),
        text_block(28, 62, ["交叠让两件乐器在换手处同时发声；留缝保留重复音、断句或发音法的边界。"], 12, 400, MUTED),
    ]
    parts.extend(envelope_panel(62, 112, 460, 270, "平滑衔接：交叠", False, "适合长线、连奏与同质音色。交叠长度取决于起音速度、力度与音色差异。"))
    parts.extend(envelope_panel(578, 112, 460, 270, "需要清晰断开：留缝", True, "适合同音重复、断奏、句法分界或前后乐器起音差异很大的情况。"))
    parts.append(text_block(28, 434, ["核对顺序：实际响度 → 起音速度 → 音区与音色 → 交叠长度。"], 12, 700, INK, 19))
    parts.append(text_block(28, 458, ["例：低音区长笛独奏约 72–75 分贝，难以接续大管 80 分贝以上的声压；此时换双簧管或单簧管，比只写一个力度记号可靠。"], 11, 400, MUTED, 17))
    parts.append(text_block(28, 478, ["依据：杨立青中册 PDF p.6；施咏康 PDF p.448。详见手册对应章节的论点链接。"], 10, 400, MUTED, 16))
    parts.append("</svg>")
    return "\n".join(parts)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    instruments = load("instruments.json")
    outputs = {
        "instrument-ranges.svg": build_instrument_ranges(instruments),
        "doubling-structure.svg": build_doubling_matrix(),
        "transfer-overlap.svg": build_transfer_overlap(),
    }
    for name, content in outputs.items():
        ET.fromstring(content)
        target = os.path.join(OUT_DIR, name)
        with open(target, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        print("wrote", target)


if __name__ == "__main__":
    main()
