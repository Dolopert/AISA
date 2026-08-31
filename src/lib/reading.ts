import { chapterMinutes } from "./config";

export type ChapterProgress = {
  chapterId: number;
  number: number;
  title: string;
  revised2569: boolean;
  losCount: number;
  /** เวลาประมาณการที่ต้องใช้ศึกษาบทนี้ (นาที) */
  estimateMinutes: number;
  /** เวลาที่ใช้ไปจริง (นาที) */
  spentMinutes: number;
  status: "todo" | "reading" | "done";
  lastStudiedOn: string | null;
};

export type SubjectProgress = {
  code: string;
  name: string;
  shortName: string;
  group: number;
  weight: number;
  chapters: ChapterProgress[];
};

export type ReadingSummary = {
  chaptersDone: number;
  chaptersTotal: number;
  /** ความคืบหน้าถ่วงน้ำหนักด้วยเวลาประมาณการ ไม่ใช่นับบทดิบ ๆ */
  coverage: number;
  estimateMinutesTotal: number;
  estimateMinutesRemaining: number;
  spentMinutesTotal: number;
};

/**
 * ความคืบหน้าการอ่าน
 *
 * ถ่วงน้ำหนักด้วยเวลาประมาณการ ไม่ใช่นับจำนวนบท เพราะบทที่ 1 ของจรรยาบรรณ
 * (6 LOS ~1.2 ชม.) กับบทงบการเงินที่มี 15 LOS ไม่ควรนับเท่ากัน
 * ถ้านับบทดิบ ๆ คนจะไล่ติ๊กบทสั้น ๆ ให้ตัวเลขวิ่งแล้วเข้าใจผิดว่าใกล้เสร็จ
 */
export function summarise(subjects: SubjectProgress[]): ReadingSummary {
  let estimateTotal = 0;
  let estimateDone = 0;
  let spent = 0;
  let done = 0;
  let total = 0;

  for (const s of subjects) {
    for (const c of s.chapters) {
      total++;
      estimateTotal += c.estimateMinutes;
      spent += c.spentMinutes;
      if (c.status === "done") {
        done++;
        estimateDone += c.estimateMinutes;
      }
    }
  }

  return {
    chaptersDone: done,
    chaptersTotal: total,
    coverage: estimateTotal > 0 ? estimateDone / estimateTotal : 0,
    estimateMinutesTotal: estimateTotal,
    estimateMinutesRemaining: Math.max(0, estimateTotal - estimateDone),
    spentMinutesTotal: spent,
  };
}

/**
 * โควตาการอ่านต่อวัน = เวลาที่เหลือตามแผน ÷ วันที่เหลือ
 *
 * คำนวณใหม่ทุกครั้ง ไม่ใช่ตัวเลขที่ตั้งไว้ตอนต้นแล้วลืม
 * ตามไม่ทันวันนี้ พรุ่งนี้โควตาขึ้นเอง — ให้เห็นราคาของการผัดวันตรง ๆ
 */
export function dailyReadingQuota(remainingMinutes: number, daysLeft: number): number {
  if (daysLeft <= 0) return remainingMinutes;
  return Math.ceil(remainingMinutes / daysLeft);
}

/** เวลาประมาณการของบท คิดจากจำนวน LOS และวิชาที่สังกัด */
export function estimateForChapter(subjectCode: string, losCount: number): number {
  return chapterMinutes(subjectCode, losCount);
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${Math.round(total)} นาที`;
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

/**
 * ความเร็วจริงเทียบกับที่ประมาณไว้
 *
 * > 1 = คุณใช้เวลามากกว่าที่แผนคิดไว้ แปลว่าแผนที่เหลือจะยาวกว่าที่เห็น
 * ใช้เตือนแต่เนิ่น ๆ ไม่ใช่ให้รู้ตอนเหลือสองสัปดาห์
 */
export function paceRatio(subjects: SubjectProgress[]): number | null {
  let estimate = 0;
  let spent = 0;
  for (const s of subjects) {
    for (const c of s.chapters) {
      if (c.status === "done" && c.spentMinutes > 0) {
        estimate += c.estimateMinutes;
        spent += c.spentMinutes;
      }
    }
  }
  if (estimate === 0) return null;
  return spent / estimate;
}
