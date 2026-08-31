import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { timeBudget } from "@/lib/config";

type Body = {
  subjectCode: string;
  label: string;
  /** ผลรายข้อที่ผู้ใช้รายงานเอง true = ถูก */
  results: boolean[];
  /** เวลารวมที่ใช้ทั้งชุด (นาที) — ว่างได้ */
  minutes?: number | null;
};

/**
 * บันทึกผลจากชุดที่ไปทำบนระบบอื่น (Practice Exam ของ ตลท. บน finquizz)
 *
 * ระบบเราไม่เก็บตัวโจทย์ของชุดเหล่านั้น เก็บแค่ผลลัพธ์
 * จึงสร้าง "แถวตัวแทน" ที่มี selectable = false ไว้ผูกสถิติรายวิชาเท่านั้น
 * แถวพวกนี้จะไม่ถูกหยิบไปใส่ชุดซ้อมเด็ดขาด
 *
 * ความถูก/ผิดมาจากที่ผู้ใช้รายงาน ไม่ได้เทียบกับเฉลยในระบบ
 * และเวลาเป็นค่าเฉลี่ยทั้งชุด ไม่ใช่เวลาจริงรายข้อ — ละเอียดน้อยกว่าการทำในแอปนี้
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await request.json()) as Body;
  const count = body.results.length;
  if (count === 0) return NextResponse.json({ error: "ไม่มีผลให้บันทึก" }, { status: 400 });

  // หาชุดตัวแทนของวิชานี้ ถ้ายังไม่มีก็สร้าง (ใช้ซ้ำได้ทุกครั้งที่บันทึก)
  let { data: set } = await supabase
    .from("question_sets")
    .select("id")
    .eq("kind", "external")
    .eq("subject_code", body.subjectCode)
    .maybeSingle();

  if (!set) {
    const created = await supabase
      .from("question_sets")
      .insert({
        name: `Practice Exam ตลท. — ${body.subjectCode}`,
        kind: "external",
        subject_code: body.subjectCode,
        source_note: "finquizz.setgroup.or.th (ต้องล็อกอิน SET Member)",
      })
      .select("id")
      .single();
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
    set = created.data;
  }

  const { data: existing } = await supabase
    .from("questions")
    .select("id, ordinal")
    .eq("set_id", set!.id)
    .order("ordinal");

  const byOrdinal = new Map((existing ?? []).map((q) => [q.ordinal as number, q.id as string]));

  const missing = [];
  for (let i = 1; i <= count; i++) {
    if (!byOrdinal.has(i)) {
      missing.push({
        set_id: set!.id,
        ordinal: i,
        subject_code: body.subjectCode,
        answer: 1, // ไม่มีความหมาย ระบบไม่ได้เทียบเฉลยกับแถวพวกนี้
        selectable: false,
      });
    }
  }
  if (missing.length > 0) {
    const added = await supabase.from("questions").insert(missing).select("id, ordinal");
    if (added.error) return NextResponse.json({ error: added.error.message }, { status: 500 });
    for (const q of added.data ?? []) byOrdinal.set(q.ordinal as number, q.id as string);
  }

  const totalSeconds = body.minutes ? body.minutes * 60 : null;
  const perQuestion = totalSeconds !== null ? totalSeconds / count : null;
  const budget = timeBudget(body.subjectCode);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      mode: "external",
      label: body.label,
      set_id: set!.id,
      subject_code: body.subjectCode,
      question_ids: Array.from({ length: count }, (_, i) => byOrdinal.get(i + 1)),
      question_count: count,
      time_limit_sec: totalSeconds,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  const attempts = body.results.map((ok, i) => ({
    session_id: session.id,
    user_id: user.id,
    question_id: byOrdinal.get(i + 1),
    ordinal: i + 1,
    chosen: null,
    is_correct: ok,
    seconds: perQuestion,
    over_budget: perQuestion !== null && perQuestion > budget,
  }));

  const { error } = await supabase.from("attempts").insert(attempts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: session.id });
}
