import { createClient } from "./supabase/server";
import type { SubjectStat } from "./readiness";
import { DEFAULT_EXAM_DATE } from "./config";

export type Subject = {
  code: string;
  group_no: number;
  group_name: string;
  name: string;
  short_name: string;
  weight: number;
};

export type Settings = {
  exam_date: string;
  target_overall: number;
  target_group1: number;
};

export async function getSubjects(): Promise<Subject[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("code, group_no, group_name, name, short_name, weight")
    .order("sort");
  return data ?? [];
}

export async function getSettings(userId: string): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("exam_date, target_overall, target_group1")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    exam_date: data?.exam_date ?? DEFAULT_EXAM_DATE,
    target_overall: data?.target_overall ?? 0.75,
    target_group1: data?.target_group1 ?? 0.8,
  };
}

/** รวมสถิติรายวิชาของผู้ใช้ วิชาที่ยังไม่เคยทำจะมี answered = 0 */
export async function getSubjectStats(userId: string): Promise<SubjectStat[]> {
  const supabase = await createClient();
  const [subjects, { data: acc }] = await Promise.all([
    getSubjects(),
    supabase
      .from("subject_accuracy")
      .select("subject_code, answered, correct, accuracy, avg_seconds, over_budget_count")
      .eq("user_id", userId),
  ]);

  const byCode = new Map((acc ?? []).map((r) => [r.subject_code as string, r]));

  return subjects.map((s) => {
    const row = byCode.get(s.code);
    return {
      code: s.code,
      shortName: s.short_name,
      group: s.group_no,
      weight: Number(s.weight),
      answered: row ? Number(row.answered) : 0,
      correct: row ? Number(row.correct) : 0,
      accuracy: row && row.accuracy !== null ? Number(row.accuracy) : null,
      avgSeconds: row && row.avg_seconds !== null ? Number(row.avg_seconds) : null,
      overBudgetCount: row ? Number(row.over_budget_count) : 0,
    };
  });
}

export type WeakLos = {
  losId: number;
  number: string;
  text: string;
  chapterNumber: number;
  chapterTitle: string;
  revised2569: boolean;
  subjectCode: string;
  subjectShort: string;
  seen: number;
  mastered: number;
  mastery: number;
};

/** LOS ที่ยังไม่แม่น เรียงจากแย่สุด */
export async function getWeakLos(userId: string, limit = 40): Promise<WeakLos[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("los_mastery")
    .select("los_id, questions_seen, mastered, mastery")
    .eq("user_id", userId)
    .order("mastery", { ascending: true })
    .limit(limit);

  if (!data || data.length === 0) return [];

  const { data: losRows } = await supabase
    .from("los")
    .select("id, number, text, chapters(number, title, revised_2569, subjects(code, short_name))")
    .in(
      "id",
      data.map((r) => r.los_id),
    );

  const meta = new Map((losRows ?? []).map((r) => [r.id as number, r]));

  return data
    .map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = meta.get(r.los_id as number) as any;
      if (!m) return null;
      return {
        losId: r.los_id as number,
        number: m.number as string,
        text: m.text as string,
        chapterNumber: m.chapters?.number as number,
        chapterTitle: m.chapters?.title as string,
        revised2569: Boolean(m.chapters?.revised_2569),
        subjectCode: m.chapters?.subjects?.code as string,
        subjectShort: m.chapters?.subjects?.short_name as string,
        seen: Number(r.questions_seen),
        mastered: Number(r.mastered),
        mastery: Number(r.mastery ?? 0),
      };
    })
    .filter((x): x is WeakLos => x !== null);
}

export type RecentSession = {
  id: string;
  label: string;
  mode: string;
  question_count: number;
  submitted_at: string | null;
  status: string;
  correct: number;
  answered: number;
};

export async function getRecentSessions(userId: string, limit = 8): Promise<RecentSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, label, mode, question_count, submitted_at, status, attempts(is_correct)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((s) => {
    const attempts = (s.attempts ?? []) as { is_correct: boolean }[];
    return {
      id: s.id as string,
      label: s.label as string,
      mode: s.mode as string,
      question_count: s.question_count as number,
      submitted_at: s.submitted_at as string | null,
      status: s.status as string,
      answered: attempts.length,
      correct: attempts.filter((a) => a.is_correct).length,
    };
  });
}
