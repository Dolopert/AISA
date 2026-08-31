import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * บันทึกการอ่านหนึ่งครั้ง
 *
 * source = timer  มาจากการกดเริ่ม/หยุดจริง
 * source = manual กรอกย้อนหลัง — เก็บแยกเพราะความน่าเชื่อถือต่างกัน
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await request.json()) as {
    chapterId: number | null;
    minutes: number;
    source?: "timer" | "manual";
    studiedOn?: string;
    note?: string;
  };

  const minutes = Math.round(body.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: "เวลาต้องมากกว่า 0 นาที" }, { status: 400 });
  }
  if (minutes > 720) {
    return NextResponse.json({ error: "เกิน 12 ชั่วโมงต่อครั้ง น่าจะกรอกผิด" }, { status: 400 });
  }

  const { error } = await supabase.from("reading_sessions").insert({
    user_id: user.id,
    chapter_id: body.chapterId,
    minutes,
    source: body.source ?? "timer",
    studied_on: body.studiedOn,
    note: body.note,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
