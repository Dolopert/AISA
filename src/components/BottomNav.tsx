"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/practice", label: "ทำข้อสอบ" },
  { href: "/topics", label: "จุดอ่อน" },
  { href: "/setup", label: "ตั้งค่า" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // ระหว่างทำข้อสอบไม่ควรมีทางออกที่กดพลาดได้ง่าย ๆ ระหว่างจับเวลา
  if (pathname.startsWith("/session/") && !pathname.endsWith("/result")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-[var(--color-line)] bg-[var(--color-card)]">
      <div className="mx-auto flex max-w-3xl">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex-1 py-3 text-center text-sm font-medium ${
                active ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
