import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * ครั้งเดียวต่อหนึ่ง request
 *
 * เดิมทุก query สร้าง client ใหม่ ทำให้ layout กับ page ยิง /auth/v1/user
 * ซ้ำกันคนละครั้ง — เป็น round-trip ข้ามทวีปที่ทิ้งไปได้เปล่า ๆ
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // เรียกจาก Server Component — middleware จะรีเฟรช session ให้เอง
          }
        },
      },
    },
  );
});

/**
 * ผู้ใช้ปัจจุบัน — dedupe ต่อ request
 *
 * middleware ตรวจ session ไปแล้วรอบหนึ่ง layout กับ page เรียกอีกคนละรอบ
 * รวมเป็น 3 ครั้งต่อการเปลี่ยนหน้าหนึ่งครั้ง cache() ตัดให้เหลือ 1 ฝั่ง render
 */
export const getUser = cache(async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
