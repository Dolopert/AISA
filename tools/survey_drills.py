"""สำรวจไฟล์ตะลุยโจทย์ว่าสกัดโจทย์อัตโนมัติได้แค่ไหน (เตรียม P2)

รัน: python tools/survey_drills.py "C:/Users/diffy/Desktop/Claudex/AISA"
"""

import re
import sys
from pathlib import Path

from thai_pdf import page_texts

# ไฟล์แต่ละชุดสะกดหัวเฉลยไม่เหมือนกัน 3 แบบ:
#   "ข้อ 1 เฉลย ตัวเลือก 1"      (01, 02, 04, 05, 08, 09)
#   "ข้อ 1. เฉลย ตัวเลือก 3)"     (06, 07)
#   "เฉลยตัวเลือกที่ 2"           (03-1, 03-2 — ไม่มีเลขข้อกำกับ)
RE_ANSWER = re.compile(r"(?:ข้อ\s*(\d+)\.?\s*)?เฉลย\s*ตัวเลือก(?:ที่)?\s*(\d)")
RE_QUESTION = re.compile(r"^\s*(\d+)\.\s", re.M)
RE_LOS = re.compile(r"วัตถุประสงค์การเรียนรู้\s*:?\s*(.+)")
# บางไฟล์ใช้ "เอกสารอ้างอิง" แทน "หนังสืออ้างอิง"
RE_REF = re.compile(r"(?:หนังสือ|เอกสาร)อ้างอิง\s*:?\s*(.+)")


def survey(path: Path) -> dict:
    pages = page_texts(str(path))
    text = "\n".join(pages)
    return {
        "pages": len(pages),
        "answers": len(RE_ANSWER.findall(text)),
        "questions": len(RE_QUESTION.findall(text)),
        "los": len(RE_LOS.findall(text)),
        "refs": len(RE_REF.findall(text)),
        "empty_pages": sum(1 for p in pages if len(p.strip()) < 20),
    }


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    root = Path(sys.argv[1])
    files = sorted(root.glob("*ตะลุยโจทย์*.pdf"))

    print(f"{'ไฟล์':52} {'หน้า':>5} {'ว่าง':>5} {'เฉลย':>5} {'LOS':>5} {'อ้างอิง':>7}")
    total = 0
    for f in files:
        r = survey(f)
        total += r["answers"]
        name = f.name[:50]
        print(
            f"{name:52} {r['pages']:5} {r['empty_pages']:5} "
            f"{r['answers']:5} {r['los']:5} {r['refs']:7}"
        )
    print(f"\nรวมข้อที่สกัดเฉลยได้: {total}")


if __name__ == "__main__":
    main()
