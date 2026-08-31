import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pct } from "@/lib/readiness";
import { timeBudget } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, label, mode, question_count, time_limit_sec, started_at, submitted_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!session) redirect("/practice");

  const { data: attempts } = await supabase
    .from("attempts")
    .select(
      "ordinal, chosen, is_correct, seconds, over_budget, " +
        "questions(id, answer, stem, explanation, reference, subject_code, " +
        "subjects(short_name), los(number, text, chapters(number, title, revised_2569)))",
    )
    .eq("session_id", id)
    .order("ordinal");

  // ชนิดจาก nested select ของ supabase-js ยังอนุมานไม่ได้ ใช้รูปแบบที่เรารู้เอง
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (attempts ?? []) as any[];
  const correct = rows.filter((r) => r.is_correct).length;
  const answered = rows.filter((r) => r.chosen !== null).length;
  const slowButRight = rows.filter((r) => r.is_correct && r.over_budget).length;
  const totalSeconds = rows.reduce((n, r) => n + Number(r.seconds ?? 0), 0);

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">{session.label}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          ตอบ {answered} จาก {session.question_count} ข้อ · ใช้เวลารวม {fmtMinutes(totalSeconds)}
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
        <p className="text-sm text-[var(--color-muted)]">คะแนน</p>
        <p className="tabular text-5xl font-bold">
          {correct}
          <span className="text-2xl text-[var(--color-muted)]">/{session.question_count}</span>
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {pct(session.question_count ? correct / session.question_count : 0)}
        </p>

        {slowButRight > 0 && (
          <p className="mt-3 rounded-lg bg-[var(--color-warn-bg)] p-3 text-sm text-[var(--color-warn)]">
            มี {slowButRight} ข้อที่ <strong>ตอบถูกแต่ช้ากว่างบเวลา</strong> —
            ในสนามจริงข้อแบบนี้จะไปกินเวลาของข้ออื่น อันตรายพอ ๆ กับตอบผิด
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">รายข้อ</h2>
        {rows.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = r.questions as any;
          const budget = timeBudget(q?.subject_code ?? null);
          const revised = Boolean(q?.los?.chapters?.revised_2569);

          return (
            <article
              key={r.ordinal}
              className={`rounded-xl border p-4 ${
                r.is_correct
                  ? "border-[var(--color-line)] bg-[var(--color-card)]"
                  : "border-[var(--color-bad-line)] bg-[var(--color-bad-bg)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  ข้อ {r.ordinal}
                  {q?.subjects?.short_name ? ` · ${q.subjects.short_name}` : ""}
                </span>
                <span className="shrink-0 text-xs tabular text-[var(--color-muted)]">
                  {r.seconds !== null ? `${Math.round(Number(r.seconds))} วิ` : "ไม่ได้ตอบ"}
                  {r.over_budget && (
                    <span className="ml-1 text-[var(--color-warn)]">(งบ {budget})</span>
                  )}
                </span>
              </div>

              {q?.stem && <p className="mt-2 whitespace-pre-wrap text-sm">{q.stem}</p>}

              <p className="mt-2 text-sm">
                คุณตอบ{" "}
                <strong className={r.is_correct ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}>
                  {r.chosen ?? "—"}
                </strong>{" "}
                · เฉลย <strong>{q?.answer}</strong>
              </p>

              {q?.explanation && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
                  {q.explanation}
                </p>
              )}

              {q?.los && (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  LOS {q.los.number} — {q.los.text}
                </p>
              )}

              {q?.reference && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">อ้างอิง: {q.reference}</p>
              )}

              {revised && (
                <p className="mt-2 rounded bg-[var(--color-warn-bg-strong)] p-2 text-xs text-[var(--color-warn)]">
                  บทนี้อยู่ในเอกสารปรับปรุงครั้งที่ 1/2569 — ตรวจเฉลยกับฉบับแก้ไขก่อนเชื่อ
                </p>
              )}
            </article>
          );
        })}
      </section>

      <div className="flex gap-2 pb-4">
        <Link
          href="/practice"
          className="flex-1 rounded-lg bg-[var(--color-brand)] py-4 text-center text-sm font-semibold text-[var(--color-on-brand)]"
        >
          ทำชุดใหม่
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] py-4 text-center text-sm"
        >
          ภาพรวม
        </Link>
      </div>
    </main>
  );
}

function fmtMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} นาที ${s} วิ` : `${s} วิ`;
}
