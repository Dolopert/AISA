"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMinutes } from "@/lib/reading";

type DayData = { minutes: number; sessions: number };

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export default function ReadingCalendar({
  initialMonth,
  quota,
  examDate,
}: {
  initialMonth: string;
  /** โควตานาทีต่อวัน ใช้ตัดสินว่าวันนั้นถึงเป้าหรือยัง */
  quota: number;
  examDate: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reading/calendar?month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDays(d.days ?? {});
      })
      .catch(() => {
        if (!cancelled) setDays({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const [year, mon] = month.split("-").map(Number);
  const cells = useMemo(() => buildGrid(year, mon), [year, mon]);

  const total = Object.values(days).reduce((n, d) => n + d.minutes, 0);
  const activeDays = Object.values(days).filter((d) => d.minutes > 0).length;
  const hitQuota = Object.values(days).filter((d) => d.minutes >= quota).length;

  const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">ปฏิทินการอ่าน</h2>
        <div className="flex items-center gap-1">
          <NavButton onClick={() => setMonth(shiftMonth(month, -1))} label="เดือนก่อนหน้า">
            ‹
          </NavButton>
          <span className="min-w-28 text-center text-xs tabular">
            {MONTHS[mon - 1]} {year + 543}
          </span>
          <NavButton onClick={() => setMonth(shiftMonth(month, 1))} label="เดือนถัดไป">
            ›
          </NavButton>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] text-[var(--color-muted)]">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell === null) return <div key={`x${i}`} />;

          const key = `${month}-${String(cell).padStart(2, "0")}`;
          const data = days[key];
          const minutes = data?.minutes ?? 0;
          const isToday = key === todayKey;
          const isExam = key === examDate;
          const reached = minutes >= quota && quota > 0;

          return (
            <div
              key={key}
              title={
                isExam
                  ? "วันสอบ"
                  : minutes > 0
                    ? `${formatMinutes(minutes)} · ${data?.sessions ?? 0} ครั้ง`
                    : "ไม่ได้อ่าน"
              }
              className={`flex aspect-square flex-col items-center justify-center rounded border text-[10px] ${
                isExam
                  ? "border-[var(--color-bad)] bg-[var(--color-bad-bg)]"
                  : reached
                    ? "border-[var(--color-good)] bg-[var(--color-good-bg)]"
                    : minutes > 0
                      ? "border-[var(--color-warn-line)] bg-[var(--color-warn-bg)]"
                      : "border-[var(--color-line)]"
              } ${isToday ? "ring-1 ring-[var(--color-brand)]" : ""}`}
            >
              <span className={`tabular ${minutes > 0 || isExam ? "font-semibold" : "text-[var(--color-muted)]"}`}>
                {cell}
              </span>
              {isExam ? (
                <span className="text-[8px] text-[var(--color-bad)]">สอบ</span>
              ) : minutes > 0 ? (
                <span
                  className={`tabular text-[8px] ${
                    reached ? "text-[var(--color-good)]" : "text-[var(--color-warn)]"
                  }`}
                >
                  {minutes}น
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--color-line)] pt-3 text-xs">
        <span className="text-[var(--color-muted)]">
          รวมเดือนนี้ <strong className="tabular text-[var(--color-ink)]">{formatMinutes(total)}</strong>
        </span>
        <span className="text-[var(--color-muted)]">
          อ่าน <strong className="tabular text-[var(--color-ink)]">{activeDays}</strong> วัน ·
          ถึงเป้า <strong className="tabular text-[var(--color-good)]">{hitQuota}</strong> วัน
        </span>
      </div>

      <p className="mt-2 text-[10px] text-[var(--color-muted)]">
        เขียว = ถึงโควตาของวันนั้น · เหลือง = อ่านแต่ยังไม่ถึง · ว่าง = ไม่ได้อ่าน
        {loading ? " · กำลังโหลด…" : ""}
      </p>
    </section>
  );
}

function NavButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-7 w-7 rounded border border-[var(--color-line)] text-sm text-[var(--color-muted)]"
    >
      {children}
    </button>
  );
}

/** ช่องว่างต้นเดือนตามวันในสัปดาห์ แล้วตามด้วยวันที่ 1..n */
function buildGrid(year: number, mon: number): (number | null)[] {
  const firstWeekday = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
