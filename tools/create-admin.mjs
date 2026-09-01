/**
 * สร้างบัญชีผู้ดูแลที่เข้าระบบด้วยอีเมล + รหัสผ่าน โดยไม่ต้องมีกล่องเมลจริง
 *
 * มีไว้เพื่อ:
 *   - เข้าระบบได้โดยไม่ต้องรอลิงก์ทางเมล
 *   - เป็นทางเข้าสำรองเมื่อ magic link มีปัญหา
 *
 * รหัสผ่านสุ่มขึ้นมาใหม่ทุกครั้งและเขียนลงไฟล์ที่ gitignore ไว้
 * ไม่พิมพ์ลงหน้าจอเต็ม ๆ และไม่เคยเข้าไปอยู่ใน repo
 *
 * รัน: node tools/create-admin.mjs [อีเมล]
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) {
    process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(1);
}

const USERNAME_DOMAIN = "aisa-tracker.local";
const raw = process.argv[2] ?? "admin";
// รับ "admin" เฉย ๆ ได้ เติมโดเมนให้เหมือนที่หน้าเข้าสู่ระบบทำ
const email = raw.includes("@") ? raw.trim() : `${raw.trim()}@${USERNAME_DOMAIN}`;

// ตรวจก่อนแตะ allowlist ไม่งั้นค่าที่ใช้ไม่ได้จะค้างเป็นแถวขยะเมื่อสร้างผู้ใช้ล้มเหลว
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`อีเมลไม่ถูกรูปแบบ: ${email}`);
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// ตัวอักษรที่อ่านออกง่าย ไม่มี 0/O/l/1 ที่สับสนตอนพิมพ์มือ
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function strongPassword(length = 20) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const password = strongPassword();

// trigger handle_new_user จะปฏิเสธถ้าอีเมลไม่อยู่ใน allowlist ต้องใส่ก่อน
const allow = await admin
  .from("allowlist")
  .upsert({ email, is_admin: true, note: "บัญชีผู้ดูแล สร้างด้วย tools/create-admin.mjs" },
    { onConflict: "email" });
if (allow.error) {
  console.error("เพิ่มลง allowlist ไม่สำเร็จ:", allow.error.message);
  process.exit(1);
}

// ถ้ามีอยู่แล้วให้ตั้งรหัสใหม่แทนการสร้างซ้ำ
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId;
if (existing) {
  const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error("ตั้งรหัสผ่านใหม่ไม่สำเร็จ:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("มีบัญชีนี้อยู่แล้ว — ตั้งรหัสผ่านใหม่ให้");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // ไม่มีกล่องเมลจริง จึงยืนยันให้เลย
  });
  if (error) {
    console.error("สร้างบัญชีไม่สำเร็จ:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("สร้างบัญชีผู้ดูแลแล้ว");
}

await admin.from("profiles").update({ is_admin: true }).eq("id", userId);

// ทดสอบเข้าระบบจริงด้วย anon key เหมือนที่หน้าเว็บทำ
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const signIn = await anon.auth.signInWithPassword({ email, password });
console.log(signIn.error ? `✗ ทดสอบเข้าระบบไม่ผ่าน: ${signIn.error.message}` : "✓ ทดสอบเข้าระบบผ่าน");

const file = ".admin-credentials.local";
writeFileSync(
  file,
  [
    "# บัญชีผู้ดูแลของ AISA Tracker",
    "# ไฟล์นี้ถูก gitignore ไว้ ห้าม commit และห้ามส่งต่อ",
    `# สร้างเมื่อ ${new Date().toISOString()}`,
    "",
    `EMAIL=${email}`,
    `PASSWORD=${password}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`อีเมล: ${email}`);
console.log(`รหัสผ่าน: เขียนไว้ในไฟล์ ${file} (ไม่แสดงบนหน้าจอ)`);
console.log("เปิดไฟล์นั้นเพื่อคัดลอกรหัส แล้วเข้าระบบที่แท็บ 'รหัสผ่าน'");
