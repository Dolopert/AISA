import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * ปลายทางของลิงก์เข้าระบบ รองรับ 2 รูปแบบ
 *
 *   token_hash + type  — ใช้ตอน template อีเมลส่ง {{ .TokenHash }} มา
 *                        ทำงานข้ามเครื่องได้ (ขอลิงก์บนคอม กดในเมลบน iPad)
 *   code               — PKCE ปกติ ใช้ได้เฉพาะเบราว์เซอร์เดียวกับที่ขอลิงก์
 *                        เพราะ code verifier อยู่ใน storage ของเครื่องนั้น
 *
 * รองรับทั้งคู่เพราะผู้ใช้จริงอ่านเมลบน iPad แต่ขอลิงก์จากคอมได้
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

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

function classify(message: string): string {
  if (/expired|invalid|already/i.test(message)) return "expired";
  if (/allowlist|ไม่อยู่ในรายชื่อ/i.test(message)) return "not_allowed";
  return "failed";
}
