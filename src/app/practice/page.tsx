import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/queries";
import StartSession, { type SetOption } from "@/components/StartSession";
import { OFFICIAL_PRACTICE_EXAMS } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [subjects, { data: setRows }, { count: bankSize }] = await Promise.all([
    getSubjects(),
    supabase
      .from("question_sets")
      .select("id, name, kind, questions(count)")
      .neq("kind", "external")
      .order("created_at", { ascending: false }),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("selectable", true),
  ]);

  const sets: SetOption[] = (setRows ?? [])
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      kind: s.kind as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: ((s.questions as any)?.[0]?.count as number) ?? 0,
    }))
    .filter((s) => s.count > 0);

  const shortByCode = new Map(subjects.map((s) => [s.code, s.short_name]));

  return (
    <main className="space-y-5">
      <h1 className="text-xl font-bold">ทำข้อสอบ</h1>

      <StartSession
        bankSize={bankSize ?? 0}
        sets={sets}
        subjects={subjects.map((s) => ({ code: s.code, shortName: s.short_name }))}
        initialSubject={subject}
      />

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="text-sm font-semibold">Practice Exam ทางการของ ตลท.</h2>
        <p className="mb-3 mt-0.5 text-xs text-[var(--color-muted)]">
          วิชาละ 25 ข้อ พร้อมเฉลย อยู่บนระบบ finquizz ซึ่งเป็นหน้าตาเดียวกับห้องสอบจริง
          ต้องล็อกอิน SET Member เอง แล้วเอาผลกลับมาบันทึกที่นี่
        </p>
        <ul className="space-y-1.5 text-sm">
          {OFFICIAL_PRACTICE_EXAMS.map((e) => (
            <li key={e.subject} className="flex items-center justify-between gap-3">
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[var(--color-brand)]"
              >
                {shortByCode.get(e.subject) ?? e.subject}
              </a>
              <a
                href={`/external?subject=${e.subject}&count=${e.questions}`}
                className="shrink-0 rounded border border-[var(--color-line)] px-2 py-1 text-xs"
              >
                บันทึกผล
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
