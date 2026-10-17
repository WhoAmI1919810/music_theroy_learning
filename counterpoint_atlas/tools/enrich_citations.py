#!/usr/bin/env python3
"""Merge the curated cross-textbook citations for the counterpoint manual.

Every added quotation is checked against the OCR text of the exact PDF page
before the source file is written.  The table keeps one citation per textbook
and claim; repeated pages from the same book are intentionally collapsed.
"""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "evidence" / "sources.json"
WORK = Path(r"E:\codex\_counterpoint_work")
OCR_FILES = [
    ROOT / "corpus" / "ocr" / "source-pages.jsonl",
    WORK / "content_ocr.jsonl",
    WORK / "content_ocr_extra.jsonl",
    WORK / "toc_ocr.jsonl",
    WORK / "ocr_wenfeng.jsonl",
    WORK / "ocr_duan_upper.jsonl",
    WORK / "ocr_miao.jsonl",
]

BOOK_IDS = {
    "陈铭志 赋格曲写作.PDF": "chen_write",
    "段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf": "duan_upper",
    "对位化和声学（陈洪）.pdf": "chen_hong",
    "柯克兰 对位法概要.pdf": "kirkpatrick",
    "缪天瑞 对位法概论.PDF": "miao",
    "斯克列勃科夫 复调音乐.pdf": "skrebkov",
    "苏夏 实用对位法.PDF": "suxia",
    "文锋《复调音乐分析与写作》.pdf": "wenfeng",
}


def load_ocr():
    pages = {}
    for path in OCR_FILES:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            book = row.get("book") or row.get("book_id")
            page = row.get("page") or row.get("pdf_page")
            if book and page:
                pages[(book, int(page))] = row.get("text", "")
    return pages


def normalize(text):
    return re.sub(r"\s+", "", text or "")


ADDITIONS = {
    "hist.style-system": [
        ("段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf", 13, "第三篇 第三章 对比二声部辅助教材", "所谓严格和自由的区分并不是指规则的繁难与宽松，而是全面的表示不同历史时期的不同风格。"),
        ("对位化和声学（陈洪）.pdf", 13, "导言", "对位法可以是欧洲中世纪的作曲技，經过帕勒斯特利那到享德尔和巴赫的时代，它的發展可完全停止了"),
        ("斯克列勃科夫 复调音乐.pdf", 16, "序论：复调音乐的历史阶段", "对比式和模仿式复調音乐作为一种独立的音乐形式在西欧的专业音乐中直到15-16世紀"),
        ("苏夏 实用对位法.PDF", 3, "序", "近代對位和古典对位在表現上有着题明的不同，但在雨者之本上业無過大的差巽。"),
    ],
    "hist.strict-training": [
        ("柯克兰 对位法概要.pdf", 5, "第一章 定义和一般规则", "严格对位的练习是应用已指定好的不同节奏型，写出包含有一个或儿个不同的曲调声部去伴随固定调。"),
        ("苏夏 实用对位法.PDF", 8, "第一章 绪论：严格训练与自由写作", "因要發得作的自由，需先受格而苛刻的約束"),
    ],
    "hist.tonal-basis": [
        ("对位化和声学（陈洪）.pdf", 14, "导言", "以近世的和声学为基磅，加進了有用的对位技"),
    ],
    "species.first-boundaries": [
        ("段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf", 53, "第三篇 第三章 分类对位：第一种方式", "以上各种音程均可以自由采用，但象同、五（十二）、八度这样的完全协和音程不宜多用，尤忌经常连续出现以致音响空洞。"),
        ("文锋《复调音乐分析与写作》.pdf", 34, "第二章 福克斯五种基本对位法：第一类", "在第一类对位中，只能采用协和音程，不协和音程不得使用"),
        ("缪天瑞 对位法概论.PDF", 16, "二声部对位：第一类", "二聲部对位法的原则是通樣：對主题旋律的各音符附以完全協和或不完全協和的和普，原來是很簡單的。"),
    ],
    "species.second-passing": [
        ("段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf", 57, "第三篇 第三章 分类对位：全音符对二分音符", "二、四、七、九度等音程，可以作为经过音或辅助音，在次强拍上自由运用"),
        ("文锋《复调音乐分析与写作》.pdf", 36, "第二章 第二类对位：二音对一音", "第二个二分音符如果是不协和音，现阶段只能是经过音。"),
    ],
    "species.third-parallels": [
        ("段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf", 54, "第三篇 第三章 分类对位：第一种方式", "平行八度和同度使两声部成为同一旋律，故绝对禁止。平行五度，一方面使两声部溶成同类的旋律线，音响空洞，一方面易于产生两个调性，故也不许应用。"),
        ("柯克兰 对位法概要.pdf", 9, "第一章 定义和一般规则：五、八度", "两个声部都是以跳进进到同向的五度或八度，不论在内声部或在外声部都一样要禁止"),
        ("文锋《复调音乐分析与写作》.pdf", 37, "第二章 第三类对位：四音对一音", "相邻的平行五、八度都要禁止"),
    ],
    "species.fourth-suspension": [
        ("段平泰 - 复调音乐  上册 - 人民音乐出版社.pdf", 55, "第三篇 第三章 分类对位：全音符对切分音", "留音一律下行二度级进解决一真正的二度级进"),
        ("文锋《复调音乐分析与写作》.pdf", 38, "第二章 第四类对位：切分音", "如果是延留音，必须有准备、延留、解决三个阶段。"),
    ],
    "species.fifth-rhythm": [
        ("文锋《复调音乐分析与写作》.pdf", 40, "第二章 第五类对位：混合节奏", "第五类对位是指在全音符的固定曲调之上或之下，运用混合节奏写作对位旋律。"),
    ],
    "fugue.definition": [
        ("陈铭志 赋格曲写作.PDF", 4, "绪论", "赋格曲是一种独立体裁的乐曲，它建立在模仿复调音乐的基础上。乐曲一开始，主题（一个或两个）就在各个声部依次进入"),
    ],
    "fugue.subject-identity": [
        ("陈铭志 赋格曲写作.PDF", 18, "第一章 主题", "一首赋格曲的主题应当有鲜明的风格、突出的个性、明确的调式、调性和比较适中的长度与宽度"),
    ],
    "fugue.subject-properties": [
        ("陈铭志 赋格曲写作.PDF", 8, "第一章 主题", "主题的音域也不宜过分宽广，一般在八度左右"),
    ],
    "fugue.answer-dominant": [
        ("陈铭志 赋格曲写作.PDF", 23, "第二章 答题", "答题在属调上(主题的上方五度，或下方四度)回答主题，是在实际作品中最常见的一种。"),
    ],
    "fugue.tonal-answer": [
        ("陈铭志 赋格曲写作.PDF", 25, "第二章 答题：守调答题", "此时也可采用守调答题（比较少见）。"),
    ],
    "fugue.countersubject": [
        ("陈铭志 赋格曲写作.PDF", 32, "第三章 对题", "当对题伴随着主题进入时，应服从主题的调性，当对题伴随着答题进入时，则应服从答题的调性。"),
    ],
    "fugue.exposition-order": [
        ("陈铭志 赋格曲写作.PDF", 38, "第四章 呈示部", "呈示部中的主题与答题常是交替进入的，进入的次数根据声部的数目而定。"),
    ],
    "fugue.exposition-principles": [
        ("陈铭志 赋格曲写作.PDF", 38, "第四章 呈示部", "呈示部是赋格曲的开始部分。主题（包括答题))依次在各声部作最初的陈述"),
    ],
    "fugue.episode-definition": [
        ("陈铭志 赋格曲写作.PDF", 46, "第五章 间插部", "主题每次重新进入之前出现的音乐段落，称为间插段。"),
    ],
    "fugue.episode-function": [
        ("陈铭志 赋格曲写作.PDF", 47, "第五章 间插部：作用", "间插段大多用呈示部中的材料作为基础，采用主题或对题等部分动机来加以展开。"),
    ],
    "fugue.middle": [
        ("陈铭志 赋格曲写作.PDF", 64, "第六章 中间部", "中间部的调性布局保持在近关系调的范围内属于一般规律。"),
    ],
    "fugue.stretto-definition": [
        ("陈铭志 赋格曲写作.PDF", 74, "第七章 紧接模仿", "紧接模仿只是在另一声部重复主题的结构，紧接模仿结束后即转入自由发展的段落"),
    ],
    "fugue.stretto-difference": [
        ("陈铭志 赋格曲写作.PDF", 74, "第七章 紧接模仿", "紧接模仿与一般的卡农写作有所区别。"),
    ],
    "fugue.recap": [
        ("陈铭志 赋格曲写作.PDF", 84, "第八章 再现部与尾声", "主题在主调上重新出现，这是比较常见的处理方法。"),
    ],
    "fugue.pedal": [
        ("陈铭志 赋格曲写作.PDF", 90, "第八章 再现部与尾声：持续音", "属音持续音，常用在再现部开始的部分来加强乐曲将趋向于结束的作用。"),
    ],
    "fugue.overall": [
        ("陈铭志 赋格曲写作.PDF", 93, "第九章 赋格曲的整体布局", "两端（指开始与结束部分)的调性是稳定的，中间是不稳定的。"),
    ],
    "fugue.multiple": [
        ("陈铭志 赋格曲写作.PDF", 104, "第十章 二重、三重赋格曲", "根据两个或三个主题写作的赋格曲，则称为二重赋格曲或三重赋格曲。"),
    ],
    "fugue.bach-structure": [
        ("陈铭志 赋格曲写作.PDF", 93, "第九章 赋格曲的整体布局", "赋格曲总是以主题为中心，并通过主题的各种变形和调式、调性以及音区等方面的变化，将各个部分紧密地联系在一起"),
    ],
    "fugue.subject-memory": [
        ("陈铭志 赋格曲写作.PDF", 8, "第一章 主题", "为了使主题更加集中、概括地表达一个完整的乐思，主题不宜太长。"),
    ],
}


def main():
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    ocr = load_ocr()
    bad = []
    added = 0
    for claim in data["claims"]:
        existing = []
        seen_books = set()
        for citation in claim["citations"]:
            citation["bookId"] = BOOK_IDS.get(citation["bookId"], citation["bookId"])
            if citation["bookId"] in seen_books:
                continue
            seen_books.add(citation["bookId"])
            existing.append(citation)
        claim["citations"] = existing
        for book, page, chapter, quote in ADDITIONS.get(claim["id"], []):
            book_id = BOOK_IDS.get(book, book)
            if book_id in seen_books:
                continue
            text = ocr.get((book, page), "")
            if normalize(quote) not in normalize(text):
                bad.append("%s | %s p.%s | %s" % (claim["id"], book, page, quote))
                continue
            claim["citations"].append({
                "bookId": book_id,
                "pdfPage": page,
                "chapter": chapter,
                "quote": quote,
            })
            seen_books.add(book)
            added += 1
    if bad:
        raise SystemExit("Quotes not found in OCR:\n" + "\n".join(bad))
    SOURCES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("added citations:", added)


if __name__ == "__main__":
    main()
