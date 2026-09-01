/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // แยกโฟลเดอร์ build ได้ผ่าน env เพื่อให้การ build ตรวจสอบไม่ไปเขียนทับ .next
  // ของ dev server ที่กำลังรันอยู่ — เคยทำ dev server พังมาแล้วด้วยเหตุนี้
  // (dev server หา chunk เดิมไม่เจอ: Cannot find module './611.js')
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
