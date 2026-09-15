// 变体派生模糊测试（v-EH 制度化）：真样本 × 形态变体，核心结果不变；抓正则对样本的过拟合
// 变体派生模糊测试：对真实样本派生形态变体，核心结果（乘客数/段数/rmb/usd）必须与原样本一致
const fs = require("fs");
const settings = { rate: 7.2 }; const dateGapDays = () => 0;
const _MN3 = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]; const MN2 = _MN3; const _CN_CABIN = {}; const POINTS_TYPES = {}; const toast = () => {}; const CN_CITY_IATA = {};
let _parseDebugMode = false; let _parseDebugLog = [];
eval(fs.readFileSync("/tmp/parser.js", "utf8"));   // run_all 已抽取
// 从 parse_test.js 抽全部 String.raw 样本
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "parse_test.js"), "utf8");
const samples = [...t.matchAll(/const (\w+) = String\.raw`([\s\S]*?)`;/g)].map(m => ({ name: m[1], raw: m[2] }));
const fullToHalf = (s) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48)).replace(/：/g, ":");
const variants = {
  "去序号点": (s) => s.replace(/^(\s*\d{1,2})\.(\s+[A-Z*])/gm, "$1$2"),
  "空格加倍": (s) => s.replace(/ /g, "  "),
  "CRLF": (s) => s.replace(/\n/g, "\r\n"),
  "行尾空格": (s) => s.replace(/\n/g, "   \n"),
  "全角数字时刻": (s) => s.replace(/(\d{2}):(\d{2})/g, (m, a, b) => [...a].map(c => String.fromCharCode(c.charCodeAt(0) + 0xFF10 - 48)).join("") + "：" + [...b].map(c => String.fromCharCode(c.charCodeAt(0) + 0xFF10 - 48)).join("")),
  "航班号小写": (s) => s.replace(/\b([A-Z]{2})(\d{2,4})\b/g, (m, a, n) => a.toLowerCase() + n),
  "首尾空行": (s) => "\n\n" + s + "\n\n",
  "制表符代替多空格": (s) => s.replace(/ {2,}/g, "\t"),
};
const key = (r) => JSON.stringify([(r.pax || []).length, (r.segs || []).length, r.rmb ?? null, r.usd ?? null]);
const P = (raw) => { const b = splitIntoBookings(raw); return b.map(c => parseSingleBooking(c)); };
let total = 0, bad = 0; const byVariant = {}; const badList = [];
for (const { name, raw } of samples) {
  let base; try { base = P(raw).map(key).join("|"); } catch (e) { continue; }
  for (const [vn, fn] of Object.entries(variants)) {
    total++;
    let got; try { got = P(fn(raw)).map(key).join("|"); } catch (e) { got = "💥 " + e.message.slice(0, 40); }
    if (got !== base) { bad++; byVariant[vn] = (byVariant[vn] || 0) + 1; badList.push(`${name} × ${vn}: ${base} → ${got}`); }
  }
}
console.log(`样本 ${samples.length} × 变体 ${Object.keys(variants).length} = ${total} 组合 · 翻车 ${bad}`);
console.log("按变体:", JSON.stringify(byVariant));
badList.slice(0, 40).forEach(l => console.log("  ✗", l));
process.exit(bad ? 1 : 0);
