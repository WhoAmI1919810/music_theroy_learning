#!/usr/bin/env python3
"""Add curated cross-textbook citations and verify every quote against OCR.

Run with --check first. The script only writes after every proposed quote has
been found on the exact PDF page after whitespace normalization.
"""

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "evidence" / "source-map.json"
OCR_DIR = ROOT / "corpus" / "ocr"


DROP = {
    "scale.natural-modes": [
        ("sangtong_chromatic", 5),
    ],
    "dominant.tritone-resolution": [
        ("persichetti_20c", 13),
        ("tchaikovsky_guide", 168),
    ],
    "enharmonic-modulation.four-directions": [
        ("tchaikovsky_guide", 109),
    ],
    "color-harmony.late-tonal": [
        ("sangtong_chromatic", 17),
    ],
    "atonal.definition-persichetti": [
        ("persichetti_20c", 235),
    ],
}


ADD = {
    "scale.natural-modes": [
        ("huacui_color", 27, "“自然七声音阶”中的任何一个音都可能被用作主音，所以一个“自然七声音阶”可以构成七个主音不同的七声调式"),
        ("sangtong_tutorial", 125, "同音列调式交替是指在调式音列相同、宫音位置不变的情况下，调式的中心音改变。"),
    ],
    "dominant.tritone-resolution": [
        ("sangtong_chromatic", 15, "最富于进向主和弦作用的音程是属七和弦中的减五度（或增四度）音程。"),
        ("tchaikovsky_guide", 183, "增四度或其转位在二声部写作中，可以出现在强拍上。但只有当导音上行解决到主音，IV级音作二度下行时才可以。"),
    ],
    "prolongation.sustained-dominant": [
        ("sangtong_tutorial", 268, "属持续产具有属功能的意义.它使音乐保持不稳定与开放性的效果，并有倾向于主和弦的要求"),
        ("tonal_20c_overview", 218, "持续音(pedalpoint,缩写：ped)是一种作曲技法，它开始于和弦音，然后当和声围绕着它作变换时成为和弦外音，最后当和声再一次与其归为一致时，它又成了和弦音。"),
        ("tchaikovsky_guide", 113, "属持续音后通常进人主持续音。"),
        ("beethoven_sonata", 25, "起到加强副调调性作用的属持续音一一降E音共持续了近六小节"),
    ],
    "root-motion.fourth-up": [
        ("sangtong_tutorial", 26, "根音四度上行（或五度下行）属于强进行"),
        ("sangtong_tutorial", 27, "后一和弦的根音是前--和弦中未包含的新音，具有新鲜的效果。因此，这种和弦连接肯定有力，称之为强进行"),
        ("tonal_20c_overview", 112, "调性音乐中最基本的和声运动之一就是下行纯五度(或上行纯四度)进行"),
        ("tchaikovsky_guide", 47, "根音四度上行跳进或五度下行跳进到主和弦的根音"),
    ],
    "function-network.wandering-chords": [
        ("xu_advanced", 206, "在前调和弦功能的认定上，有一定的主观性和多种可能性（游移和弦的特征）"),
    ],
    "prolongation.fixed-bass": [
        ("xu_advanced", 60, "在主属（T、D）双持续音的基础上，通过加人经过音的做法，形成带有级进旋律特征的下行固定音调一一形成固定低音"),
    ],
    "atonal.compound-chord-precursor": [
        ("tonal_20c_overview", 508, "复合和弦（polychord)是由来自于不同和声领域而又同时发声的两个或更多的和弦组成的。"),
        ("xu_advanced", 49, "由于持续音的分层现象，导致近现代和弦的构成方式的改变。如：复合和弦、复功能和弦等。"),
    ],
    "scale.twentieth-century-materials": [
        ("xu_advanced", 469, "这种趋势的进一步发展，形成了各种人工调式音阶的产生，如全音阶、各种循环音阶及各种中古合成音阶的产生"),
        ("tonal_20c_overview", 500, "作曲家也会大量地使用人工音阶（syntheticscales）。"),
        ("persichetti_20c", 41, "音级的自由排列致使新创的音阶构成超出了大调式与小调式的范围。"),
    ],
    "atonal.chord-material": [
        ("sangtong_six", 185, "另一种则打破了三度叠置的和弦构成方法，采用四、五度叠置的方法或各类音程自由结合的方法而形成的复杂的和弦结构。"),
        ("sangtong_tutorial", 382, "这类非三度叠置和弦结构方法，包含有纯四度叠置、纯五度叠置和二度叠置，形成了四度和弦、五度和弦或二度和弦，或形成上述和弦的混合形态。"),
        ("huacui_color", 390, "混合叠置的和弦，一方面可自由地应用于上面三种和声之中"),
    ],
    "form.sonata-conflict": [
        ("xu_advanced", 83, "如奏鸣曲式，在再现部中副部的调性服从，不一定要调式服从，只要主音回来就可以。"),
        ("sangtong_six", 245, "它的主部、副部与它们的展开等各个部分，都需要用不同的和声手法来处理。"),
    ],
    "form.development-tonal-plan": [
        ("tonal_20c_overview", 353, "它也发展调性对比，在准备返回到主调之前涉及若干个调，常常为远关系调。"),
        ("sangtong_six", 265, "在展开性部分，贝多芬运用了各种具有积极动力作用的和声手段，使它与前后的呈示部分、再现部分构成对比。"),
    ],
    "form.development-conflict": [
        ("beethoven_sonata", 3, "曲式内部对比、矛盾冲突、戏剧性发展的推动力。"),
        ("sangtong_six", 265, "贝多芬力求加强和声上的紧张性与不稳定性，来表现音乐内容上的矛盾冲突，并为后面的再现创造条件"),
    ],
    "voice-leading.multiple-solutions": [
        ("sangtong_six", 123, "一个旋律并不只有一种配置方法。"),
        ("tonal_20c_overview", 600, "因为同一个问题也许会有多种正确的答案。"),
    ],
    "voice-leading.dissonance-preparation": [
        ("tchaikovsky_guide", 12, "四个或五个音组成的和弦，往往都包含不协和音程，因此都不是独立出现，必须要有准备并解决到一个大三或小三和弦上。"),
        ("tchaikovsky_guide", 120, "延留音要有预备和解决。延留音的预备是指前一和弦同一声部要包含延留音。"),
    ],
    "inversion.bass-role": [
        ("tchaikovsky_guide", 36, "将根音转移到上方其他声部，低声部不是根音的三和弦，被称为和弦的转位。"),
        ("tonal_20c_overview", 68, "和弦中的任何一个音都可以出现在最下方。"),
    ],
    "secondary-dominant.usage": [
        ("tonal_20c_overview", 274, "所有其他的自然三和弦（当然除了1)都可以成为副属V或V7和弦的临时主和弦。"),
        ("xu_advanced", 81, "而副属和弦总是要解决的，其特征是半音向上。"),
    ],
    "enharmonic.same-sound": [
        ("tonal_20c_overview", 431, "在调性音乐中，有四种和弦可以在不同的调上（不是如G和F#之间的等音调）做出功能的转换"),
    ],
    "enharmonic-modulation.four-directions": [
        ("tchaikovsky_guide", 109, "每一个减七和弦通过等音程转换，可解决到四个不同的三和弦上"),
    ],
    "chromaticism.nineteenth-century-complexity": [
        ("xu_advanced", 474, "如采用高叠和弦、复合和弦、非三度叠置和弦、附加音和弦、五声音调纵合化和弦及线性和声造成的偶然结合和弦等。"),
    ],
    "modal-interchange.mixed-alternation": [
        ("xu_advanced", 257, "混合交替（主音不同，音列不同）"),
    ],
    "color-harmony.function-color-history": [
        ("huacui_color", 5, "第二阶段，自浪漫派到印象派的几乎整个19世纪，是和声的功能性逐步减弱、色彩性逐步增强的时期。"),
    ],
    "color-harmony.late-tonal": [
        ("sangtong_chromatic", 388, "半音化结合不协和和弦的普遍应用，削弱和模糊了调性的感觉和作用"),
    ],
    "sequence.modulating": [
        ("tchaikovsky_guide", 26, "和声模进是指将一组和声进行（包括两个或两个以上的和弦构成一个动机）在不同的音级上予以重复，获得连续上行或下行。"),
        ("tonal_20c_overview", 126, "完全模进，如例7-2b，是将旋律型转移到新的调上。"),
    ],
    "atonal.tonal-continuum": [
        ("sangtong_tutorial", 383, "这一类中包括了许多不同的调性处理方式，从传统调性范围的扩展直至接近无调性的边缘。"),
    ],
    "atonal.definition-persichetti": [
        ("persichetti_20c", 235, "无调性是一个并非严谨的术语，它表示在音乐中明确的调性感觉的削弱或失去，以及在音乐中从不存在调引力的现象。无调性写作是一种声音的组织，它没有和弦的根音关系，摒弃调的建立。"),
        ("xu_advanced", 485, "无调性是指没有调性中心，音响组织缺乏调性感觉的创作手法与音乐类型。"),
    ],
    "atonal.expanded-tonality-overlap": [
        ("xu_advanced", 485, "自由无调性音乐始于20世纪初期，是调性扩张的必然结果。"),
    ],
    "serialism.pitch-order-first": [
        ("tonal_20c_overview", 566, "威伯恩对排序和对称的兴趣为全面序列化铺平了道路，即对包括音高在内的各项音乐参数进行排序，例如节奏、力度和发音法。"),
    ],
}


def normalized(text):
    return re.sub(r"\s+", "", text or "")


def load_ocr():
    pages = {}
    for path in OCR_DIR.glob("*.jsonl"):
        book = path.stem
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("page"):
                pages[(book, int(row["page"]))] = normalized(row.get("text", ""))
    return pages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    data = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    claims = {claim["id"]: claim for claim in data["claims"]}
    ocr = load_ocr()
    problems = []

    for claim_id, keys in DROP.items():
        if claim_id not in claims:
            problems.append("unknown claim in DROP: " + claim_id)
        for key in keys:
            if key not in ocr:
                problems.append("missing OCR page in DROP: %s p%s" % key)

    for claim_id, rows in ADD.items():
        claim = claims.get(claim_id)
        if not claim:
            problems.append("unknown claim in ADD: " + claim_id)
            continue
        existing = {(item["book"], int(item["page"])) for item in claim["books"]}
        dropped = set(DROP.get(claim_id, []))
        for book, page, quote in rows:
            if normalized(quote) not in ocr.get((book, page), ""):
                problems.append("quote not found: %s %s p%d" % (claim_id, book, page))
            if (book, page) in existing and (book, page) not in dropped:
                problems.append("duplicate citation: %s %s p%d" % (claim_id, book, page))

    if problems:
        raise SystemExit("citation check failed:\n" + "\n".join(problems))
    if args.check:
        print("citation check ok: %d claims, %d additions" % (
            len(ADD), sum(len(rows) for rows in ADD.values())))
        return

    for claim_id, keys in DROP.items():
        claim = claims.get(claim_id)
        if not claim:
            continue
        removed = set(keys)
        claim["books"] = [
            item for item in claim["books"]
            if (item["book"], int(item["page"])) not in removed
        ]

    added = 0
    for claim_id, rows in ADD.items():
        claim = claims[claim_id]
        existing = {(item["book"], int(item["page"])) for item in claim["books"]}
        for book, page, quote in rows:
            if (book, page) in existing:
                continue
            claim["books"].append({"book": book, "page": page, "quote": quote})
            existing.add((book, page))
            added += 1

    with SOURCE.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    coverage = {}
    for claim in data["claims"]:
        for item in claim["books"]:
            coverage[item["book"]] = coverage.get(item["book"], 0) + 1
    single = sum(1 for claim in data["claims"] if len(claim["books"]) == 1)
    print("added citations: %d" % added)
    print("total citations: %d" % sum(coverage.values()))
    print("books cited: %d" % len(coverage))
    print("single-source claims: %d" % single)


if __name__ == "__main__":
    main()
