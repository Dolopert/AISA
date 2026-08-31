"""สร้างต้นไม้หลักสูตร AISA จาก LOS_CISA-Foundation.pdf

โครงสร้าง: กลุ่มวิชา -> วิชา -> บท -> วัตถุประสงค์การเรียนรู้ (LOS)
สัดส่วน % ข้อสอบมาจากตาราง "รายละเอียดโครงสร้างการทดสอบ" หน้า 4 ของคู่มือฉบับเดียวกัน
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from thai_pdf import full_text

# ---------------------------------------------------------------- config

# หัวข้อวิชาตามที่ปรากฏในเอกสาร เรียงตามลำดับในเล่ม
# weight = สัดส่วนข้อสอบทางการ (%) จากตารางหน้า 4
SUBJECTS: list[dict] = [
    dict(code="ETH-STD", group=1,
         heading="ส่วนที่ 1 มาตรฐานและจรรยาบรรณการปฏิบัติวิชาชีพด้านการวิเคราะห์การลงทุน",
         name="มาตรฐานและจรรยาบรรณการปฏิบัติวิชาชีพ", short="จรรยาบรรณ", weight=(4, 6)),
    dict(code="ETH-GIPS", group=1,
         heading="ส่วนที่ 2 มาตรฐานสากลด้านการวัดผลการดำเนินงานการลงทุน",
         name="มาตรฐานสากลด้านการวัดผลการดำเนินงานการลงทุน", short="GIPS", weight=(4, 6)),
    dict(code="ETH-REG", group=1,
         heading="ส่วนที่ 3 เกณฑ์และแนวปฏิบัติเกี่ยวกับการวิเคราะห์การลงทุน",
         name="เกณฑ์และแนวปฏิบัติเกี่ยวกับการวิเคราะห์การลงทุน", short="เกณฑ์", weight=(4, 6)),
    dict(code="INV", group=2, heading="หลักการลงทุน",
         name="หลักการลงทุน", short="หลักการลงทุน", weight=(7, 9)),
    dict(code="FSA", group=2, heading="การวิเคราะห์งบการเงิน",
         name="การวิเคราะห์งบการเงิน", short="งบการเงิน", weight=(10, 12)),
    dict(code="CF", group=2, heading="พื้นฐานการเงินธุรกิจ",
         name="พื้นฐานการเงินธุรกิจ", short="การเงินธุรกิจ", weight=(10, 12)),
    dict(code="EQ", group=3, heading="การวิเคราะห์การลงทุนในตราสารทุน",
         name="การวิเคราะห์การลงทุนในตราสารทุน", short="ตราสารทุน", weight=(16, 18)),
    dict(code="FI", group=3, heading="การวิเคราะห์การลงทุนในตราสารหนี้",
         name="การวิเคราะห์การลงทุนในตราสารหนี้", short="ตราสารหนี้", weight=(11, 13)),
    dict(code="DRV", group=3, heading="การวิเคราะห์การลงทุนในตราสารอนุพันธ์",
         name="การวิเคราะห์การลงทุนในตราสารอนุพันธ์", short="อนุพันธ์", weight=(11, 13)),
    dict(code="MF", group=3, heading="การวิเคราะห์การลงทุนในกองทุนรวม",
         name="การวิเคราะห์การลงทุนในกองทุนรวม", short="กองทุนรวม", weight=(2, 4)),
    dict(code="PM", group=3, heading="การบริหารกลุ่มหลักทรัพย์ลงทุน",
         name="การบริหารกลุ่มหลักทรัพย์ลงทุน", short="บริหารพอร์ต", weight=(10, 12)),
]

GROUPS = {
    1: "จรรยาบรรณและมาตรฐานการปฏิบัติงาน",
    2: "เครื่องมือเพื่อการวิเคราะห์การลงทุน",
    3: "การวิเคราะห์หลักทรัพย์และการบริหารกลุ่มสินทรัพย์ลงทุน",
}

# บทที่ถูกแก้ไขตามเอกสาร "สรุปรายละเอียดการแก้ไข/เพิ่มเติมเนื้อหา ครั้งที่ 1/2569"
# มีผลตั้งแต่รอบทดสอบเดือนพฤษภาคม 2569 เป็นต้นไป
REVISED_2569: dict[str, list[int]] = {
    "INV": [6],
    "CF": [3],
    "EQ": [2, 8],
    "DRV": [1, 2, 3, 6],
}

# ---------------------------------------------------------------- parsing

RE_CHAPTER = re.compile(r"^บทที่\s*(\d+)\s*[:：]?\s*(.*)$")
RE_LOS_DOT = re.compile(r"^(\d+)\.(\d+)\s*(.*)$")
RE_LOS_FLAT = re.compile(r"^(\d+)\.\s+(.+)$")

NOISE = re.compile(
    r"^(?:ตลาดหลักทรัพย์แห่งประเทศไทย|วัตถุประสงค์การเรียนรู้|อ้างอิงหนังสือ.*|"
    r"ประกอบไปด้วย.*|รายละเอียด.*|กลุ่มวิชาที่.*|\d+|[•].*)$"
)


@dataclass
class Los:
    number: str
    text: str


@dataclass
class Chapter:
    number: int
    title: str
    los: list[Los] = field(default_factory=list)


def clean_lines(block: str) -> list[str]:
    out = []
    for raw in block.splitlines():
        line = raw.strip()
        if not line or NOISE.match(line):
            continue
        out.append(line)
    return out


def parse_subject(block: str) -> list[Chapter]:
    """แปลงเนื้อความหนึ่งวิชาเป็นรายการบท + LOS"""
    chapters: list[Chapter] = []
    current = Chapter(number=0, title="")
    pending: Los | None = None

    def flush() -> None:
        nonlocal pending
        if pending is not None:
            text = re.sub(r"\s+", " ", pending.text).strip()
            if text:
                pending.text = text
                current.los.append(pending)
            pending = None

    for line in clean_lines(block):
        m = RE_CHAPTER.match(line)
        if m:
            flush()
            if current.los or current.number:
                chapters.append(current)
            current = Chapter(number=int(m.group(1)), title=m.group(2).strip())
            continue

        m = RE_LOS_DOT.match(line)
        if m:
            flush()
            pending = Los(number="%s.%s" % (m.group(1), m.group(2)), text=m.group(3))
            continue

        m = RE_LOS_FLAT.match(line)
        if m:
            flush()
            pending = Los(number=m.group(1), text=m.group(2))
            continue

        if pending is not None:
            pending.text += " " + line

    flush()
    if current.los or current.number:
        chapters.append(current)
    return chapters


def split_subjects(text: str) -> dict[str, str]:
    """หาตำแหน่งหัวข้อแต่ละวิชาแล้วตัดเป็นบล็อก"""
    marks: list[tuple[int, str]] = []
    cursor = 0
    for sub in SUBJECTS:
        pattern = re.compile(r"^[ \t]*" + re.escape(sub["heading"]) + r"[ \t]*$", re.M)
        m = pattern.search(text, cursor)
        if not m:
            raise SystemExit("หาหัวข้อวิชาไม่เจอ: " + sub["heading"])
        marks.append((m.end(), sub["code"]))
        cursor = m.end()

    blocks: dict[str, str] = {}
    for i, (start, code) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        blocks[code] = text[start:end]
    return blocks


def build(pdf_path: str) -> dict:
    text = full_text(pdf_path)
    # ตัดสารบัญ/ภาพรวมข้างหน้าออก เริ่มที่หัวข้อรายละเอียด LOS จริง
    anchor = text.index("รายละเอียดวัตถุประสงค์การเรียนรู้")
    body = text[anchor:]

    blocks = split_subjects(body)
    subjects = []
    for sub in SUBJECTS:
        chapters = parse_subject(blocks[sub["code"]])
        revised = set(REVISED_2569.get(sub["code"], []))
        subjects.append(
            {
                "code": sub["code"],
                "group": sub["group"],
                "groupName": GROUPS[sub["group"]],
                "name": sub["name"],
                "shortName": sub["short"],
                "weightMin": sub["weight"][0],
                "weightMax": sub["weight"][1],
                "weight": sum(sub["weight"]) / 2,
                "chapters": [
                    {
                        "number": c.number,
                        "title": c.title,
                        "revised2569": c.number in revised,
                        "los": [{"number": l.number, "text": l.text} for l in c.los],
                    }
                    for c in chapters
                ],
            }
        )

    return {
        "source": "LOS_CISA-Foundation.pdf (ตลท. ก.ค. 2564, md5 803eb74b9f4675498830e073ffcd3892)",
        "exam": {
            "totalQuestions": 180,
            "totalScore": 180,
            "passOverall": 0.70,
            "passGroup1": 0.70,
            "sessions": [
                {"name": "ช่วงเช้า", "questions": 100, "minutes": 150},
                {"name": "ช่วงบ่าย", "questions": 80, "minutes": 120},
            ],
        },
        "groups": [{"number": n, "name": t} for n, t in GROUPS.items()],
        "subjects": subjects,
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    data = build(sys.argv[1])
    out = Path(sys.argv[2])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    n_ch = sum(len(s["chapters"]) for s in data["subjects"])
    n_los = sum(len(c["los"]) for s in data["subjects"] for c in s["chapters"])
    print("เขียน %s" % out)
    print("  %d วิชา · %d บท · %d LOS" % (len(data["subjects"]), n_ch, n_los))
    for s in data["subjects"]:
        los = sum(len(c["los"]) for c in s["chapters"])
        print("  %-8s %-14s %2d บท %3d LOS  %.0f%%"
              % (s["code"], s["shortName"], len(s["chapters"]), los, s["weight"]))
