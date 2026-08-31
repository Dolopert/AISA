import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubjectStats } from "@/lib/queries";
import { prioritise } from "@/lib/readiness";
import { AVERAGE_SECONDS_PER_QUESTION, timeBudget } from "@/lib/config";

type Body = {
  mode: "exam" | "adaptive" | "custom";
  setId?: string;
  subjectCode?: string | null;
  count?: number;
  minutes?: number | null;
};

/**
 * เวลาของโหมดสนามจริง = สัดส่วนตรงกับข้อสอบจริง (270 นาที / 180 ข้อ)
 * ชุด 100 ข้อได้ 150 นาที · 80 ข้อได้ 120 นาที — ตรงกับช่วงเช้า/บ่ายพอดี
 */
function examSeconds(count: number): number {
  return count * AVERAGE_SECONDS_PER_QUESTION;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await request.json()) as Body;

  let questionIds: string[] = [];
  let label = "";
  let timeLimit: number | null = null;
  let subjectCode: string | null = body.subjectCode ?? null;

  if (body.mode === "exam") {
    if (!body.setId) return NextResponse.json({ error: "ต้องระบุชุดข้อสอบ" }, { status: 400 });

    const { data: set } = await supabase
      .from("question_sets")
      .select("id, name, subject_code")
      .eq("id", body.setId)
      .single();
    if (!set) return NextResponse.json({ error: "ไม่พบชุดข้อสอบ" }, { status: 404 });

    const { data: qs } = await supabase
      .from("questions")
      .select("id")
      .eq("set_id", body.setId)
      .order("ordinal");

    questionIds = (qs ?? []).map((q) => q.id as string);
    label = set.name as string;
    subjectCode = (set.subject_code as string | null) ?? null;
    timeLimit = examSeconds(questionIds.length);
  } else if (body.mode === "adaptive") {
    const count = clamp(body.count ?? 20, 1, 180);
    questionIds = await pickAdaptive(supabase, user.id, count);
    label = `ซ้อมตามจุดอ่อน ${questionIds.length} ข้อ`;
    timeLimit = await estimateBudget(supabase, questionIds);
  } else if (body.mode === "custom") {
    const count = clamp(body.count ?? 20, 1, 180);

    let q = supabase
      .from("questions")
      .select("id")
      .eq("is_holdout", false)
      .eq("selectable", true)
      .limit(count * 4);
    if (subjectCode) q = q.eq("subject_code", subjectCode);

    const { data: pool } = await q;
    questionIds = shuffle((pool ?? []).map((r) => r.id as string)).slice(0, count);
    label = subjectCode ? `ซ้อม ${subjectCode} ${questionIds.length} ข้อ` : `ซ้อม ${questionIds.length} ข้อ`;
    timeLimit = body.minutes ? body.minutes * 60 : await estimateBudget(supabase, questionIds);
  } else {
    return NextResponse.json({ error: "โหมดไม่ถูกต้อง" }, { status: 400 });
  }

  if (questionIds.length === 0) {
    return NextResponse.json(
      { error: "ไม่มีโจทย์ที่ตรงเงื่อนไขในคลัง — นำเข้าโจทย์ก่อน" },
      { status: 409 },
    );
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      mode: body.mode,
      label,
      set_id: body.setId ?? null,
      subject_code: subjectCode,
      question_ids: questionIds,
      question_count: questionIds.length,
      time_limit_sec: timeLimit,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: session.id, questionIds });
}

/**
 * เลือกโจทย์ตามจุดอ่อน
 *
 * ลำดับความสำคัญ: วิชาที่คะแนนห่างเป้ามากที่สุด (ถ่วงด้วยสัดส่วนข้อสอบจริง)
 * แล้วภายในวิชา เอาข้อที่ยังไม่เคยทำก่อน ตามด้วยข้อที่เคยตอบผิด
 * ไม่แตะชุดสำรอง (is_holdout) เด็ดขาด
 */
async function pickAdaptive(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  count: number,
): Promise<string[]> {
  const stats = await getSubjectStats(userId);
  const order = prioritise(stats);

  const { data: answered } = await supabase
    .from("attempts")
    .select("question_id, is_correct")
    .eq("user_id", userId);

  const seen = new Map<string, boolean>();
  for (const a of (answered ?? []) as { question_id: string; is_correct: boolean }[]) {
    // เก็บผลล่าสุดพอ — ถ้าเคยถูกแล้วภายหลัง ให้ถือว่าถูก
    seen.set(a.question_id, a.is_correct || (seen.get(a.question_id) ?? false));
  }

  const picked: string[] = [];

  for (const subject of order) {
    if (picked.length >= count) break;

    const { data: pool } = await supabase
      .from("questions")
      .select("id")
      .eq("subject_code", subject.code)
      .eq("is_holdout", false)
      .eq("selectable", true)
      .limit(400);

    const ids: string[] = shuffle((pool ?? []).map((r: { id: string }) => r.id));
    const fresh = ids.filter((id) => !seen.has(id));
    const wrong = ids.filter((id) => seen.get(id) === false);
    const rest = ids.filter((id) => seen.get(id) === true);

    // จัดสรรตามน้ำหนัก แต่ไม่ให้วิชาเดียวกินทั้งชุด
    const share = Math.max(1, Math.round((count * subject.score) / totalScore(order)));
    for (const id of [...fresh, ...wrong, ...rest]) {
      if (picked.length >= count) break;
      if (picked.filter((p) => ids.includes(p)).length >= share) break;
      picked.push(id);
    }
  }

  return picked.slice(0, count);
}

function totalScore(order: { score: number }[]): number {
  const total = order.reduce((n, o) => n + o.score, 0);
  return total > 0 ? total : 1;
}

/** เวลาที่ควรใช้ = ผลรวมงบเวลาของแต่ละข้อตามวิชาของมัน */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function estimateBudget(supabase: any, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data } = await supabase.from("questions").select("subject_code").in("id", ids);
  return ((data ?? []) as { subject_code: string | null }[]).reduce(
    (sum, q) => sum + timeBudget(q.subject_code),
    0,
  );
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
