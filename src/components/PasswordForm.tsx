"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ตั้ง/เปลี่ยนรหัสผ่านสำหรับคนที่ล็อกอินอยู่แล้ว
 *
 * มีไว้เพื่อให้เลิกต้องเปิดเมลทุกครั้งที่เข้าระบบ — ตั้งครั้งเดียวแล้วใช้ได้ตลอด
 * และใช้ได้ข้ามเครื่องด้วย ต่างจากลิงก์ทางเมลที่ผูกกับเบราว์เซอร์ที่ขอ
 */
export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (password.length < 8) {
      setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setDone(true);
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <h2 className="text-sm font-semibold">รหัสผ่าน</h2>
      <p className="mb-3 mt-0.5 text-xs text-[var(--color-muted)]">
        ตั้งครั้งเดียวแล้วเข้าระบบด้วยอีเมล + รหัสผ่านได้เลย ไม่ต้องเปิดเมลอีก
        และใช้ได้ทุกเครื่อง ต่างจากลิงก์ทางเมลที่ผูกกับเบราว์เซอร์ที่กดขอ
      </p>

      <form onSubmit={save} className="space-y-2">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-3 text-sm"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="พิมพ์ซ้ำอีกครั้ง"
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[var(--color-brand)] py-3 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}
        </button>
      </form>

      {done && (
        <p className="mt-2 rounded-lg bg-[var(--color-good-bg)] p-3 text-xs text-[var(--color-good)]">
          ตั้งรหัสผ่านแล้ว — ครั้งต่อไปเลือกแท็บ &quot;รหัสผ่าน&quot; ที่หน้าเข้าสู่ระบบได้เลย
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-[var(--color-bad-bg)] p-3 text-xs text-[var(--color-bad)]">
          {error}
        </p>
      )}
    </section>
  );
}
