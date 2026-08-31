import { EXAM, timeBudget } from "./config";

export type SubjectStat = {
  code: string;
  shortName: string;
  group: number;
  weight: number;
  answered: number;
  correct: number;
  accuracy: number | null;
  avgSeconds: number | null;
  overBudgetCount: number;
};

export type Readiness = {
  /** คะแนนคาดการณ์ 0-1 ถ่วงน้ำหนักตามสัดส่วนข้อสอบจริง */
  projected: number;
  /** ความแม่นของกลุ่มวิชาที่ 1 — เกณฑ์แยกที่ทำให้ตกทั้งสนามได้ */
  group1: number | null;
  passesOverall: boolean;
  passesGroup1: boolean;
  passes: boolean;
  /** สัดส่วนของข้อสอบที่ยังไม่มีข้อมูลเลย — ยิ่งสูง ตัวเลขยิ่งเชื่อไม่ได้ */
  uncoveredWeight: number;
  coveredWeight: number;
};

/**
 * คะแนนคาดการณ์ = ผลรวมของ (ความแม่นรายวิชา × สัดส่วนข้อสอบวิชานั้น)
 *
 * วิชาที่ยังไม่เคยทำโจทย์เลยจะไม่ถูกนับเป็น 0 เพราะนั่นจะทำให้ตัวเลข
 * ต่ำจนไร้ความหมายในสัปดาห์แรก แต่จะรายงานเป็น uncoveredWeight แทน
 * เพื่อให้หน้าจอบอกได้ว่า "ตัวเลขนี้อ้างอิงจากข้อสอบที่ครอบคลุมกี่ %"
 */
export function computeReadiness(stats: SubjectStat[]): Readiness {
  let weightedScore = 0;
  let coveredWeight = 0;

  let g1Correct = 0;
  let g1Answered = 0;

  for (const s of stats) {
    if (s.answered > 0 && s.accuracy !== null) {
      weightedScore += s.accuracy * s.weight;
      coveredWeight += s.weight;
    }
    if (s.group === 1) {
      g1Correct += s.correct;
      g1Answered += s.answered;
    }
  }

  const projected = coveredWeight > 0 ? weightedScore / coveredWeight : 0;
  const group1 = g1Answered > 0 ? g1Correct / g1Answered : null;

  const passesOverall = coveredWeight > 0 && projected >= EXAM.passOverall;
  const passesGroup1 = group1 !== null && group1 >= EXAM.passGroup1;

  return {
    projected,
    group1,
    passesOverall,
    passesGroup1,
    passes: passesOverall && passesGroup1,
    coveredWeight,
    uncoveredWeight: Math.max(0, 100 - coveredWeight),
  };
}

/** จำนวนข้อสอบจริงโดยประมาณของวิชานั้น ใช้บอกว่าวิชาไหนคุ้มที่จะลงแรง */
export function questionsInExam(weight: number): number {
  return Math.round((weight / 100) * EXAM.totalQuestions);
}

export type Priority = {
  code: string;
  shortName: string;
  /** ยิ่งสูงยิ่งควรซ้อมก่อน */
  score: number;
  reason: string;
};

/**
 * จัดลำดับว่าควรซ้อมวิชาไหนก่อน
 *
 * แต้ม = (ช่องว่างจากเป้า) × (สัดส่วนข้อสอบ) — วิชาที่อ่อนแต่ออกน้อย
 * ไม่ควรแย่งเวลาไปจากวิชาที่อ่อนพอกันแต่ออก 17% ของข้อสอบ
 *
 * วิชาที่ยังไม่เคยทำเลยได้แต้มสูงเสมอ เพราะ "ไม่รู้ว่าอ่อนหรือไม่" อันตรายกว่า "รู้ว่าอ่อน"
 */
export function prioritise(stats: SubjectStat[], target: number = EXAM.passOverall): Priority[] {
  return stats
    .map((s) => {
      if (s.answered === 0 || s.accuracy === null) {
        return {
          code: s.code,
          shortName: s.shortName,
          score: s.weight * 1.2,
          reason: "ยังไม่เคยทำโจทย์วิชานี้",
        };
      }

      const gap = Math.max(0, target - s.accuracy);
      const slowPenalty = s.answered > 0 ? s.overBudgetCount / s.answered : 0;
      const score = (gap + slowPenalty * 0.3) * s.weight;

      let reason: string;
      if (gap > 0.2) reason = `ความแม่น ${pct(s.accuracy)} ห่างเป้ามาก`;
      else if (gap > 0) reason = `ความแม่น ${pct(s.accuracy)} ยังไม่ถึงเป้า`;
      else if (slowPenalty > 0.3) reason = `ถูกแต่ช้าเกินงบ ${pct(slowPenalty)} ของข้อ`;
      else reason = "อยู่ในเกณฑ์แล้ว";

      // จรรยาบรรณมีเกณฑ์แยก ตกแล้วตกทั้งสนาม — ดันขึ้นเสมอถ้ายังไม่ถึง
      const bonus = s.group === 1 && s.accuracy < EXAM.passGroup1 ? s.weight * 0.5 : 0;

      return { code: s.code, shortName: s.shortName, score: score + bonus, reason };
    })
    .sort((a, b) => b.score - a.score);
}

export function pct(x: number | null): string {
  if (x === null) return "—";
  return `${Math.round(x * 100)}%`;
}

/** จำนวนวันที่เหลือถึงวันสอบ (นับวันนี้เป็น 0) */
export function daysUntil(examDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(examDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * โควตาโจทย์ต่อวัน คำนวณถอยหลังจากวันสอบ
 *
 * ตั้งใจให้ "ปรับให้เองเมื่อตามไม่ทัน" — โควตาคือ งานที่เหลือ ÷ วันที่เหลือ
 * ไม่ใช่ตัวเลขคงที่ที่ตั้งไว้ตอนต้นแล้วไม่มีใครแก้ตามความจริง
 */
export function dailyQuota(remainingQuestions: number, daysLeft: number): number {
  if (daysLeft <= 0) return remainingQuestions;
  return Math.ceil(remainingQuestions / daysLeft);
}

export function isOverBudget(seconds: number | null, subjectCode: string | null): boolean {
  if (seconds === null) return false;
  return seconds > timeBudget(subjectCode);
}
