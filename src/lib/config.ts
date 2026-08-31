/**
 * ค่าคงที่ของระบบ — แก้ที่นี่ที่เดียว ไม่ต้องแตะโค้ด
 *
 * ตั้งใจให้เป็นข้อมูล "ตายตัว" ไม่ดึงจากเว็บ ตลท. เพราะเปลี่ยนปีละไม่กี่ครั้ง
 * การเขียน scraper ไปดูดข้อมูลที่เปลี่ยนปีละ 4 ครั้งแพงกว่าการแก้ไฟล์นี้
 */

/** รอบทดสอบ AISA — อัปเดตมือเมื่อ ตลท. ประกาศรอบใหม่ */
export const EXAM_ROUNDS = [
  { label: "รอบเดือนพฤศจิกายน 2569", date: "2026-11-14" },
  { label: "รอบเดือนกุมภาพันธ์ 2570", date: "2027-02-13" },
] as const;

export const DEFAULT_EXAM_DATE = EXAM_ROUNDS[0].date;

/** โครงสร้างข้อสอบจริง */
export const EXAM = {
  totalQuestions: 180,
  totalScore: 180,
  passOverall: 0.7,
  /** กลุ่มวิชาที่ 1 (จรรยาบรรณ) ต้องไม่ต่ำกว่า 70% แยกต่างหาก — ตกข้อนี้คือตกทั้งสนาม */
  passGroup1: 0.7,
  sessions: [
    { name: "ช่วงเช้า", questions: 100, minutes: 150 },
    { name: "ช่วงบ่าย", questions: 80, minutes: 120 },
  ],
} as const;

/** เวลาเฉลี่ยจริงในสนาม = (150 + 120) * 60 / 180 */
export const AVERAGE_SECONDS_PER_QUESTION = Math.round(((150 + 120) * 60) / 180); // 90

/**
 * งบเวลาต่อข้อรายวิชา (วินาที)
 *
 * ไม่ใช้ 90 วินาทีเท่ากันหมด เพราะข้อจรรยาบรรณอ่านจบใน 40 วิ
 * ส่วนข้อคำนวณ duration/NPV กด 3 นาทีก็ยังไม่พอ — ถ้าใช้ค่าเดียว
 * ระบบจะขึ้นธง "ช้า" ใส่วิชาคำนวณตลอดเวลาจนธงหมดความหมาย
 *
 * ผลรวมถ่วงน้ำหนักต้องไม่เกิน 90 วิ/ข้อ ไม่งั้นทำไม่ทันในสนามจริง
 */
export const TIME_BUDGET_SECONDS: Record<string, number> = {
  "ETH-STD": 50,
  "ETH-GIPS": 50,
  "ETH-REG": 50,
  INV: 85,
  FSA: 95,
  CF: 100,
  EQ: 92,
  FI: 105,
  DRV: 110,
  MF: 65,
  PM: 88,
};

export const DEFAULT_TIME_BUDGET = AVERAGE_SECONDS_PER_QUESTION;

export function timeBudget(subjectCode: string | null | undefined): number {
  if (!subjectCode) return DEFAULT_TIME_BUDGET;
  return TIME_BUDGET_SECONDS[subjectCode] ?? DEFAULT_TIME_BUDGET;
}

/** กติกา "แม่นแล้ว" — ถูกติดกัน 2 ครั้งล่าสุด และครั้งล่าสุดอยู่ในงบเวลา */
export const MASTERY = {
  consecutiveCorrect: 2,
  requireWithinBudget: true,
} as const;

/** สัดส่วนโจทย์ที่กันไว้เป็นชุดวัดสะอาด ห้ามหยิบมาซ้อม */
export const HOLDOUT_RATIO = 0.2;

/**
 * เอกสารปรับปรุงเนื้อหาครั้งที่ 1/2569 — มีผลตั้งแต่รอบทดสอบ พ.ค. 2569
 * บทเหล่านี้ถูกแก้หลังจาก e-Learning รอบ มี.ค. 2569 เฉลยเก่าอาจใช้ไม่ได้
 */
export const REVISION_NOTICE = {
  label: "ปรับปรุงเนื้อหา ครั้งที่ 1/2569",
  effective: "รอบทดสอบเดือนพฤษภาคม 2569 เป็นต้นไป",
  docs: {
    INV: "Principles-of-Investment-1.pdf",
    CF: "Corporate-Finance-1.pdf",
    EQ: "Equity-Instruments-1.pdf",
    DRV: "Derivative-Instruments-1.pdf",
  } as Record<string, string>,
} as const;

/** ชุด Practice Exam ทางการบน finquizz ของ ตลท. — ไปทำที่นั่นแล้วเอาผลมาบันทึก */
export const OFFICIAL_PRACTICE_EXAMS = [
  { subject: "ETH-STD", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/103?groupAssignmentId=829" },
  { subject: "INV", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/104?groupAssignmentId=833" },
  { subject: "FSA", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/116?groupAssignmentId=861" },
  { subject: "CF", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/118?groupAssignmentId=862" },
  { subject: "EQ", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/119?groupAssignmentId=865" },
  { subject: "FI", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/120?groupAssignmentId=866" },
  { subject: "DRV", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/109?groupAssignmentId=834" },
  { subject: "MF", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/110?groupAssignmentId=836" },
  { subject: "PM", questions: 25, url: "https://finquizz.setgroup.or.th/assessment/111?groupAssignmentId=837" },
] as const;

/**
 * เวลาประมาณการที่ใช้ศึกษา ต่อ 1 วัตถุประสงค์การเรียนรู้ (นาที) แยกตามวิชา
 *
 * ไม่ใช้ค่าเดียวทั้งหมด เพราะ LOS ที่เขียนว่า "อธิบายความหมายของดอกเบี้ย"
 * กับ "คำนวณมูลค่าตราสารหนี้ที่มีออปชันแฝง" ใช้เวลาต่างกันหลายเท่า
 *
 * เวลาของแต่ละบท = จำนวน LOS ในบทนั้น × ค่าตรงนี้
 * เป็นค่าประมาณเพื่อวางแผน ไม่ใช่คำสัญญา — ปรับได้ตามความเร็วจริงของคุณ
 */
export const STUDY_MINUTES_PER_LOS: Record<string, number> = {
  "ETH-STD": 12,
  "ETH-GIPS": 12,
  "ETH-REG": 12,
  INV: 18,
  FSA: 22,
  CF: 22,
  EQ: 20,
  FI: 24,
  DRV: 25,
  MF: 15,
  PM: 18,
};

export const DEFAULT_STUDY_MINUTES_PER_LOS = 18;

export function studyMinutesPerLos(subjectCode: string | null | undefined): number {
  if (!subjectCode) return DEFAULT_STUDY_MINUTES_PER_LOS;
  return STUDY_MINUTES_PER_LOS[subjectCode] ?? DEFAULT_STUDY_MINUTES_PER_LOS;
}

/** เวลาประมาณการของหนึ่งบท (นาที) */
export function chapterMinutes(subjectCode: string, losCount: number): number {
  return losCount * studyMinutesPerLos(subjectCode);
}
