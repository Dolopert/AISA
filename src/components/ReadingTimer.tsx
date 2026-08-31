"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "aisa-reading-timer";

type Running = { chapterId: number; startedAt: number };

/**
 * จับเวลาการอ่านรายบท
 *
 * ต่างจากตัวจับเวลาทำข้อสอบตรงที่ **หยุดพักได้** — การอ่านมีพักเป็นเรื่องปกติ
 * กฎ "ห้ามมี pause" ใช้กับการทำข้อสอบเท่านั้น เพราะที่นั่นเวลาคือส่วนหนึ่งของการวัดผล
 *
 * เก็บสถานะไว้ใน localStorage ด้วย เผื่อปิดแท็บระหว่างอ่านแล้วกลับมาต่อ
 * ไม่งั้นคนจะเสียเวลาที่อ่านไปจริงเพราะเผลอปิดแท็บ แล้วเลิกใช้ตัวจับเวลาไปเลย
 */
export default function ReadingTimer({ chapterId }: { chapterId: number }) {
  const router = useRouter();
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(Date.now());
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Running;
      if (saved.chapterId === chapterId) setRunning(saved);
    } catch {
      // localStorage ใช้ไม่ได้ (โหมดส่วนตัว ฯลฯ) — ตัวจับเวลายังทำงานได้ แค่ไม่จำข้ามแท็บ
    }
  }, [chapterId]);

  useEffect(() => {
    if (!running) {
      if (tick.current) clearInterval(tick.current);
      return;
    }
    tick.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running]);

  function start() {
    const state = { chapterId, startedAt: Date.now() };
    setRunning(state);
    setNow(Date.now());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ไม่เป็นไร ยังจับเวลาได้ในแท็บนี้
    }
  }

  async function stop() {
    if (!running) return;
    const minutes = Math.round((Date.now() - running.startedAt) / 60_000);
    setRunning(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ไม่เป็นไร */
    }
    if (minutes < 1) return; // สั้นกว่า 1 นาที ไม่บันทึก กันการกดพลาด
    await save(minutes, "timer");
  }

  async function save(minutes: number, source: "timer" | "manual") {
    setSaving(true);
    await fetch("/api/reading/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chapterId, minutes, source }),
    });
    setSaving(false);
    router.refresh();
  }

  async function saveManual() {
    const minutes = Number(manual);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    setManual("");
    setShowManual(false);
    await save(minutes, "manual");
  }

  const elapsed = running ? Math.floor((now - running.startedAt) / 1000) : 0;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {running ? (
        <>
          <span className="tabular rounded bg-[var(--color-brand)] px-2 py-1 text-xs font-semibold text-[var(--color-on-brand)]">
            {fmt(elapsed)}
          </span>
          <button
            onClick={stop}
            disabled={saving}
            className="rounded border border-[var(--color-line)] px-2 py-1 text-xs"
          >
            หยุดและบันทึก
          </button>
        </>
      ) : (
        <button
          onClick={start}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-xs"
        >
          เริ่มจับเวลา
        </button>
      )}

      {showManual ? (
        <span className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="นาที"
            className="tabular w-20 rounded border border-[var(--color-line)] px-2 py-1 text-xs"
          />
          <button
            onClick={saveManual}
            disabled={saving}
            className="rounded bg-[var(--color-brand)] px-2 py-1 text-xs text-[var(--color-on-brand)]"
          >
            บันทึก
          </button>
          <button
            onClick={() => setShowManual(false)}
            className="px-1 text-xs text-[var(--color-muted)]"
          >
            ยกเลิก
          </button>
        </span>
      ) : (
        <button
          onClick={() => setShowManual(true)}
          className="text-xs text-[var(--color-muted)] underline"
        >
          กรอกย้อนหลัง
        </button>
      )}
    </div>
  );
}

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
