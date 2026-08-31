/**
 * กันเนื้อหาลิขสิทธิ์ของ ตลท. หลุดเข้า repo
 *
 * repo นี้เก็บ "เครื่องมือ" อย่างเดียว ไม่เก็บ "ข้อสอบ"
 * คลังโจทย์นำเข้า Supabase จากไฟล์ในเครื่องเจ้าของระบบโดยตรง ไม่ผ่าน git
 * เพื่อให้ repo ปลอดภัยไม่ว่าจะตั้งเป็น public หรือ private
 *
 * รัน: node tools/check-no-content.mjs
 */

import { execSync } from "node:child_process";

// นามสกุลไฟล์ที่เป็นเนื้อหาต้นฉบับ ไม่ควรอยู่ใน repo เลย
const BANNED_EXT = /\.(pdf|xlsx|xls|docx|pptx)$/i;

// ไม่มีไฟล์ข้อมูลใดที่ควรอยู่ใน data/ เลย — ทั้งหลักสูตรและคลังโจทย์
// สร้าง/นำเข้าจากเครื่องเจ้าของระบบเท่านั้น
const ALLOWED_DATA = new Set([]);

// คำที่บ่งว่าเป็นเฉลย — ตรวจเฉพาะไฟล์ "ข้อมูล" เท่านั้น
// เอกสารและโค้ดพูดถึงคำพวกนี้ได้ตามปกติ (README อธิบายที่มาของข้อมูล
// และ survey_drills.py ต้อง match คำเหล่านี้เพื่อทำงานของมัน)
const CONTENT_MARKERS = [/เฉลย\s*ตัวเลือก/, /คำอธิบายเฉลย/];

// ไฟล์ข้อมูลที่อาจบรรจุเนื้อหาได้จริง
const DATA_FILE = /\.(json|csv|tsv|txt|sql)$/i;

// จำนวนครั้งที่เจอ marker ถึงจะถือว่าเป็นเนื้อหาจริง ไม่ใช่การกล่าวถึง
const MARKER_THRESHOLD = 3;

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const problems = [];

for (const file of tracked) {
  if (BANNED_EXT.test(file)) {
    problems.push(`${file} — ไฟล์ต้นฉบับ ไม่ควร track`);
    continue;
  }
  if (file.startsWith("data/") && !ALLOWED_DATA.has(file)) {
    problems.push(`${file} — ไฟล์ใน data/ ที่ไม่ได้อยู่ในรายการอนุญาต`);
    continue;
  }

  let text;
  try {
    text = execSync(`git show HEAD:"${file}"`, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch {
    continue; // ไฟล์ใหม่ที่ยังไม่ commit หรืออ่านไม่ได้ (binary)
  }

  if (!DATA_FILE.test(file)) continue;

  for (const marker of CONTENT_MARKERS) {
    const hits = text.match(new RegExp(marker.source, "g"))?.length ?? 0;
    if (hits >= MARKER_THRESHOLD) {
      problems.push(`${file} — พบเนื้อหาข้อสอบ ${hits} จุด (${marker.source})`);
      break;
    }
  }
}

if (problems.length > 0) {
  console.error("✗ พบเนื้อหาที่ไม่ควรอยู่ใน repo:\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nคลังโจทย์ต้องนำเข้า Supabase จากเครื่องโดยตรง ไม่ commit");
  process.exit(1);
}

console.log(`✓ ตรวจ ${tracked.length} ไฟล์ ไม่พบเนื้อหาลิขสิทธิ์ของ ตลท.`);
