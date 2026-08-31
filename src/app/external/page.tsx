import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/queries";
import ExternalForm from "@/components/ExternalForm";

export const dynamic = "force-dynamic";

export default async function ExternalPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; count?: string }>;
}) {
  const { subject, count } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const subjects = await getSubjects();

  return (
    <main className="space-y-5">
      <h1 className="text-xl font-bold">บันทึกผลจากภายนอก</h1>
      <p className="text-sm text-[var(--color-muted)]">
        สำหรับชุดที่ไปทำบนระบบอื่น เช่น Practice Exam ของ ตลท. บน finquizz
        ระบบนี้เก็บแค่ผลลัพธ์ ไม่ได้เก็บตัวโจทย์
      </p>

      <ExternalForm
        subjects={subjects.map((s) => ({ code: s.code, shortName: s.short_name }))}
        initialSubject={subject ?? ""}
        initialCount={Number(count) || 25}
      />

      <p className="pb-4 text-xs text-[var(--color-muted)]">
        ข้อมูลจากชุดภายนอกละเอียดน้อยกว่าการทำในแอปนี้ — ผูกได้แค่ระดับวิชา ไม่ถึงระดับ LOS
        และเวลาเป็นค่าเฉลี่ยทั้งชุด ไม่ใช่เวลาจริงรายข้อ
      </p>
    </main>
  );
}
