"""ดึงข้อความไทยจาก PDF ของ ตลท. ให้ลำดับอักขระถูกต้อง

pdftotext สลับตำแหน่งสระ/วรรณยุกต์ (ข้อ -> ขอ้) ใช้ไม่ได้
PyMuPDF ให้ลำดับถูก เหลือปัญหาเดียวคือ ำ ถูกแยกเป็น "<พยัญชนะ> า"
เพราะ nikhahit (U+0E4D) หายไปตอน embed ฟอนต์
"""

import re
import unicodedata

import pymupdf

# พยัญชนะ + ช่องว่าง + สระอา = ที่จริงคือ ำ ที่ nikhahit หลุด
_SARA_AM = re.compile(r"([ก-ฮ][่-๋]?)\s+า")
# วรรณยุกต์ลอยหลังช่องว่าง เช่น "ท า" ที่มีวรรณยุกต์ต่อท้าย
_STRAY_SPACE_MARK = re.compile(r"\s+([ัิ-ฺ็-๎])")
_MULTI_SPACE = re.compile(r"[ \t ]+")


def fix_thai(text: str) -> str:
    """ซ่อมข้อความไทยที่หลุดจาก PDF ของ ตลท."""
    text = text.replace(" ", " ")
    text = _SARA_AM.sub(lambda m: m.group(1) + "ำ", text)
    text = _STRAY_SPACE_MARK.sub(r"\1", text)
    text = text.replace("", "•")  # bullet จากฟอนต์ Symbol
    text = unicodedata.normalize("NFC", text)
    text = _MULTI_SPACE.sub(" ", text)
    return text


def page_texts(path: str) -> list[str]:
    with pymupdf.open(path) as doc:
        return [fix_thai(page.get_text()) for page in doc]


def full_text(path: str) -> str:
    return "\n\f\n".join(page_texts(path))


if __name__ == "__main__":
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    print(full_text(sys.argv[1]))
