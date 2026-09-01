import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ยอดอ่านรายวันของเดือนที่ขอ ใช้กับปฏิทินย้อนหลัง
 *
 * อ่านจาก view daily_reading ซึ่งกรอง auth.uid() ในตัวมันเองแล้ว
 * จึงไม่มีทางหลุดข้อมูลของคนอื่นแม้จะส่ง query แปลก ๆ เข้ามา
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "รูปแบบเดือนต้องเป็น YYYY-MM" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const first = `${month}-01`;
  // วันแรกของเดือนถัดไป ใช้เป็นขอบบนแบบไม่รวม
  const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("daily_reading")
    .select("studied_on, minutes, sessions")
    .gte("studied_on", first)
    .lt("studied_on", nextMonth);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const days: Record<string, { minutes: number; sessions: number }> = {};
  for (const row of data ?? []) {
    days[row.studied_on as string] = {
      minutes: Number(row.minutes),
      sessions: Number(row.sessions),
    };
  }

  return NextResponse.json({ month, days });
}
