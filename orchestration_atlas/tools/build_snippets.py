#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Crop claim-level evidence snippets from already rendered textbook pages.

The crop is located with the OCR line coordinates, so no PDF is rasterized and
no full-book OCR is repeated. Run tools/export_data.js before this script.
"""
import json
import os
import re
import statistics
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_MAP = os.path.join(ROOT, "evidence", "source-map.json")
OCR_DIR = os.path.join(ROOT, "corpus", "ocr")
PAGE_DIR = os.path.join(ROOT, "docs", "assets", "sources")
OUT_DIR = os.path.join(PAGE_DIR, "snippets")


def normalize(text):
    text = (text or "").lower()
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", text)


def grams(text, size=2):
    text = normalize(text)
    return {text[index:index + size] for index in range(max(0, len(text) - size + 1))}


def match_chunk(chunk, lines):
    quote_grams = grams(chunk)
    if not quote_grams or not lines:
        return None
    best = None
    for start in range(len(lines)):
        window_grams = set()
        for end in range(start, min(len(lines), start + 20)):
            window_grams.update(grams(lines[end].get("text", "")))
            overlap = len(quote_grams & window_grams)
            if not overlap:
                continue
            precision = overlap / max(1, len(window_grams))
            recall = overlap / max(1, len(quote_grams))
            score = 2 * precision * recall / max(1e-9, precision + recall)
            if best is None or score > best["score"]:
                best = {"start": start, "end": end, "score": score}
    return best


def locate_quote(quote, lines):
    chunks = [part for part in re.split(r"…+|……", quote or "") if normalize(part)]
    matches = [match for match in (match_chunk(chunk, lines) for chunk in chunks) if match]
    if not matches:
        return None
    return {
        "start": min(item["start"] for item in matches),
        "end": max(item["end"] for item in matches),
        "score": sum(item["score"] for item in matches) / len(matches),
    }


def main():
    with open(SOURCE_MAP, encoding="utf-8") as handle:
        source_map = json.load(handle)
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {}
    for claim in source_map["CLAIMS"]:
        for citation in claim["citations"]:
            book_id = citation["book"]
            page = int(citation["pdfPage"])
            ocr_path = os.path.join(OCR_DIR, book_id + ".jsonl")
            page_path = os.path.join(PAGE_DIR, book_id, "p%04d.jpg" % page)
            if not os.path.exists(ocr_path) or not os.path.exists(page_path):
                print("SKIP missing page", claim["id"], book_id, page)
                continue
            rows = [json.loads(line) for line in open(ocr_path, encoding="utf-8") if line.strip()]
            page_row = next((row for row in rows if int(row.get("page", 0)) == page), None)
            if not page_row or not page_row.get("lines"):
                print("SKIP no ocr", claim["id"], book_id, page)
                continue
            lines = sorted(page_row["lines"], key=lambda item: (float(item.get("y", 0)), float(item.get("x", 0))))
            match = locate_quote(citation.get("quote", ""), lines)
            if not match:
                print("WARN no match", claim["id"], book_id, page)
                continue
            selected = lines[match["start"]:match["end"] + 1]
            image = Image.open(page_path).convert("RGB")
            sx = image.width / max(1, float(page_row.get("w", image.width)))
            sy = image.height / max(1, float(page_row.get("h", image.height)))
            gaps = [b["y"] - a["y"] for a, b in zip(selected, selected[1:]) if b["y"] > a["y"] + 4]
            line_height = statistics.median(gaps) if gaps else 25.0
            y0 = max(0.0, (min(float(item["y"]) for item in selected) - line_height * 0.9) * sy)
            y1 = min(float(image.height), (max(float(item["y"]) for item in selected) + line_height * 1.6) * sy)
            if y1 - y0 < 70:
                center = (y0 + y1) / 2
                y0, y1 = max(0, center - 35), min(image.height, center + 35)
            x0 = round(image.width * 0.018)
            x1 = round(image.width * 0.982)
            crop = image.crop((x0, round(y0), x1, round(y1)))
            name = "%s-%s-p%04d.jpg" % (claim["id"], book_id, page)
            destination = os.path.join(OUT_DIR, name)
            crop.save(destination, "JPEG", quality=91, optimize=True)
            manifest[claim["id"] + "|" + book_id + "|" + str(page)] = {
                "path": "assets/sources/snippets/" + name,
                "score": round(match["score"], 3),
                "line_start": match["start"],
                "line_end": match["end"],
            }
            print("%-45s %-14s p.%04d score=%.3f lines=%d-%d" % (
                claim["id"], book_id, page, match["score"], match["start"], match["end"]))
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8", newline="\n") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    print("wrote", os.path.join(OUT_DIR, "manifest.json"))


if __name__ == "__main__":
    main()
