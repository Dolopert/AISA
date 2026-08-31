import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * ปลายทางของลิงก์เข้าระบบ รองรับ 2 รูปแบบ
 *
 *   token_hash + type  — ใช้ตอน template อีเมลส่ง {{ .TokenHash }} มา
 *                        ทำงานข้ามเครื่องได้ (ขอลิงก์บนคอม กดในเมลบน iPad)
 *                        ต้องต่อ custom SMTP ก่อนถึงจะแก้ template ได้
 *   code               — PKCE ปกติ (ค่าเริ่มต้นของแพลนฟรี)
 *                        ใช้ได้เฉพาะเบราว์เซอร์เดียวกับที่ขอลิงก์
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const origin = publicOrigin(request);
  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return NextResponse.redirect(`${origin}/login?error=${classify(error.message)}`);
    return NextResponse.redirect(`${origin}/`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=${classify(error.message)}`);
    return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}

/**
 * origin ที่ผู้ใช้เห็นจริง
 *
 * หลัง load balancer ของ Vercel ค่า request.url เป็นโฮสต์ภายใน
 * ถ้า redirect ตามนั้นผู้ใช้จะถูกส่งไปโดเมนที่ไม่มีอยู่จริง
 * จึงต้องอ่าน x-forwarded-host เมื่ออยู่บน production
 */
function publicOrigin(request: NextRequest): string {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV !== "production") return origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return origin;

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${forwardedHost}`;
}

function classify(message: string): string {
  if (/expired|invalid|already/i.test(message)) return "expired";
  if (/allowlist|ไม่อยู่ในรายชื่อ/i.test(message)) return "not_allowed";
  return "failed";
}
