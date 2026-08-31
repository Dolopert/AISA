"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, configError } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(errorFromQuery(params.get("error")));
  const misconfigured = configError();

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setBusy(false);
    if (error) {
      // trigger ฝั่ง DB ปฏิเสธอีเมลที่ไม่อยู่ใน allowlist ตั้งแต่ตอนขอลิงก์
      setError(
        /allowlist|ไม่อยู่ในรายชื่อ|Database error/i.test(error.message)
          ? "อีเมลนี้ไม่อยู่ในรายชื่อที่อนุญาต ให้เจ้าของระบบเพิ่มให้ก่อน"
          : error.message,
      );
      return;
    }
    setSent(true);
  }

  if (misconfigured) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4">
        <h1 className="text-2xl font-bold">AISA Tracker</h1>
        <div className="rounded-xl border border-[var(--color-bad)] bg-[var(--color-bad-bg)] p-4">
          <p className="font-semibold text-[var(--color-bad)]">ตั้งค่าไม่ครบ</p>
          <p className="mt-1 text-sm">{misconfigured}</p>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            ค่าที่ขึ้นต้นด้วย NEXT_PUBLIC_ ถูกฝังตอน build ไม่ใช่ตอนรัน
            แก้บน Vercel แล้วต้องกด Redeploy ด้วย ไม่งั้นของเก่ายังค้างอยู่
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-bold">AISA Tracker</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          ติดตามความพร้อมสอบรายหัวข้อและรายเวลา
        </p>
      </div>

      {sent ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <p className="font-semibold">ส่งลิงก์ไปที่อีเมลแล้ว</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            เปิดเมลของ <strong>{email}</strong> แล้วกดลิงก์เพื่อเข้าระบบ
            ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง
          </p>
          <p className="mt-3 rounded-lg bg-[var(--color-warn-bg)] p-3 text-xs text-[var(--color-warn)]">
            <strong>ต้องเปิดลิงก์บนเครื่องและเบราว์เซอร์เดียวกับที่ขอ</strong> —
            ถ้าขอจากคอมแล้วไปกดในเมลบน iPad จะเข้าไม่ได้
            และถ้ากดจากในแอป Gmail ให้กดค้างที่ลิงก์แล้วเลือกเปิดใน Safari
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-3 text-sm text-[var(--color-brand)] underline"
          >
            ใช้อีเมลอื่น
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted)]">อีเมล</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-4 text-base"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--color-brand)] px-4 py-4 text-base font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
          >
            {busy ? "กำลังส่งลิงก์…" : "ส่งลิงก์เข้าระบบ"}
          </button>
        </form>
      )}

      {error && <p className="rounded-lg bg-[var(--color-bad-bg)] p-3 text-sm text-[var(--color-bad)]">{error}</p>}

      <p className="text-xs text-[var(--color-muted)]">
        ระบบนี้เป็นวงปิด เข้าได้เฉพาะอีเมลที่อยู่ในรายชื่อที่อนุญาตไว้ล่วงหน้า ไม่มีการสมัครเอง
        และไม่มีรหัสผ่านให้จำ
      </p>
    </main>
  );
}

function errorFromQuery(code: string | null): string | null {
  if (!code) return null;
  if (code === "not_allowed") return "อีเมลนี้ไม่อยู่ในรายชื่อที่อนุญาต";
  if (code === "missing_code") return "ลิงก์ไม่สมบูรณ์ ลองขอลิงก์ใหม่อีกครั้ง";
  if (code === "expired")
    return "ลิงก์ใช้ไม่ได้ — หมดอายุ ถูกใช้ไปแล้ว หรือเปิดคนละเบราว์เซอร์กับที่ขอ ขอลิงก์ใหม่ได้เลย";
  return "เข้าระบบไม่สำเร็จ ลองใหม่อีกครั้ง";
}
