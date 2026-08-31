"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubjectProgress } from "@/lib/reading";
import { formatMinutes } from "@/lib/reading";
import ReadingTimer from "./ReadingTimer";

export type LosItem = { number: string; text: string };

export default function ReadingPlan({
  subjects,
  losByChapter,
}: {
  subjects: SubjectProgress[];
  losByChapter: Record<number, LosItem[]>;
}) {
  const [openSubject, setOpenSubject] = useState<string | null>(subjects[0]?.code ?? null);

  return (
    <div className="space-y-3">
      {subjects.map((s) => {
        const total = s.chapters.reduce((n, c) => n + c.estimateMinutes, 0);
        const done = s.chapters.filter((c) => c.status === "done");
        const doneMinutes = done.reduce((n, c) => n + c.estimateMinutes, 0);
        const pct = total > 0 ? Math.round((doneMinutes / total) * 100) : 0;
        const open = openSubject === s.code;

        return (
          <section
            key={s.code}
            className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]"
          >
            <button
              onClick={() => setOpenSubject(open ? null : s.code)}
              className="w-full px-4 py-3 text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {s.shortName}
                  {s.group === 1 && (
                    <span className="ml-1 text-[10px] font-normal text-[var(--color-warn)]">
                      กลุ่ม 1
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular text-[var(--color-muted)]">
                  {done.length}/{s.chapters.length} บท · {formatMinutes(total)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-track)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>

            {open && (
              <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                {s.chapters.map((c) => (
                  <ChapterRow
                    key={c.chapterId}
                    subjectCode={s.code}
                    chapter={c}
                    los={losByChapter[c.chapterId] ?? []}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ChapterRow({
  chapter,
  los,
}: {
  subjectCode: string;
  chapter: SubjectProgress["chapters"][number];
  los: LosItem[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(chapter.status);
  const [showLos, setShowLos] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = status === "done" ? "todo" : "done";
    setStatus(next);
    setBusy(true);
    await fetch("/api/reading/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chapterId: chapter.chapterId, status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  const overEstimate = chapter.spentMinutes > chapter.estimateMinutes * 1.2;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={busy}
          aria-label={status === "done" ? "ยกเลิกการติ๊ก" : "ติ๊กว่าอ่านจบแล้ว"}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm ${
            status === "done"
              ? "border-[var(--color-good)] bg-[var(--color-good)] text-[var(--color-on-brand)]"
              : "border-[var(--color-line)] bg-[var(--color-input)]"
          }`}
        >
          {status === "done" ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm ${status === "done" ? "text-[var(--color-muted)] line-through" : ""}`}>
            <span className="tabular text-[var(--color-muted)]">บทที่ {chapter.number}</span>{" "}
            {chapter.title}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            <span className="tabular">ประมาณ {formatMinutes(chapter.estimateMinutes)}</span>
            {chapter.spentMinutes > 0 && (
              <span className={`tabular ${overEstimate ? "text-[var(--color-warn)]" : ""}`}>
                อ่านไป {formatMinutes(chapter.spentMinutes)}
              </span>
            )}
            {los.length > 0 && (
              <button onClick={() => setShowLos(!showLos)} className="text-[var(--color-brand)]">
                {showLos ? "ซ่อน" : `หัวข้อย่อย ${los.length}`}
              </button>
            )}
          </div>

          {chapter.revised2569 && (
            <p className="mt-1.5 rounded bg-[var(--color-warn-bg)] px-2 py-1 text-xs text-[var(--color-warn)]">
              บทนี้ถูกแก้ในเอกสารปรับปรุง 1/2569 — อ่านจากฉบับปรับปรุง ไม่ใช่ตำราเดิม
            </p>
          )}

          {showLos && (
            <ol className="mt-2 space-y-1 border-l-2 border-[var(--color-line)] pl-3">
              {los.map((l) => (
                <li key={l.number} className="text-xs text-[var(--color-muted)]">
                  <span className="tabular font-medium">{l.number}</span> {l.text}
                </li>
              ))}
            </ol>
          )}

          <ReadingTimer chapterId={chapter.chapterId} />
        </div>
      </div>
    </li>
  );
}
