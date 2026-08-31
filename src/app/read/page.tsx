import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReadingPlan, getLosForChapters, getSettings, getDailyReading } from "@/lib/queries";
import { summarise, dailyReadingQuota, formatMinutes, paceRatio } from "@/lib/reading";
import { daysUntil } from "@/lib/readiness";
import ReadingPlan from "@/components/ReadingPlan";

export const dynamic = "force-dynamic";

export default async function ReadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [plan, settings, daily] = await Promise.all([
    getReadingPlan(user.id),
    getSettings(user.id),
    getDailyReading(7),
  ]);

  const chapterIds = plan.flatMap((s) => s.chapters.map((c) => c.chapterId));
  const losMap = await getLosForChapters(chapterIds);
  const losByChapter = Object.fromEntries(losMap);

  const summary = summarise(plan);
  const left = daysUntil(settings.exam_date);
  const quota = dailyReadingQuota(summary.estimateMinutesRemaining, left);
  const pace = paceRatio(plan);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const todayMinutes = daily.get(today) ?? 0;
  const weekMinutes = [...daily.values()].reduce((n, m) => n + m, 0);

  return (
    <main className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">แผนการอ่าน</h1>
        <span className="text-sm text-[var(--color-muted)]">
          เหลือ <strong className="tabular text-[var(--color-ink)]">{left}</strong> วัน
        </span>
      </header>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
        <p className="text-sm text-[var(--color-muted)]">อ่านไปแล้ว</p>
        <p className="tabular text-5xl font-bold">
          {Math.round(summary.coverage * 100)}
          <span className="text-2xl text-[var(--color-muted)]">%</span>
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {summary.chaptersDone}/{summary.chaptersTotal} บท · เหลืออีก{" "}
          {formatMinutes(summary.estimateMinutesRemaining)}
        </p>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-track)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand)]"
            style={{ width: `${Math.round(summary.coverage * 100)}%` }}
          />
        </div>

        <p className="mt-3 text-xs text-[var(--color-muted)]">
          คิดถ่วงน้ำหนักด้วยเวลาที่แต่ละบทต้องใช้ ไม่ใช่นับจำนวนบท — ไม่งั้นการไล่ติ๊กบทสั้น ๆ
          จะทำให้ตัวเลขดูดีเกินจริง
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="วันนี้" value={formatMinutes(todayMinutes)} highlight={todayMinutes >= quota} />
        <Stat label="ควรอ่าน/วัน" value={formatMinutes(quota)} />
        <Stat label="7 วันล่าสุด" value={formatMinutes(weekMinutes)} />
      </section>

      {pace !== null && pace > 1.15 && (
        <p className="rounded-xl bg-[var(--color-warn-bg)] p-4 text-sm text-[var(--color-warn)]">
          บทที่อ่านจบไปแล้วใช้เวลาจริงมากกว่าที่ประมาณไว้ราว{" "}
          <strong className="tabular">{Math.round((pace - 1) * 100)}%</strong> —
          ถ้ายังเป็นแบบนี้ เวลาที่เหลือจริงจะมากกว่า{" "}
          {formatMinutes(summary.estimateMinutesRemaining)} ที่แสดงอยู่
          ปรับค่าประมาณใน <code>src/lib/config.ts</code> ให้ตรงความเร็วจริงได้
        </p>
      )}

      <ReadingPlan subjects={plan} losByChapter={losByChapter} />
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight
          ? "border-[var(--color-good)] bg-[var(--color-good-bg)]"
          : "border-[var(--color-line)] bg-[var(--color-card)]"
      }`}
    >
      <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
      <p className="tabular text-sm font-semibold">{value}</p>
    </div>
  );
}
