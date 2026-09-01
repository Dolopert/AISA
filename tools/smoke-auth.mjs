/**
 * ทดสอบ flow auth กับ Supabase จริง เท่าที่ทำได้โดยไม่ต้องเปิดกล่องเมลของผู้ใช้
 *
 *   1. view ถูกล็อกให้เห็นเฉพาะข้อมูลตัวเองหรือยัง
 *   2. ตารางหลักสูตร: ผู้ใช้ที่ยังไม่ล็อกอินต้องอ่านไม่ได้
 *   3. อีเมลนอก allowlist ต้องถูกปฏิเสธ (ไม่มีอีเมลถูกส่งออก)
 *   4. /auth/callback บน production จัดการลิงก์เสียได้ถูกต้อง
 *
 * รัน: node tools/smoke-auth.mjs [base-url]
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) {
    process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

const BASE = process.argv[2] ?? "https://aisa-nu.vercel.app";
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let failed = 0;
function report(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (detail) console.log(`    ${detail}`);
  if (!ok) failed++;
}

// 0 — bundle ที่ deploy อยู่ต้องไม่มีค่า placeholder ค้าง
{
  const html = await fetch(`${BASE}/login`).then((r) => r.text());
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[^"']+\.js/g) ?? [])];
  let embedded = null;
  for (const c of chunks) {
    const js = await fetch(`${BASE}${c}`).then((r) => r.text());
    const m = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    if (m) {
      embedded = m[0];
      break;
    }
  }
  report(
    "bundle บน production ไม่มีค่า placeholder",
    embedded !== null && !embedded.includes("placeholder"),
    embedded ? `ฝังอยู่: ${embedded}` : "หา URL ใน bundle ไม่เจอ",
  );
}

// 1 — view ต้องไม่คืนข้อมูลให้คนที่ไม่ได้ล็อกอิน
for (const view of ["subject_accuracy", "los_mastery"]) {
  const { data, error } = await anon.from(view).select("*").limit(5);
  report(
    `${view}: ไม่คืนข้อมูลให้ผู้ใช้ที่ไม่ได้ล็อกอิน`,
    error !== null || (data?.length ?? 0) === 0,
    error ? `ถูกปฏิเสธ: ${error.message}` : `คืน ${data.length} แถว`,
  );
}

// 2 — หลักสูตรต้องอ่านได้เฉพาะคนที่ล็อกอิน (policy เป็น "to authenticated")
{
  const { data, error } = await anon.from("subjects").select("code").limit(3);
  report(
    "subjects: ผู้ใช้ที่ยังไม่ล็อกอินอ่านไม่ได้",
    error !== null || (data?.length ?? 0) === 0,
    error ? `ถูกปฏิเสธ: ${error.message}` : `อ่านได้ ${data.length} แถว — RLS หลวม`,
  );
}

// 3 — อีเมลนอก allowlist ต้องถูกปฏิเสธ ไม่มีอีเมลถูกส่งออกจริง
{
  const stranger = `not-invited-${Date.now()}@example.com`;
  const { error } = await anon.auth.signInWithOtp({
    email: stranger,
    options: { emailRedirectTo: `${BASE}/auth/callback` },
  });
  report(
    "อีเมลนอก allowlist ถูกปฏิเสธ",
    error !== null,
    error ? `error: ${error.message}` : "ผ่านไปได้ — trigger ไม่ทำงาน",
  );
}

// 4 — /auth/callback ต้องเด้งกลับหน้า login พร้อมรหัส error เมื่อลิงก์เสีย
for (const [label, qs, expect] of [
  ["ไม่มีพารามิเตอร์", "", "missing_code"],
  // ลิงก์เสียทุกแบบให้ผลเดียวกัน เพราะทางแก้เดียวกันคือขอลิงก์ใหม่
  ["code ปลอม", "?code=not-a-real-code", "expired"],
  ["token_hash ปลอม", "?token_hash=deadbeef&type=magiclink", "expired"],
  ["type ไม่ถูกต้อง", "?token_hash=deadbeef&type=bogus", "expired"],
]) {
  const res = await fetch(`${BASE}/auth/callback${qs}`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const sameHost = location.startsWith(BASE);
  report(
    `callback (${label}) เด้งกลับ login พร้อม error=${expect}`,
    res.status >= 300 && res.status < 400 && location.includes(`error=${expect}`) && sameHost,
    `${res.status} → ${location || "(ไม่มี Location)"}`,
  );
}

console.log("");
console.log(failed === 0 ? "ผ่านทั้งหมด" : `ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
