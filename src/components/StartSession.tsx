"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SetOption = { id: string; name: string; count: number; kind: string };
export type SubjectOption = { code: string; shortName: string };

export default function StartSession({
  bankSize,
  sets,
  subjects,
  initialSubject,
}: {
  bankSize: number;
  sets: SetOption[];
  subjects: SubjectOption[];
  initialSubject?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [count, setCount] = useState(20);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [minutes, setMinutes] = useState<string>("");

  async function start(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "เริ่มชุดไม่สำเร็จ");
      setBusy(false);
      return;
    }
    router.push(`/session/${data.id}`);
  }

  // คลังโจทย์ไม่ได้อยู่ใน repo นี้ ต้องนำเข้าจากเครื่องเจ้าของระบบก่อน
  if (bankSize === 0) return <ComingSoon />;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-[var(--color-bad)]">{error}</p>
      )}

      <Card
        title="ซ้อมตามจุดอ่อน"
        note="ระบบเลือกโจทย์ให้เอง เริ่มจากวิชาที่ห่างเป้ามากที่สุดถ่วงด้วยสัดส่วนข้อสอบจริง ไม่แตะชุดสำรอง"
        highlight
      >
        <div className="flex flex-wrap gap-2">
          {[10, 20, 30, 50].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`rounded-lg border px-4 py-2 text-sm tabular ${
                count === n
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                  : "border-[var(--color-line)] bg-white"
              }`}
            >
              {n} ข้อ
            </button>
          ))}
        </div>
        <button
          onClick={() => start({ mode: "adaptive", count })}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-[var(--color-brand)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          เริ่มซ้อม {count} ข้อ
        </button>
      </Card>

      <Card title="ชุดข้อสอบเสมือนจริง" note="เวลาเท่าสนามจริง 90 วินาทีต่อข้อ หมดเวลาตัดส่งทันที ข้อที่ไม่ได้ตอบนับเป็นผิด">
        {sets.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            ยังไม่มีชุดในระบบ — นำเข้าเฉลยหรือโจทย์ก่อน
          </p>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <button
                  onClick={() => start({ mode: "exam", setId: s.id })}
                  disabled={busy}
                  className="shrink-0 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs disabled:opacity-50"
                >
                  {s.count} ข้อ · {Math.round((s.count * 90) / 60)} นาที
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="ตั้งชุดเอง" note="เลือกวิชา จำนวนข้อ และเวลาเอง หมดเวลาแล้วทำต่อได้ แต่ระบบบันทึกว่าเกินงบ">
        <div className="space-y-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-3 text-sm"
          >
            <option value="">ทุกวิชา</option>
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
              max={180}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
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
              placeholder="นาที (ว่าง = ตามงบ)"
            />
          </div>
          <button
            onClick={() =>
              start({
                mode: "custom",
                subjectCode: subject || null,
                count,
                minutes: minutes ? Number(minutes) : null,
              })
            }
            disabled={busy}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white py-3 text-sm font-semibold disabled:opacity-50"
          >
            เริ่มชุดที่ตั้งเอง
          </button>
        </div>
      </Card>
    </div>
  );
}

function ComingSoon() {
  return (
    <section className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
        Coming Soon
      </p>
      <h2 className="mt-1 font-semibold">คลังข้อสอบยังไม่เปิด</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        ตัวจับเวลาและระบบติดตามพร้อมใช้งานแล้ว แต่ยังไม่มีโจทย์ในคลัง
        เนื้อหาข้อสอบเป็นลิขสิทธิ์ของตลาดหลักทรัพย์ฯ จึงไม่ได้รวมอยู่ในโค้ดชุดนี้
        และต้องนำเข้าแยกโดยเจ้าของระบบ
      </p>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        ระหว่างนี้ใช้ <strong>บันทึกผลจากภายนอก</strong> ด้านล่างได้เลย —
        ไปทำ Practice Exam ทางการของ ตลท. แล้วเอาผลกลับมาลง สถิติรายวิชาเดินได้ตามปกติ
      </p>
    </section>
  );
}

function Card({
  title,
  note,
  highlight,
  children,
}: {
  title: string;
  note: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[var(--color-brand)]/40 bg-[var(--color-card)]"
          : "border-[var(--color-line)] bg-[var(--color-card)]"
      }`}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 mt-0.5 text-xs text-[var(--color-muted)]">{note}</p>
      {children}
    </section>
  );
}
