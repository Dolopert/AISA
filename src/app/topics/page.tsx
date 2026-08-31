import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWeakLos, getSubjectStats } from "@/lib/queries";
import { prioritise, pct } from "@/lib/readiness";
import { REVISION_NOTICE } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [weak, stats] = await Promise.all([getWeakLos(user.id, 50), getSubjectStats(user.id)]);
  const notMastered = weak.filter((w) => w.mastery < 1);
  const order = prioritise(stats);

  return (
    <main className="space-y-5">
      <h1 className="text-xl font-bold">จุดอ่อน</h1>

      {notMastered.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-card)] p-5">
          <p className="text-sm text-[var(--color-muted)]">
            ยังไม่มีข้อมูลระดับหัวข้อ — ต้องทำโจทย์ที่ผูกกับ LOS ก่อน ระบบถึงจะชี้จุดได้
            ชุดที่มีแต่เฉลย (ไม่มีตัวโจทย์ในระบบ) จะบอกได้แค่ระดับวิชา
          </p>
          <Link
            href="/practice"
            className="mt-4 inline-block rounded-lg bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-[var(--color-on-brand)]"
          >
            ไปทำโจทย์
          </Link>
        </section>
      ) : (
        <section className="space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            เรียงจากหัวข้อที่แม่นน้อยที่สุด — &quot;แม่น&quot; คือถูกติดกัน 2 ครั้งล่าสุด
            และครั้งล่าสุดอยู่ในงบเวลาของวิชานั้น
          </p>
          {notMastered.map((w) => (
            <article
              key={w.losId}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-[var(--color-muted)]">
                  {w.subjectShort} · บทที่ {w.chapterNumber}
                </span>
                <span className="shrink-0 text-xs tabular text-[var(--color-bad)]">
                  แม่น {w.mastered}/{w.seen}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <strong className="tabular">{w.number}</strong> {w.text}
              </p>
              {w.revised2569 && (
                <p className="mt-2 rounded bg-[var(--color-warn-bg-strong)] p-2 text-xs text-[var(--color-warn)]">
                  บทนี้อยู่ใน {REVISION_NOTICE.label} — อ่านจากฉบับปรับปรุง ไม่ใช่ตำราเดิม
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="mb-2 text-sm font-semibold">ลำดับความสำคัญรายวิชา</h2>
        <ol className="space-y-1.5 text-sm">
          {order.map((p, i) => (
            <li key={p.code} className="flex items-baseline gap-2">
              <span className="w-4 shrink-0 tabular text-[var(--color-muted)]">{i + 1}</span>
              <span className="flex-1">{p.shortName}</span>
              <span className="shrink-0 text-xs text-[var(--color-muted)]">{p.reason}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          ลำดับนี้ถ่วงด้วยสัดส่วนข้อสอบจริงแล้ว วิชาที่อ่อนแต่ออกแค่ {pct(0.03)} ไม่ควรแย่งเวลาจากวิชาที่ออก 17%
        </p>
      </section>
    </main>
  );
}
