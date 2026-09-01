import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ThemeToggle, { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "AISA Tracker",
  description: "ติดตามความพร้อมสอบ AISA รายหัวข้อและรายเวลา",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#080c14" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // แถบเมนูล่างมีเฉพาะตอนล็อกอินแล้ว ไม่งั้นหน้า login จะมีเมนูที่กดไปไหนไม่ได้
  // getUser() ถูก cache ต่อ request แล้ว หน้าที่ render พร้อมกันจึงใช้ผลเดียวกัน
  // ไม่ยิงซ้ำ
  let signedIn = false;
  try {
    signedIn = Boolean(await getUser());
  } catch {
    signedIn = false;
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* ต้องรันก่อนวาดหน้าจอ ไม่งั้นโหมดมืดจะกระพริบขาวหนึ่งครั้งทุกครั้งที่โหลด */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <div className={`mx-auto max-w-3xl px-4 pt-4 ${signedIn ? "pb-24" : "pb-8"}`}>
          <div className="mb-2 flex justify-end">
            <ThemeToggle />
          </div>
          {children}
        </div>
        {signedIn && <BottomNav />}
      </body>
    </html>
  );
}
