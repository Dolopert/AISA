import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ตรวจค่า env ตั้งแต่ตอนสร้าง client
 *
 * ถ้าปล่อยให้ค่า placeholder หลุดขึ้น production เบราว์เซอร์จะขึ้นแค่
 * "Failed to fetch" ซึ่งไม่บอกอะไรเลยว่าเกิดอะไรขึ้น เคยเสียเวลาไล่หามาแล้วครั้งหนึ่ง
 *
 * ค่าพวกนี้ถูกฝังตอน build ไม่ใช่ตอนรัน — แก้บน Vercel แล้วต้อง redeploy ด้วย
 */
export function configError(): string | null {
  if (!url || !anonKey) return "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY";
  if (url.includes("placeholder") || anonKey.includes("placeholder")) {
    return `แอปนี้ถูก build ด้วยค่า placeholder (${url}) — ตั้ง environment variables ให้ถูกแล้ว redeploy ใหม่`;
  }
  return null;
}

export function createClient() {
  const problem = configError();
  if (problem) throw new Error(problem);
  return createBrowserClient(url!, anonKey!);
}
