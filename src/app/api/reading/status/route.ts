import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** ติ๊ก/ยกเลิกติ๊กบท */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { chapterId, status } = (await request.json()) as {
    chapterId: number;
    status: "todo" | "reading" | "done";
  };

  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      chapter_id: chapterId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,chapter_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
