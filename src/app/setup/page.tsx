import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getSubjectStats } from "@/lib/queries";
import { daysUntil, dailyQuota } from "@/lib/readiness";
import { EXAM_ROUNDS } from "@/lib/config";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [settings, stats] = await Promise.all([getSettings(user.id), getSubjectStats(user.id)]);
  const { count: bankSize } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_holdout", false);

  const answered = stats.reduce((n, s) => n + s.answered, 0);
  const left = daysUntil(settings.exam_date);
  const remaining = Math.max(0, (bankSize ?? 0) - answered);
  const quota = dailyQuota(remaining, left);

  return (
    <main className="space-y-5">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>

      <SettingsForm
        examDate={settings.exam_date}
        targetOverall={settings.target_overall}
        targetGroup1={settings.target_group1}
        rounds={EXAM_ROUNDS.map((r) => ({ label: r.label, date: r.date }))}
      />

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <h2 className="text-sm font-semibold">โควตารายวัน</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          คำนวณถอยหลังจากวันสอบ ไม่ใช่ตัวเลขที่ตั้งไว้ตายตัว — ถ้าวันไหนตามไม่ทัน
          โควตาของวันถัดไปจะขยับขึ้นเอง
        </p>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="เหลือถึงวันสอบ" value={`${left} วัน`} />
          <Row label="โจทย์ในคลัง (ไม่รวมชุดสำรอง)" value={`${bankSize ?? 0} ข้อ`} />
          <Row label="ทำไปแล้ว" value={`${answered} ข้อ`} />
          <Row label="ควรทำวันละ" value={`${quota} ข้อ`} strong />
        </dl>
      </section>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={`tabular ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}
