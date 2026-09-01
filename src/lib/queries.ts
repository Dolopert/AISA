import { createClient } from "./supabase/server";
import type { SubjectStat } from "./readiness";
import { DEFAULT_EXAM_DATE } from "./config";
import { estimateForChapter, type SubjectProgress } from "./reading";

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


/**
 * หลักสูตร (subjects / chapters / los) เป็นข้อมูล seed ที่เปลี่ยนปีละครั้ง
 * แต่เดิมถูกอ่านใหม่จาก DB ทุกครั้งที่เปลี่ยนหน้า — รวมถึง los ทั้ง 515 แถว
 * จำไว้ในหน่วยความจำของ process ตาม TTL ตัด round-trip ออกจากเส้นทางวิกฤต
 *
 * RLS ให้ผู้ใช้ที่ล็อกอินทุกคนเห็นข้อมูลชุดเดียวกัน (using (true)) แชร์แคชได้
 */
const CURRICULUM_TTL_MS = 10 * 60_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function cachedCurriculum<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CURRICULUM_TTL_MS) return hit.value as Promise<T>;

  const value = load()
    .then((v) => {
      // RLS ตอบกลับเป็นว่างเปล่าถ้า request ไม่มี session — อย่าจำผลนั้นไว้ 10 นาที
      const empty = Array.isArray(v) ? v.length === 0 : v instanceof Map && v.size === 0;
      if (empty) memo.delete(key);
      return v;
    })
    .catch((err) => {
      memo.delete(key); // อย่าจำความล้มเหลวไว้ 10 นาที
      throw err;
    });
  memo.set(key, { at: Date.now(), value });
  return value;
}

export async function getSubjects(): Promise<Subject[]> {
  return cachedCurriculum("subjects", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subjects")
      .select("code, group_no, group_name, name, short_name, weight")
      .order("sort");
    return data ?? [];
  });
}

type ChapterRow = {
  id: number;
  subject_code: string;
  number: number;
  title: string | null;
  revised_2569: boolean | null;
  losCount: number;
};

/** บททั้งหลักสูตรพร้อมจำนวน LOS ต่อบท */
async function getChapters(): Promise<ChapterRow[]> {
  return cachedCurriculum("chapters", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chapters")
      .select("id, subject_code, number, title, revised_2569, los(count)")
      .order("subject_code")
      .order("number");
    return (data ?? []).map((c) => ({
      id: c.id as number,
      subject_code: c.subject_code as string,
      number: c.number as number,
      title: c.title as string | null,
      revised_2569: c.revised_2569 as boolean | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCount: ((c.los as any)?.[0]?.count as number) ?? 0,
    }));
  });
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

/** โครงการอ่านทั้งหลักสูตร พร้อมสถานะและเวลาที่ใช้ไปของผู้ใช้คนนี้ */
export async function getReadingPlan(userId: string): Promise<SubjectProgress[]> {
  const supabase = await createClient();

  const [subjects, chapters, { data: progress }, { data: spent }] = await Promise.all([
    getSubjects(),
    getChapters(),
    supabase.from("reading_progress").select("chapter_id, status").eq("user_id", userId),
    supabase.from("chapter_minutes_spent").select("chapter_id, minutes, last_studied_on"),
  ]);

  const statusByChapter = new Map(
    (progress ?? []).map((r) => [r.chapter_id as number, r.status as string]),
  );
  const spentByChapter = new Map(
    (spent ?? []).map((r) => [
      r.chapter_id as number,
      { minutes: Number(r.minutes ?? 0), last: (r.last_studied_on as string | null) ?? null },
    ]),
  );

  return subjects.map((s) => ({
    code: s.code,
    name: s.name,
    shortName: s.short_name,
    group: s.group_no,
    weight: Number(s.weight),
    chapters: chapters
      .filter((c) => c.subject_code === s.code)
      .map((c) => {
        const losCount = c.losCount;
        const id = c.id;
        const used = spentByChapter.get(id);
        return {
          chapterId: id,
          number: c.number,
          title: c.title || `บทที่ ${c.number}`,
          revised2569: Boolean(c.revised_2569),
          losCount,
          estimateMinutes: estimateForChapter(s.code, losCount),
          spentMinutes: used?.minutes ?? 0,
          status: (statusByChapter.get(id) as "todo" | "reading" | "done") ?? "todo",
          lastStudiedOn: used?.last ?? null,
        };
      }),
  }));
}

export type LosItem = { number: string; text: string };

/**
 * หัวข้อย่อยของทุกบท ใช้แสดงว่าบทนั้นครอบคลุมอะไรบ้าง
 *
 * เดิมส่ง chapterIds เข้าไปกรอง แต่หน้า /read ขอครบทุกบทอยู่แล้ว และ id
 * ต้องรอ getReadingPlan ก่อน กลายเป็น waterfall — อ่านทั้งก้อนทีเดียวแล้วแคช
 * ยิงขนานกับ query ของผู้ใช้ได้เลย
 */
export async function getAllLos(): Promise<Map<number, LosItem[]>> {
  return cachedCurriculum("los", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("los")
      .select("chapter_id, number, text")
      .order("number");

    const map = new Map<number, LosItem[]>();
    for (const row of data ?? []) {
      const id = row.chapter_id as number;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push({ number: row.number as string, text: row.text as string });
    }
    return map;
  });
}

/** นาทีที่อ่านไปในแต่ละวัน ย้อนหลัง n วัน */
export async function getDailyReading(days = 14): Promise<Map<string, number>> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_reading")
    .select("studied_on, minutes")
    .gte("studied_on", since)
    .order("studied_on", { ascending: false });

  return new Map((data ?? []).map((r) => [r.studied_on as string, Number(r.minutes)]));
}
