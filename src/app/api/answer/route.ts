import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { timeBudget } from "@/lib/config";

type Body = {
  sessionId: string;
  ordinal: number;
  questionId: string;
  chosen: number | null;
  seconds: number;
};

/**
 * บันทึกคำตอบทีละข้อทันทีที่กด ไม่รอจบชุด
 *
 * ตั้งใจให้เป็นแบบนี้เพราะข้อมูลเวลาต่อข้อคือหัวใจของระบบ
 * ถ้าเก็บไว้ในหน่วยความจำแล้วรอ submit ตอนจบ แค่เบราว์เซอร์ปิดกลางคัน
 * ข้อมูลเวลาทั้งชุดก็หายหมด
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await request.json()) as Body;

  const { data: question } = await supabase
    .from("questions")
    .select("id, answer, subject_code")
    .eq("id", body.questionId)
    .single();
  if (!question) return NextResponse.json({ error: "ไม่พบโจทย์" }, { status: 404 });

  const isCorrect = body.chosen !== null && body.chosen === question.answer;
  const overBudget = body.seconds > timeBudget(question.subject_code as string | null);

  const { error } = await supabase.from("attempts").upsert(
    {
      session_id: body.sessionId,
      user_id: user.id,
      question_id: body.questionId,
      ordinal: body.ordinal,
      chosen: body.chosen,
      is_correct: isCorrect,
      seconds: body.seconds,
      over_budget: overBudget,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "session_id,ordinal" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ไม่ส่งเฉลยกลับระหว่างทำ — เฉลยดูได้ตอนจบชุดเท่านั้น
  return NextResponse.json({ ok: true, overBudget });
}
