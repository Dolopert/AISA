import { formatMinutes } from "./reading";

export type PaceState = "no-data" | "done" | "ahead" | "ontrack" | "behind" | "critical";

export type PaceReport = {
  state: PaceState;
  /** นาที/วัน ที่ต้องทำจากนี้ไปถึงวันสอบ */
  requiredPerDay: number;
  /** ค่าเฉลี่ยจริงต่อวันจาก 7 วันล่าสุด (นับวันที่ไม่ได้อ่านเป็น 0 ด้วย) */
  recentPerDay: number | null;
  /** ถ้ารักษาความเร็วนี้ไว้ ต้องใช้อีกกี่วันถึงจะอ่านจบ */
  projectedDays: number | null;
  /** จบช้ากว่าวันสอบกี่วัน (ค่าบวก = ไม่ทัน) */
  daysLate: number | null;
  /** จำนวนวันติดต่อกันที่มีการอ่าน นับย้อนจากวันนี้ */
  streak: number;
  /** ไม่ได้อ่านมากี่วันแล้ว (0 = อ่านวันนี้แล้ว, null = ไม่เคยอ่านเลย) */
  daysSinceLastRead: number | null;
  headline: string;
  detail: string;
};

const WINDOW_DAYS = 7;
/** เว้นเกินกี่วันถึงจะไม่เชื่อค่าเฉลี่ยอีกต่อไป */
const STALE_WARN_DAYS = 3;
const STALE_CRITICAL_DAYS = 5;

/**
 * ประเมินว่าตามแผนทันไหม
 *
 * ไม่ใช้ "ทำได้ตามโควตาวันนี้ไหม" เป็นตัวตัดสิน เพราะโควตาคำนวณใหม่ทุกวัน
 * วันที่ขี้เกียจจะดันโควตาพรุ่งนี้ขึ้นเรื่อย ๆ แล้วตัวเลขก็ยังเขียวอยู่ดี
 * ตัวชี้วัดจริงคือ **ความเร็วจริง 7 วันล่าสุด พาไปถึงเส้นชัยทันวันสอบหรือไม่**
 */
export function assessPace(input: {
  remainingMinutes: number;
  daysLeft: number;
  daily: Map<string, number>;
  today?: Date;
}): PaceReport {
  const { remainingMinutes, daysLeft, daily } = input;
  const today = input.today ?? new Date();

  const requiredPerDay = daysLeft > 0 ? Math.ceil(remainingMinutes / daysLeft) : remainingMinutes;
  const streak = countStreak(daily, today);

  if (remainingMinutes <= 0) {
    return {
      state: "done",
      requiredPerDay: 0,
      recentPerDay: null,
      projectedDays: null,
      daysLate: null,
      streak,
      daysSinceLastRead: daysSinceLastRead(daily, today),
      headline: "อ่านครบทุกบทแล้ว",
      detail: "เหลือแค่ทบทวนและซ้อมข้อสอบ — เอาเวลาที่เหลือไปหาจุดอ่อนแทน",
    };
  }

  // นับ 7 วันล่าสุดรวมวันที่ไม่ได้อ่านด้วย ไม่งั้นคนที่อ่านหนักวันเดียวแล้วหายไป
  // 6 วันจะได้ค่าเฉลี่ยสูงลิ่วซึ่งไม่ตรงความจริง
  let windowMinutes = 0;
  let daysWithData = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const key = dayKey(addDays(today, -i));
    const m = daily.get(key);
    if (m !== undefined) daysWithData++;
    windowMinutes += m ?? 0;
  }

  if (daysWithData === 0) {
    return {
      state: "no-data",
      requiredPerDay,
      recentPerDay: null,
      projectedDays: null,
      daysLate: null,
      streak: 0,
      daysSinceLastRead: daysSinceLastRead(daily, today),
      headline: `ยังไม่มีบันทึกการอ่านใน ${WINDOW_DAYS} วันที่ผ่านมา`,
      detail: `เหลือ ${daysLeft} วัน ต้องอ่านเฉลี่ยวันละ ${formatMinutes(requiredPerDay)} จึงจะครบก่อนสอบ`,
    };
  }

  const recentPerDay = windowMinutes / WINDOW_DAYS;
  const projectedDays = recentPerDay > 0 ? Math.ceil(remainingMinutes / recentPerDay) : null;
  const daysLate = projectedDays === null ? null : projectedDays - daysLeft;

  const ratio = recentPerDay / requiredPerDay;
  const gap = daysSinceLastRead(daily, today);

  // ค่าเฉลี่ย 7 วันหลอกตาได้ ถ้าอ่านรวดเดียวหนัก ๆ แล้วหายไปหลายวัน
  // ตัวเลขจะยังเขียวอยู่ทั้งที่หยุดไปแล้ว — ให้ช่องว่างวันล่าสุดคุมทับ
  if (gap !== null && gap >= STALE_CRITICAL_DAYS) {
    return {
      state: "critical",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: `ไม่ได้อ่านมา ${gap} วัน`,
      detail: `ค่าเฉลี่ยที่เห็นมาจากการอ่านรวดเดียวเมื่อ ${gap} วันก่อน ไม่ใช่จังหวะปัจจุบัน — ต้องกลับมาอ่านวันละ ${formatMinutes(requiredPerDay)}`,
    };
  }

  if (gap !== null && gap >= STALE_WARN_DAYS && ratio >= 0.95) {
    return {
      state: "behind",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: `เว้นไป ${gap} วันแล้ว`,
      detail: `ยอดสะสมยังดูดีเพราะอ่านหนักไว้ก่อนหน้า แต่หยุดนานกว่านี้ตัวเลขจะพลิกเร็วมาก — วันนี้อ่านให้ได้ ${formatMinutes(requiredPerDay)}`,
    };
  }

  if (projectedDays === null) {
    return {
      state: "critical",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: "หยุดอ่านไปแล้ว",
      detail: `ที่ความเร็วนี้จะไม่จบเลย ต้องกลับมาอ่านวันละ ${formatMinutes(requiredPerDay)}`,
    };
  }

  if (ratio >= 1.15) {
    return {
      state: "ahead",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: `เร็วกว่าแผน ${Math.round((ratio - 1) * 100)}%`,
      detail:
        daysLate !== null && daysLate < 0
          ? `ที่ความเร็วนี้จะอ่านจบก่อนสอบ ${Math.abs(daysLate)} วัน — เอาเวลาที่เหลือไปซ้อมข้อสอบได้`
          : "รักษาจังหวะนี้ไว้",
    };
  }

  if (ratio >= 0.95) {
    return {
      state: "ontrack",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: "ตามแผนพอดี",
      detail: `เฉลี่ย ${formatMinutes(Math.round(recentPerDay))}/วัน · ต้องการ ${formatMinutes(requiredPerDay)}/วัน — ไม่มีที่ให้พลาด`,
    };
  }

  const shortfall = Math.ceil(requiredPerDay - recentPerDay);

  if (ratio >= 0.6) {
    return {
      state: "behind",
      requiredPerDay,
      recentPerDay,
      projectedDays,
      daysLate,
      streak,
      daysSinceLastRead: gap,
      headline: `ช้ากว่าแผน ${Math.round((1 - ratio) * 100)}%`,
      detail:
        daysLate !== null && daysLate > 0
          ? `ที่ความเร็วนี้จะอ่านจบช้ากว่าวันสอบ ${daysLate} วัน — ต้องเพิ่มอีกวันละ ${formatMinutes(shortfall)}`
          : `ต้องเพิ่มอีกวันละ ${formatMinutes(shortfall)}`,
    };
  }

  return {
    state: "critical",
    requiredPerDay,
    recentPerDay,
    projectedDays,
    daysLate,
    streak,
    daysSinceLastRead: gap,
    headline: `ช้ากว่าแผนมาก ${Math.round((1 - ratio) * 100)}%`,
    detail:
      daysLate !== null && daysLate > 0
        ? `ที่ความเร็วนี้จะจบช้ากว่าวันสอบ ${daysLate} วัน ถ้าไม่เปลี่ยนอะไร แผนนี้ไม่ทันแน่นอน — เพิ่มเวลา หรือตัดวิชาที่ออกสอบน้อยทิ้ง`
        : `ต้องเพิ่มอีกวันละ ${formatMinutes(shortfall)}`,
  };
}

/** ไม่ได้อ่านมากี่วันแล้ว — null ถ้าไม่มีบันทึกเลยในช่วงที่ดู */
export function daysSinceLastRead(daily: Map<string, number>, today = new Date()): number | null {
  for (let i = 0; i < 400; i++) {
    if ((daily.get(dayKey(addDays(today, -i))) ?? 0) > 0) return i;
  }
  return null;
}

/** จำนวนวันติดต่อกันที่มีการอ่าน — วันนี้ยังไม่อ่านไม่ตัดสตรีค ยังมีเวลาถึงเที่ยงคืน */
export function countStreak(daily: Map<string, number>, today = new Date()): number {
  let streak = 0;
  const start = (daily.get(dayKey(today)) ?? 0) > 0 ? 0 : 1;
  for (let i = start; i < 400; i++) {
    const m = daily.get(dayKey(addDays(today, -i))) ?? 0;
    if (m <= 0) break;
    streak++;
  }
  return streak;
}

export function dayKey(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** จำนวนวันจากวันนี้ถึงวันที่กำหนด */
export function daysFromToday(dateIso: string, today = new Date()): number {
  const a = new Date(dayKey(today) + "T00:00:00");
  const b = new Date(dateIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
