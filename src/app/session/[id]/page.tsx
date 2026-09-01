import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import Runner, { type RunnerQuestion } from "@/components/Runner";
import { timeBudget } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode, label, time_limit_sec, question_ids, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!session) redirect("/practice");
  if (session.status !== "active") redirect(`/session/${id}/result`);

  const ids = (session.question_ids ?? []) as string[];
  const { data: rows } = await supabase
    .from("questions")
    .select("id, stem, choices, subject_code, subjects(short_name)")
    .in("id", ids);

  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));

  const questions: RunnerQuestion[] = ids.map((qid, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = byId.get(qid) as any;
    return {
      id: qid,
      ordinal: i + 1,
      stem: r?.stem ?? null,
      choices: (r?.choices as string[] | null) ?? null,
      subjectShort: r?.subjects?.short_name ?? null,
      budget: timeBudget(r?.subject_code ?? null),
    };
  });

  return (
    <Runner
      sessionId={session.id as string}
      mode={session.mode as "exam" | "adaptive" | "custom"}
      label={session.label as string}
      timeLimitSec={session.time_limit_sec as number | null}
      questions={questions}
    />
  );
}
