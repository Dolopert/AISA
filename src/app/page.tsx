import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getSubjectStats, getRecentSessions } from "@/lib/queries";
import { computeReadiness, prioritise, pct, daysUntil, questionsInExam } from "@/lib/readiness";
import { EXAM, REVISION_NOTICE, timeBudget } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [settings, stats, recent] = await Promise.all([
    getSettings(user.id),
    getSubjectStats(user.id),
    getRecentSessions(user.id, 5),
  ]);

  const readiness = computeReadiness(stats);
  const priorities = prioritise(stats, settings.target_overall);
  const left = daysUntil(settings.exam_date);
  const totalAnswered = stats.reduce((n, s) => n + s.answered, 0);

  return (
    <main className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">ภาพรวม</h1>
        <span className="text-sm text-[var(--color-muted)]">
          เหลือ <strong className="tabular text-[var(--color-ink)]">{left}</strong> วัน
        </span>
      </header>

      {totalAnswered === 0 ? (
        <EmptyState />
      ) : (
        <ReadinessCard readiness={readiness} target={settings.target_overall} />
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">ควรซ้อมวิชานี้ก่อน</h2>
        <ol className="space-y-2">
          {priorities.slice(0, 4).map((p, i) => {
            const s = stats.find((x) => x.code === p.code)!;
            return (
              <li key={p.code} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 shrink-0 text-[var(--color-muted)] tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/practice?subject=${p.code}`}
                    className="font-medium text-[var(--color-brand)]"
                  >
                    {p.shortName}
                  </Link>
                  <p className="text-xs text-[var(--color-muted)]">{p.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-muted)] tabular">
                  ~{questionsInExam(s.weight)} ข้อ
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <RevisionCard />

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">ความแม่นรายวิชา</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-muted)]">
              <th className="pb-2 font-normal">วิชา</th>
              <th className="pb-2 text-right font-normal">สัดส่วน</th>
              <th className="pb-2 text-right font-normal">แม่น</th>
              <th className="pb-2 text-right font-normal">วิ/ข้อ</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const budget = timeBudget(s.code);
              const slow = s.avgSeconds !== null && s.avgSeconds > budget;
              return (
                <tr key={s.code} className="border-t border-[var(--color-line)]">
                  <td className="py-2">
                    {s.shortName}
                    {s.group === 1 && (
                      <span className="ml-1 text-[10px] text-[var(--color-warn)]">กลุ่ม 1</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular text-[var(--color-muted)]">{s.weight}%</td>
                  <td
                    className={`py-2 text-right tabular font-medium ${
                      s.accuracy === null
                        ? "text-[var(--color-muted)]"
                        : s.accuracy >= settings.target_overall
                          ? "text-[var(--color-good)]"
                          : "text-[var(--color-bad)]"
                    }`}
                  >
                    {pct(s.accuracy)}
                  </td>
                  <td
                    className={`py-2 text-right tabular ${
                      slow ? "text-[var(--color-warn)]" : "text-[var(--color-muted)]"
                    }`}
                    title={`งบ ${budget} วิ`}
                  >
                    {s.avgSeconds !== null ? Math.round(s.avgSeconds) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          คอลัมน์ วิ/ข้อ เทียบกับงบเวลาของวิชานั้น ไม่ใช่ 90 วิเท่ากันหมด
        </p>
      </section>

      {recent.length > 0 && (
        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <h2 className="mb-3 text-sm font-semibold">ชุดล่าสุด</h2>
          <ul className="space-y-2 text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3">
                <Link
                  href={s.status === "active" ? `/session/${s.id}` : `/session/${s.id}/result`}
                  className="min-w-0 flex-1 truncate text-[var(--color-brand)]"
                >
                  {s.label}
                </Link>
                <span className="shrink-0 tabular text-[var(--color-muted)]">
                  {s.status === "active"
                    ? "ยังทำอยู่"
                    : `${s.correct}/${s.answered || s.question_count}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <section className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <h2 className="font-semibold">ยังไม่มีข้อมูล</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        ทำชุดวัดระดับสั้น ๆ ก่อน แล้วระบบจะรู้ว่าควรให้คุณซ้อมอะไรก่อน — เดาไม่ได้ถ้าไม่มีข้อมูล
      </p>
      <Link
        href="/practice"
        className="mt-4 inline-block rounded-lg bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white"
      >
        เริ่มวัดระดับ
      </Link>
    </section>
  );
}

function RevisionCard() {
  return (
    <section className="rounded-xl border border-[var(--color-warn)]/30 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-[var(--color-warn)]">
        {REVISION_NOTICE.label}
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink)]">
        มีผลกับ{REVISION_NOTICE.effective} — ครอบคลุมรอบสอบของคุณ
        เนื้อหาที่ถูกแก้ต้องอ่านจากฉบับปรับปรุง ไม่ใช่ตำราเดิม และเฉลยเก่าในหัวข้อเหล่านี้อาจใช้ไม่ได้
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-muted)]">
        <li>หลักการลงทุน บทที่ 6 (เรียบเรียงใหม่ทั้งบท)</li>
        <li>การเงินธุรกิจ บทที่ 3</li>
        <li>ตราสารทุน บทที่ 2, 8</li>
        <li>อนุพันธ์ บทที่ 1, 2, 3, 6</li>
      </ul>
    </section>
  );
}

function ReadinessCard({
  readiness,
  target,
}: {
  readiness: ReturnType<typeof computeReadiness>;
  target: number;
}) {
  const g1Failed = readiness.group1 !== null && !readiness.passesGroup1;

  return (
    <section
      className={`rounded-xl border p-5 ${
        g1Failed
          ? "border-[var(--color-bad)] bg-red-50"
          : "border-[var(--color-line)] bg-[var(--color-card)]"
      }`}
    >
      <p className="text-sm text-[var(--color-muted)]">คะแนนคาดการณ์</p>
      <p
        className={`tabular text-5xl font-bold ${
          readiness.passesOverall ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"
        }`}
      >
        {pct(readiness.projected)}
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        เกณฑ์ผ่าน {pct(EXAM.passOverall)} · เป้าคุณ {pct(target)}
      </p>

      <div className="mt-4 border-t border-[var(--color-line)] pt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span>กลุ่มวิชาที่ 1 — จรรยาบรรณ</span>
          <span
            className={`tabular font-semibold ${
              g1Failed ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"
            }`}
          >
            {pct(readiness.group1)}
          </span>
        </div>
        {g1Failed && (
          <p className="mt-1 text-xs font-medium text-[var(--color-bad)]">
            ต่ำกว่า 70% — ต่อให้คะแนนรวมผ่าน ก็ตกทั้งสนาม
          </p>
        )}
        {readiness.group1 === null && (
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            ยังไม่เคยทำโจทย์กลุ่มนี้ — นี่คือวิชาที่คนตกมากที่สุดเพราะมองข้าม
          </p>
        )}
      </div>

      {readiness.uncoveredWeight > 0 && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          ตัวเลขนี้อ้างอิงจากวิชาที่คิดเป็น {Math.round(readiness.coveredWeight)}% ของข้อสอบ
          อีก {Math.round(readiness.uncoveredWeight)}% ยังไม่มีข้อมูล จึงยังเชื่อได้ไม่เต็มที่
        </p>
      )}
    </section>
  );
}
