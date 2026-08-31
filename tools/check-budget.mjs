/**
 * ตรวจว่างบเวลาต่อข้อรายวิชา ถ่วงน้ำหนักตามสัดส่วนข้อสอบจริงแล้ว
 * ต้องไม่เกินเวลาที่มีจริงในสนาม (90 วิ/ข้อ)
 *
 * ถ้าเกิน = ถึงคุณทำได้ตามงบทุกวิชา คุณก็ยังทำข้อสอบไม่ทันอยู่ดี
 *
 * รัน: node tools/check-budget.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const curriculum = JSON.parse(readFileSync(join(here, "../data/curriculum.json"), "utf8"));

// อ่านค่าจาก config.ts โดยไม่ต้อง compile TypeScript
const configSrc = readFileSync(join(here, "../src/lib/config.ts"), "utf8");
const block = configSrc.match(/TIME_BUDGET_SECONDS[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!block) throw new Error("อ่าน TIME_BUDGET_SECONDS ไม่ได้");

const budgets = {};
for (const [, key, value] of block[1].matchAll(/"?([A-Z-]+)"?\s*:\s*(\d+)/g)) {
  budgets[key] = Number(value);
}

const available = ((150 + 120) * 60) / 180;
let weighted = 0;
let totalWeight = 0;

console.log("วิชา            สัดส่วน  งบเวลา/ข้อ");
for (const s of curriculum.subjects) {
  const b = budgets[s.code];
  if (b === undefined) throw new Error(`ไม่มีงบเวลาของวิชา ${s.code}`);
  weighted += (s.weight * b) / 100;
  totalWeight += s.weight;
  console.log(`${s.shortName.padEnd(14)} ${String(s.weight).padStart(5)}%  ${String(b).padStart(4)} วิ`);
}

console.log("");
console.log(`สัดส่วนรวม            ${totalWeight}%`);
console.log(`งบเวลาถ่วงน้ำหนัก     ${weighted.toFixed(2)} วิ/ข้อ`);
console.log(`เวลาที่มีจริงในสนาม   ${available.toFixed(2)} วิ/ข้อ`);

if (Math.abs(totalWeight - 100) > 0.01) {
  console.error(`\n✗ สัดส่วนวิชารวมได้ ${totalWeight}% ไม่ใช่ 100%`);
  process.exit(1);
}
if (weighted > available) {
  console.error(`\n✗ งบเวลาเกินไป ${(weighted - available).toFixed(2)} วิ/ข้อ — ทำข้อสอบไม่ทัน`);
  process.exit(1);
}
console.log(`\n✓ เหลือกันชน ${(available - weighted).toFixed(2)} วิ/ข้อ`);
