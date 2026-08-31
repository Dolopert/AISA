import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ปิดชุด
 *
 * โหมด exam: ข้อที่ไม่ได้ตอบนับเป็นผิด ตามกติกาสนามจริง
 * โหมดอื่น: ข้อที่ไม่ได้ตอบไม่ถูกบันทึกเลย เพราะไม่ควรลงโทษการซ้อมที่ทำไม่จบ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { abandoned } = (await request.json().catch(() => ({}))) as { abandoned?: boolean };

  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode, question_ids, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!session) return NextResponse.json({ error: "ไม่พบชุด" }, { status: 404 });
  if (session.status !== "active") return NextResponse.json({ ok: true, already: true });

  if (abandoned) {
    await supabase.from("sessions").update({ status: "abandoned" }).eq("id", id);
    // ทิ้งชุดคือทิ้งจริง ลบคำตอบออกไม่ให้ปนสถิติ
    await supabase.from("attempts").delete().eq("session_id", id);
    return NextResponse.json({ ok: true, abandoned: true });
  }

  if (session.mode === "exam") {
    const questionIds = (session.question_ids ?? []) as string[];
    const { data: done } = await supabase
      .from("attempts")
      .select("ordinal")
      .eq("session_id", id);
    const answered = new Set((done ?? []).map((a) => a.ordinal as number));

    const missing = questionIds
      .map((questionId, i) => ({ questionId, ordinal: i + 1 }))
      .filter((x) => !answered.has(x.ordinal))
      .map((x) => ({
        session_id: id,
        user_id: user.id,
        question_id: x.questionId,
        ordinal: x.ordinal,
        chosen: null,
        is_correct: false,
        seconds: null,
        over_budget: false,
      }));

    if (missing.length > 0) {
      await supabase.from("attempts").insert(missing);
    }
  }

  await supabase
    .from("sessions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
