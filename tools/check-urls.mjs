/**
 * ตรวจว่าโดเมนไหนใช้ได้บ้าง และแต่ละ path ตอบอะไร
 * ใช้ตอนมีคนรายงานว่าเปิดแล้วเจอ not found
 *
 * รัน: node tools/check-urls.mjs
 */

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const hosts = ["https://aisa-nu.vercel.app", "https://aisa.vercel.app"];
const paths = ["/", "/login", "/read", "/setup"];

for (const host of hosts) {
  console.log(host);
  for (const path of paths) {
    for (const [label, ua] of [
      ["มือถือ", MOBILE_UA],
      ["เดสก์ท็อป", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"],
    ]) {
      try {
        const res = await fetch(host + path, {
          redirect: "manual",
          cache: "no-store",
          headers: { "user-agent": ua },
        });
        const loc = res.headers.get("location") ?? "";
        console.log(
          `  ${path.padEnd(8)} ${label.padEnd(10)} ${res.status} ${loc}`.trimEnd(),
        );
      } catch (e) {
        console.log(`  ${path.padEnd(8)} ${label.padEnd(10)} ERROR ${e.message}`);
      }
    }
  }
  console.log("");
}
