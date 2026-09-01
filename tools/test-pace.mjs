/**
 * ทดสอบตรรกะเตือน/ให้กำลังใจ ด้วยการคอมไพล์ src/lib/pace.ts เป็น JS ชั่วคราวแล้วเรียกจริง
 *
 * ตรรกะนี้เป็นตัวตัดสินว่าจะบอกผู้ใช้ว่า "ทัน" หรือ "ไม่ทัน"
 * ถ้าผิดแล้วบอกว่าทันทั้งที่ไม่ทัน คือความเสียหายที่แก้ไม่ได้ตอนรู้ตัว
 *
 * รัน: node tools/test-pace.mjs
 */

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "pace-"));
execSync(
  `npx tsc src/lib/pace.ts src/lib/reading.ts src/lib/config.ts ` +
    `--outDir "${out}" --module nodenext --moduleResolution nodenext --target es2022 --skipLibCheck`,
  { stdio: "pipe" },
);

const { assessPace, countStreak, dayKey, addDays } = await import(
  pathToFileURL(join(out, "pace.js")).href
);

const TODAY = new Date("2026-09-01T09:00:00+07:00");
let failed = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ได้ ${actual} ควรเป็น ${expected}`}`);
  if (!ok) failed++;
}

/** สร้างประวัติการอ่าน: นาทีต่อวันย้อนหลัง n วัน */
function history(perDay, days) {
  const m = new Map();
  for (let i = 0; i < days; i++) m.set(dayKey(addDays(TODAY, -i)), perDay);
  return m;
}

// ต้องการ 120 นาที/วัน (6000 นาทีใน 50 วัน)
const base = { remainingMinutes: 6000, daysLeft: 50, today: TODAY };

check("ไม่มีข้อมูลเลย", assessPace({ ...base, daily: new Map() }).state, "no-data");
check("อ่านครบแล้ว", assessPace({ ...base, remainingMinutes: 0, daily: new Map() }).state, "done");
check("เร็วกว่าแผน", assessPace({ ...base, daily: history(180, 7) }).state, "ahead");
check("ตามแผนพอดี", assessPace({ ...base, daily: history(120, 7) }).state, "ontrack");
check("ช้ากว่าแผน", assessPace({ ...base, daily: history(90, 7) }).state, "behind");
check("ช้ามาก", assessPace({ ...base, daily: history(40, 7) }).state, "critical");

// อ่านหนักวันเดียวแล้วหายไป 6 วัน ต้องไม่ถูกนับว่าเร็ว
const burst = new Map([[dayKey(addDays(TODAY, -6)), 840]]);
check("อ่านรวดเดียว 14 ชม. แล้วหายไป 6 วัน", assessPace({ ...base, daily: burst }).state, "critical");

// วันนี้ยังไม่อ่านต้องไม่ตัดสตรีค (ยังมีเวลาถึงเที่ยงคืน)
const yesterdayBack = new Map();
for (let i = 1; i <= 5; i++) yesterdayBack.set(dayKey(addDays(TODAY, -i)), 60);
check("สตรีคเมื่อวันนี้ยังไม่ได้อ่าน", countStreak(yesterdayBack, TODAY), 5);

const withToday = new Map(yesterdayBack);
withToday.set(dayKey(TODAY), 30);
check("สตรีคเมื่ออ่านวันนี้แล้ว", countStreak(withToday, TODAY), 6);

const gap = new Map([
  [dayKey(TODAY), 30],
  [dayKey(addDays(TODAY, -1)), 30],
  [dayKey(addDays(TODAY, -3)), 30],
]);
check("สตรีคขาดตอน", countStreak(gap, TODAY), 2);

// คำเตือนต้องบอกว่าจะจบช้ากว่าวันสอบกี่วัน
const slow = assessPace({ ...base, daily: history(60, 7) });
check("ทำนายวันที่ต้องใช้ (6000/60)", slow.projectedDays, 100);
check("ช้ากว่าวันสอบ 50 วัน", slow.daysLate, 50);

rmSync(out, { recursive: true, force: true });

console.log("");
console.log(failed === 0 ? "ผ่านทั้งหมด" : `ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
