"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type RunnerQuestion = {
  id: string;
  ordinal: number;
  stem: string | null;
  choices: string[] | null;
  subjectShort: string | null;
  budget: number;
};

type Props = {
  sessionId: string;
  mode: "exam" | "adaptive" | "custom";
  label: string;
  timeLimitSec: number | null;
  questions: RunnerQuestion[];
};

export default function Runner({ sessionId, mode, label, timeLimitSec, questions }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  const questionStart = useRef<number>(Date.now());
  const sessionStart = useRef<number>(Date.now());

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;

  // นาฬิกาเดินตลอด ไม่มี pause — มีเมื่อไหร่สถิติเวลาเชื่อไม่ได้ทันที
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const finish = useCallback(
    async (abandoned = false) => {
      if (submitting) return;
      setSubmitting(true);
      await fetch(`/api/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ abandoned }),
      });
      router.push(abandoned ? "/practice" : `/session/${sessionId}/result`);
    },
    [router, sessionId, submitting],
  );

  const remaining = timeLimitSec !== null ? timeLimitSec - elapsed : null;

  // โหมดสนามจริง: หมดเวลา = ตัดส่งทันที ข้อที่ไม่ได้ตอบนับเป็นผิด
  useEffect(() => {
    if (remaining === null || remaining > 0 || expired) return;
    setExpired(true);
    if (mode === "exam") void finish(false);
  }, [remaining, expired, mode, finish]);

  async function choose(choice: number) {
    if (!current) return;
    const seconds = (Date.now() - questionStart.current) / 1000;
    setAnswers((a) => ({ ...a, [current.ordinal]: choice }));

    void fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        ordinal: current.ordinal,
        questionId: current.id,
        chosen: choice,
        seconds,
      }),
    });

    if (index < questions.length - 1) {
      setIndex(index + 1);
      questionStart.current = Date.now();
    }
  }

  function goto(i: number) {
    setIndex(i);
    questionStart.current = Date.now();
  }

  const overBudget = useMemo(() => {
    if (!current) return false;
    return (Date.now() - questionStart.current) / 1000 > current.budget;
  }, [current, elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs text-[var(--color-muted)]">
            ข้อ {index + 1} / {questions.length} · ตอบแล้ว {answeredCount}
          </p>
        </div>
        <Clock remaining={remaining} elapsed={elapsed} expired={expired} mode={mode} />
      </header>

      {expired && mode !== "exam" && (
        <p className="rounded-lg bg-[var(--color-warn-bg)] p-3 text-sm text-[var(--color-warn)]">
          เกินเวลาที่ตั้งไว้แล้ว ทำต่อได้ แต่ข้อที่เหลือจะถูกบันทึกว่าเกินงบเวลา
        </p>
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">
            ข้อ {current.ordinal}
            {current.subjectShort ? ` · ${current.subjectShort}` : ""}
          </span>
          <span className={`text-xs tabular ${overBudget ? "text-[var(--color-warn)]" : "text-[var(--color-muted)]"}`}>
            งบ {current.budget} วิ
          </span>
        </div>

        {current.stem ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">{current.stem}</p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            ชุดนี้ไม่มีตัวโจทย์ในระบบ — อ่านโจทย์ข้อ {current.ordinal} จากเอกสารของคุณ แล้วกดคำตอบด้านล่าง
          </p>
        )}

        {current.choices && (
          <ol className="mt-3 space-y-1 text-sm">
            {current.choices.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-[var(--color-muted)]">{i + 1})</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => {
          const picked = answers[current.ordinal] === n;
          return (
            <button
              key={n}
              onClick={() => choose(n)}
              className={`answer-key rounded-xl border text-2xl font-bold transition ${
                picked
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                  : "border-[var(--color-line)] bg-[var(--color-card)] active:bg-[var(--color-track)]"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => goto(Math.max(0, index - 1))}
          disabled={index === 0}
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] py-3 text-sm disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <button
          onClick={() => goto(Math.min(questions.length - 1, index + 1))}
          disabled={index === questions.length - 1}
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] py-3 text-sm disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>

      <Grid questions={questions} answers={answers} index={index} onPick={goto} />

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => finish(false)}
          disabled={submitting}
          className="flex-1 rounded-lg bg-[var(--color-brand)] py-4 text-base font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
        >
          ส่งคำตอบ
        </button>
        <button
          onClick={() => {
            if (confirm("ทิ้งชุดนี้? คำตอบและเวลาทั้งหมดจะถูกลบ ไม่นับเข้าสถิติ")) {
              void finish(true);
            }
          }}
          disabled={submitting}
          className="rounded-lg border border-[var(--color-line)] px-4 py-4 text-sm text-[var(--color-muted)]"
        >
          ทิ้งชุด
        </button>
      </div>

      <p className="pb-4 text-center text-xs text-[var(--color-muted)]">
        ไม่มีปุ่มหยุดเวลา — เวลาที่วัดได้ต้องเทียบกับสนามจริงได้
      </p>
    </main>
  );
}

function Clock({
  remaining,
  elapsed,
  expired,
  mode,
}: {
  remaining: number | null;
  elapsed: number;
  expired: boolean;
  mode: string;
}) {
  const value = remaining !== null ? Math.max(0, remaining) : elapsed;
  const danger = remaining !== null && remaining <= 300;

  return (
    <div className="shrink-0 text-right">
      <p
        className={`tabular text-2xl font-bold ${
          expired ? "text-[var(--color-bad)]" : danger ? "text-[var(--color-warn)]" : ""
        }`}
      >
        {fmt(value)}
      </p>
      <p className="text-[10px] text-[var(--color-muted)]">
        {remaining !== null ? (mode === "exam" ? "หมดเวลาตัดส่ง" : "เหลือ") : "ใช้ไป"}
      </p>
    </div>
  );
}

function Grid({
  questions,
  answers,
  index,
  onPick,
}: {
  questions: RunnerQuestion[];
  answers: Record<number, number>;
  index: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {questions.map((q, i) => {
        const done = answers[q.ordinal] !== undefined;
        return (
          <button
            key={q.id}
            onClick={() => onPick(i)}
            className={`aspect-square rounded text-[10px] tabular ${
              i === index
                ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                : done
                  ? "bg-[var(--color-track-strong)] text-[var(--color-track-ink)]"
                  : "bg-[var(--color-track)] text-[var(--color-muted)]"
            }`}
          >
            {q.ordinal}
          </button>
        );
      })}
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
