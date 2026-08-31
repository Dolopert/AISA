"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SubjectOption = { code: string; shortName: string };

export default function ExternalForm({
  subjects,
  initialSubject,
  initialCount,
}: {
  subjects: SubjectOption[];
  initialSubject: string;
  initialCount: number;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [count, setCount] = useState(initialCount);
  const [minutes, setMinutes] = useState("");
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(n: number) {
    setWrong((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async function save() {
    if (!subject) {
      setError("เลือกวิชาก่อน");
      return;
    }
    setBusy(true);
    setError(null);

    const results = Array.from({ length: count }, (_, i) => !wrong.has(i + 1));
    const name = subjects.find((s) => s.code === subject)?.shortName ?? subject;

    const res = await fetch("/api/external", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subjectCode: subject,
        label: `Practice Exam ตลท. — ${name}`,
        results,
        minutes: minutes ? Number(minutes) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      setBusy(false);
      return;
    }
    router.push(`/session/${data.id}/result`);
  }

  const correct = count - wrong.size;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-[var(--color-bad)]">{error}</p>}

      <section className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-3 text-sm"
        >
          <option value="">เลือกวิชา</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.shortName}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-3 text-sm tabular"
            placeholder="จำนวนข้อ"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-3 text-sm tabular"
            placeholder="เวลารวม (นาที)"
          />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">กดข้อที่ตอบผิด</h2>
          <span className="tabular text-sm">
            {correct}/{count}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={`aspect-square rounded text-xs tabular ${
                wrong.has(n)
                  ? "bg-[var(--color-bad)] text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-lg bg-[var(--color-brand)] py-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "กำลังบันทึก…" : "บันทึกผล"}
      </button>
    </div>
  );
}
