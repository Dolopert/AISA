"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Round = { label: string; date: string };

export default function SettingsForm({
  examDate,
  targetOverall,
  targetGroup1,
  rounds,
}: {
  examDate: string;
  targetOverall: number;
  targetGroup1: number;
  rounds: Round[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(examDate);
  const [overall, setOverall] = useState(Math.round(targetOverall * 100));
  const [group1, setGroup1] = useState(Math.round(targetGroup1 * 100));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        exam_date: date,
        target_overall: overall / 100,
        target_group1: group1 / 100,
      }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <h2 className="text-sm font-semibold">วันสอบและเป้าหมาย</h2>
      <p className="mb-3 mt-0.5 text-xs text-[var(--color-muted)]">
        รอบสอบเป็นข้อมูลตายตัวในระบบ ไม่ได้ดึงจากเว็บ ตลท. — ถ้า ตลท. ประกาศรอบใหม่ ต้องแก้ใน config
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {rounds.map((r) => (
            <button
              key={r.date}
              onClick={() => setDate(r.date)}
              className={`rounded-lg border px-3 py-2 text-xs ${
                date === r.date
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                  : "border-[var(--color-line)] bg-[var(--color-input)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs text-[var(--color-muted)]">วันสอบ</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-3 text-sm tabular"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-[var(--color-muted)]">เป้าคะแนนรวม (%)</span>
            <input
              type="number"
              inputMode="numeric"
              min={70}
              max={100}
              value={overall}
              onChange={(e) => setOverall(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-3 text-sm tabular"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-[var(--color-muted)]">เป้าจรรยาบรรณ (%)</span>
            <input
              type="number"
              inputMode="numeric"
              min={70}
              max={100}
              value={group1}
              onChange={(e) => setGroup1(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-3 text-sm tabular"
            />
          </label>
        </div>

        <p className="text-xs text-[var(--color-muted)]">
          เกณฑ์จริงคือ 70% ทั้งสองช่อง การตั้งเป้าเท่าเกณฑ์พอดีแปลว่าไม่มีที่ให้พลาดเลยในวันสอบ
        </p>

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-[var(--color-brand)] py-3 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก…" : saved ? "บันทึกแล้ว" : "บันทึก"}
        </button>
      </div>
    </section>
  );
}
