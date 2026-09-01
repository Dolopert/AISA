/**
 * ดูว่า production กำลังเสิร์ฟ build ไหน และ env ถูกฝังเป็นค่าอะไร
 *
 * ใช้ตอบคำถามว่า "กด redeploy แล้วมันขึ้นจริงหรือยัง" ให้ได้คำตอบชัด ๆ
 * แทนการเดาจากหน้าจอ — build id เปลี่ยน = มี build ใหม่จริง
 *
 * รัน: node tools/check-deploy.mjs [base-url]
 */

const BASE = process.argv[2] ?? "https://aisa-nu.vercel.app";

const res = await fetch(`${BASE}/login`, { cache: "no-store" });
const html = await res.text();

const buildIds = [
  ...new Set(
    [...html.matchAll(/\/_next\/static\/([^/"']+)\/_(?:buildManifest|ssgManifest)/g)].map(
      (m) => m[1],
    ),
  ),
];

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

console.log(`build id            ${buildIds.join(", ") || "(หาไม่เจอ)"}`);
console.log(`supabase url ที่ฝัง  ${embedded ?? "(หาไม่เจอใน bundle)"}`);
console.log(`x-vercel-id         ${res.headers.get("x-vercel-id") ?? "-"}`);
console.log("");

if (embedded === null) {
  console.log("อ่าน bundle ไม่ได้ ตรวจไม่ได้ว่า env ถูกหรือผิด");
} else if (embedded.includes("placeholder")) {
  console.log("✗ ยังเป็นค่า placeholder — build นี้ยังไม่ได้ใช้ env ที่ถูกต้อง");
  console.log("");
  console.log("จด build id ไว้ แล้ว redeploy โดย **เอาติ๊ก Use existing Build Cache ออก**");
  console.log("จากนั้นรันคำสั่งนี้ซ้ำ:");
  console.log("  - build id เปลี่ยน แต่ยังเป็น placeholder = ค่าที่บันทึกใน Vercel ผิดเอง");
  console.log("  - build id ไม่เปลี่ยน = การ redeploy ไม่ได้สร้าง build ใหม่จริง");
} else {
  console.log("✓ env ถูกต้องแล้ว — ลองเข้าสู่ระบบได้เลย");
}
