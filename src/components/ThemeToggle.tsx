"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "aisa-theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "ตามเครื่อง", light: "สว่าง", dark: "มืด" };
const ICON: Record<Theme, string> = { system: "◑", light: "☀", dark: "☾" };

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  // อ่านค่าปัจจุบันจาก ref ไม่ใช่จาก state ที่ค้างอยู่ใน closure
  // ไม่งั้นการกดรัว ๆ ในเฟรมเดียวจะเห็นค่าเดิมทุกครั้งแล้ววนไม่ขยับ
  const current = useRef<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved && ORDER.includes(saved)) {
        current.current = saved;
        setTheme(saved);
      }
    } catch {
      // localStorage ใช้ไม่ได้ — ใช้ค่าตามเครื่องไปก่อน
    }
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(current.current) + 1) % ORDER.length];
    current.current = next;
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ไม่เป็นไร แค่ไม่จำข้ามครั้ง
    }
  }

  return (
    <button
      onClick={cycle}
      aria-label={`ธีม: ${LABEL[theme]} — กดเพื่อเปลี่ยน`}
      title={`ธีม: ${LABEL[theme]}`}
      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1.5 text-sm text-[var(--color-muted)]"
    >
      {ICON[theme]}
    </button>
  );
}

/**
 * สคริปต์ที่ต้องรันก่อนหน้าจอวาดครั้งแรก
 *
 * ถ้าไม่มีตัวนี้ หน้าจะวาดด้วยธีมเริ่มต้นก่อนแล้วค่อยกระพริบเปลี่ยน
 * ซึ่งบาดตามากในโหมดมืด (ขาวแวบหนึ่งแล้วดำ)
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;
