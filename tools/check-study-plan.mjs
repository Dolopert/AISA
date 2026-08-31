/**
 * ตรวจว่าเวลาประมาณการทั้งหลักสูตร สมเหตุสมผลกับเวลาที่เหลือจริงหรือไม่
 *
 * ถ้าแผนกินเวลามากกว่าที่มี = แผนโกหกตั้งแต่วันแรก
 * ควรรู้ตั้งแต่ตอนนี้ ไม่ใช่ตอนเหลือ 2 สัปดาห์
 *
 * รัน: node tools/check-study-plan.mjs [ชั่วโมงต่อสัปดาห์] [สัปดาห์ที่เหลือ]
 */

import { readFileSync } from "node:fs";

const curriculum = JSON.parse(readFileSync("data/curriculum.json", "utf8"));
const src = readFileSync("src/lib/config.ts", "utf8");
const block = src.match(/STUDY_MINUTES_PER_LOS[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!block) throw new Error("อ่าน STUDY_MINUTES_PER_LOS ไม่ได้");

const perLos = {};
for (const [, k, v] of block[1].matchAll(/"?([A-Z-]+)"?\s*:\s*(\d+)/g)) perLos[k] = Number(v);

const hoursPerWeek = Number(process.argv[2] ?? 15);
const weeksLeft = Number(process.argv[3] ?? 10);

let totalMinutes = 0;
console.log("วิชา            บท   LOS   นาที/LOS   รวม(ชม.)");
for (const s of curriculum.subjects) {
  const los = s.chapters.reduce((n, c) => n + c.los.length, 0);
  const m = perLos[s.code];
  if (m === undefined) throw new Error(`ไม่มีค่าเวลาของวิชา ${s.code}`);
  totalMinutes += los * m;
  console.log(
    `${s.shortName.padEnd(14)} ${String(s.chapters.length).padStart(3)} ${String(los).padStart(5)}` +
      `   ${String(m).padStart(6)}   ${((los * m) / 60).toFixed(1).padStart(7)}`,
  );
}

const totalHours = totalMinutes / 60;
const available = hoursPerWeek * weeksLeft;

console.log("");
console.log(`เวลาที่แผนต้องใช้      ${totalHours.toFixed(1)} ชม.`);
console.log(`เวลาที่มี              ${available} ชม. (${hoursPerWeek} ชม./สัปดาห์ × ${weeksLeft} สัปดาห์)`);
console.log(`ต้องอ่านวันละ          ${(totalHours / (weeksLeft * 7)).toFixed(1)} ชม.`);

if (totalHours > available) {
  console.log("");
  console.log(`⚠ แผนเกินเวลาที่มี ${(totalHours - available).toFixed(1)} ชม.`);
  console.log("  ต้องเพิ่มชั่วโมงต่อสัปดาห์ ตัดบางวิชา หรือลดค่าประมาณลงให้ตรงความเร็วจริง");
  process.exit(1);
}
console.log(`\n✓ เหลือกันชน ${(available - totalHours).toFixed(1)} ชม.`);
