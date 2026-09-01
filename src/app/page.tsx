import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getSubjectStats, getReadingPlan, getDailyReading } from "@/lib/queries";
import { computeReadiness, pct, daysUntil } from "@/lib/readiness";
import { summarise, dailyReadingQuota, formatMinutes } from "@/lib/reading";
import { assessPace, daysFromToday, dayKey, type PaceReport } from "@/lib/pace";
import { EXAM, REVISION_NOTICE, roundFor } from "@/lib/config";
import ReadingCalendar from "@/components/ReadingCalendar";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [settings, plan, stats, daily] = await Promise.all([
    getSettings(user.id),
    getReadingPlan(user.id),
    getSubjectStats(user.id),
    getDailyReading(400),
  ]);

  const summary = summarise(plan);
  const readiness = computeReadiness(stats);
  const left = daysUntil(settings.exam_date);
  const quota = dailyReadingQuota(summary.estimateMinutesRemaining, left);
  const pace = assessPace({
    remainingMinutes: summary.estimateMinutesRemaining,
    daysLeft: left,
    daily,
  });

  const todayMinutes = daily.get(dayKey(new Date())) ?? 0;
  const answered = stats.reduce((n, s) => n + s.answered, 0);
  const round = roundFor(settings.exam_date);

  const nextUp = plan
    .map((s) => {
      const remaining = s.chapters
        .filter((c) => c.status !== "done")
        .reduce((n, c) => n + c.estimateMinutes, 0);
      return { ...s, remaining, score: (remaining / 60) * (s.weight / 100) };
    })
    .filter((s) => s.remaining > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <main className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">ภาพรวม</h1>
        <span className="text-sm text-[var(--color-muted)]">
          เหลือ <strong className="tabular text-[var(--color-ink)]">{left}</strong> วัน
        </span>
      </header>

      {round && <RegistrationNotice round={round} />}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
        <p className="text-sm text-[var(--color-muted)]">อ่านไปแล้ว</p>
        <p className="tabular text-5xl font-bold">
          {Math.round(summary.coverage * 100)}
          <span className="text-2xl text-[var(--color-muted)]">%</span>
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {summary.chaptersDone}/{summary.chaptersTotal} บท · เหลือ{" "}
          {formatMinutes(summary.estimateMinutesRemaining)}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-track)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand)]"
            style={{ width: `${Math.round(summary.coverage * 100)}%` }}
          />
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-line)] pt-3 text-sm">
          <span className="text-[var(--color-muted)]">วันนี้</span>
          <span className="tabular">
            <strong className={todayMinutes >= quota ? "text-[var(--color-good)]" : ""}>
              {formatMinutes(todayMinutes)}
            </strong>
            <span className="text-[var(--color-muted)]"> / {formatMinutes(quota)}</span>
          </span>
        </div>
      </section>

      <PaceCard pace={pace} />

      <ReadingCalendar
        initialMonth={dayKey(new Date()).slice(0, 7)}
        quota={quota}
        examDate={settings.exam_date}
      />

      {nextUp.length > 0 && (
        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <h2 className="mb-1 text-sm font-semibold">ควรอ่านวิชานี้ก่อน</h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            เรียงจากงานที่เหลือ ถ่วงด้วยสัดส่วนข้อสอบจริง
          </p>
          <ol className="space-y-2">
            {nextUp.map((s, i) => (
              <li key={s.code} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 shrink-0 tabular text-[var(--color-muted)]">{i + 1}</span>
                <Link href="/read" className="min-w-0 flex-1 truncate text-[var(--color-brand)]">
                  {s.shortName}
                </Link>
                <span className="shrink-0 text-xs tabular text-[var(--color-muted)]">
                  เหลือ {formatMinutes(s.remaining)} · {s.weight}%
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-warn-line)] bg-[var(--color-warn-bg)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-warn)]">{REVISION_NOTICE.label}</h2>
        <p className="mt-1 text-xs">
          มีผลกับ{REVISION_NOTICE.effective} — ครอบคลุมรอบสอบของคุณ
          8 บทที่ถูกแก้มีป้ายเตือนในแผนการอ่าน ให้อ่านจากฉบับปรับปรุง ไม่ใช่ตำราเดิม
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">ผลจากการทำข้อสอบ</h2>
          <Link href="/practice" className="text-xs text-[var(--color-brand)]">
            ไปทำข้อสอบ
          </Link>
        </div>

        {answered === 0 ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            ยังไม่เคยทำโจทย์ — การอ่านจบบอกว่าคุณผ่านเนื้อหามาแล้ว แต่ไม่ได้บอกว่าตอบได้
            ซึ่งเป็นสิ่งเดียวที่ข้อสอบวัด
          </p>
        ) : (
          <div className="mt-2 space-y-1 text-sm">
            <Row
              label="คะแนนคาดการณ์"
              value={pct(readiness.projected)}
              tone={readiness.passesOverall ? "good" : "bad"}
            />
            <Row
              label="กลุ่มวิชาที่ 1 — จรรยาบรรณ"
              value={pct(readiness.group1)}
              tone={readiness.group1 !== null && !readiness.passesGroup1 ? "bad" : "good"}
            />
            <p className="pt-1 text-xs text-[var(--color-muted)]">
              เกณฑ์ผ่าน {pct(EXAM.passOverall)} ทั้งสองช่อง · จาก {answered} ข้อที่ทำไปแล้ว
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * การ์ดบอกว่าตามแผนทันไหม
 *
 * ตั้งใจให้ "ช้า" กับ "ช้ามาก" หน้าตาต่างกันชัด และบอกตัวเลขที่ทำได้จริง
 * (ต้องเพิ่มอีกวันละกี่นาที) ไม่ใช่แค่บอกว่าช้าแล้วปล่อยให้ไปคิดเอง
 */
function PaceCard({ pace }: { pace: PaceReport }) {
  const tone = {
    "no-data": { border: "border-[var(--color-line)]", bg: "bg-[var(--color-card)]", text: "" },
    done: {
      border: "border-[var(--color-good)]",
      bg: "bg-[var(--color-good-bg)]",
      text: "text-[var(--color-good)]",
    },
    ahead: {
      border: "border-[var(--color-good)]",
      bg: "bg-[var(--color-good-bg)]",
      text: "text-[var(--color-good)]",
    },
    ontrack: {
      border: "border-[var(--color-good)]",
      bg: "bg-[var(--color-card)]",
      text: "text-[var(--color-good)]",
    },
    behind: {
      border: "border-[var(--color-warn-line)]",
      bg: "bg-[var(--color-warn-bg)]",
      text: "text-[var(--color-warn)]",
    },
    critical: {
      border: "border-[var(--color-bad)]",
      bg: "bg-[var(--color-bad-bg)]",
      text: "text-[var(--color-bad)]",
    },
  }[pace.state];

  return (
    <section className={`rounded-xl border p-4 ${tone.border} ${tone.bg}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-sm font-semibold ${tone.text}`}>{pace.headline}</p>
        {pace.streak > 0 && (
          <span className="shrink-0 text-xs tabular text-[var(--color-muted)]">
            อ่านต่อเนื่อง {pace.streak} วัน
          </span>
        )}
      </div>
      <p className="mt-1 text-xs">{pace.detail}</p>

      {pace.recentPerDay !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-line)] pt-3 text-xs">
          <div>
            <p className="text-[var(--color-muted)]">เฉลี่ยจริง 7 วัน</p>
            <p className="tabular font-semibold">{formatMinutes(Math.round(pace.recentPerDay))}/วัน</p>
          </div>
          <div>
            <p className="text-[var(--color-muted)]">ต้องการ</p>
            <p className="tabular font-semibold">{formatMinutes(pace.requiredPerDay)}/วัน</p>
          </div>
        </div>
      )}
    </section>
  );
}

function RegistrationNotice({
  round,
}: {
  round: { label: string; date: string; registerOpen: string; registerClose: string };
}) {
  const toOpen = daysFromToday(round.registerOpen);
  const toClose = daysFromToday(round.registerClose);

  // สมัครไปแล้วหรือหมดเขตแล้ว ไม่ต้องรบกวน
  if (toClose < 0) return null;

  if (toOpen > 0) {
    return (
      <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 text-xs">
        <strong>{round.label}</strong> — เปิดรับสมัครอีก{" "}
        <strong className="tabular">{toOpen}</strong> วัน (
        {formatThaiDate(round.registerOpen)}) ถึง {formatThaiDate(round.registerClose)}
      </p>
    );
  }

  const urgent = toClose <= 14;
  return (
    <p
      className={`rounded-xl border p-3 text-xs ${
        urgent
          ? "border-[var(--color-bad)] bg-[var(--color-bad-bg)]"
          : "border-[var(--color-warn-line)] bg-[var(--color-warn-bg)]"
      }`}
    >
      <strong className={urgent ? "text-[var(--color-bad)]" : "text-[var(--color-warn)]"}>
        เปิดรับสมัครแล้ว
      </strong>{" "}
      — ปิดรับ {formatThaiDate(round.registerClose)} เหลืออีก{" "}
      <strong className="tabular">{toClose}</strong> วัน
      {urgent ? " · ไม่สมัครทันคือไม่ได้สอบ ต่อให้อ่านครบแล้วก็ตาม" : ""}
    </p>
  );
}

function formatThaiDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function Row({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span
        className={`tabular font-semibold ${
          tone === "good" ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
