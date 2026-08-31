/**
 * นำเข้าต้นไม้หลักสูตรเข้า Supabase
 *
 * รันจากเครื่องเราเท่านั้น ใช้ service role key ที่อยู่ใน .env.local
 * ห้ามเรียกจากฝั่งเบราว์เซอร์เด็ดขาด
 *
 *   node tools/seed.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

loadEnv(join(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const curriculum = JSON.parse(readFileSync(join(root, "data/curriculum.json"), "utf8"));

console.log("นำเข้าวิชา…");
const subjects = curriculum.subjects.map((s, i) => ({
  code: s.code,
  group_no: s.group,
  group_name: s.groupName,
  name: s.name,
  short_name: s.shortName,
  weight: s.weight,
  weight_min: s.weightMin,
  weight_max: s.weightMax,
  sort: i + 1,
}));
check(await supabase.from("subjects").upsert(subjects, { onConflict: "code" }));

console.log("นำเข้าบท…");
let chapterCount = 0;
let losCount = 0;

for (const s of curriculum.subjects) {
  for (const c of s.chapters) {
    const { data: chapter, error } = await supabase
      .from("chapters")
      .upsert(
        {
          subject_code: s.code,
          number: c.number,
          title: c.title,
          revised_2569: c.revised2569,
        },
        { onConflict: "subject_code,number" },
      )
      .select("id")
      .single();
    if (error) throw error;
    chapterCount++;

    if (c.los.length === 0) continue;
    check(
      await supabase.from("los").upsert(
        c.los.map((l) => ({
          chapter_id: chapter.id,
          number: l.number,
          text: l.text,
        })),
        { onConflict: "chapter_id,number" },
      ),
    );
    losCount += c.los.length;
  }
}

console.log(`เสร็จ: ${subjects.length} วิชา · ${chapterCount} บท · ${losCount} LOS`);

function check({ error }) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
}

function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
