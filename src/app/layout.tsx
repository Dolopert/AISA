import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "AISA Tracker",
  description: "ติดตามความพร้อมสอบ AISA รายหัวข้อและรายเวลา",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1f5f8b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // แถบเมนูล่างมีเฉพาะตอนล็อกอินแล้ว ไม่งั้นหน้า login จะมีเมนูที่กดไปไหนไม่ได้
  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }

  return (
    <html lang="th">
      <body className="min-h-dvh">
        <div className={`mx-auto max-w-3xl px-4 pt-4 ${signedIn ? "pb-24" : "pb-8"}`}>
          {children}
        </div>
        {signedIn && <BottomNav />}
      </body>
    </html>
  );
}
