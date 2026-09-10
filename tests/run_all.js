// 一键发货门槛：node tests/run_all.js（任一失败即非零退出）
// 覆盖：parse / e2e / report / consistency + 四审计（语法块·写手·桩泄漏·console/dupFns）+ UI 静态审计 + 兼容性（lookbehind）
const { execSync } = require("child_process");
const fs = require("fs"); const path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
let fails = 0;
const step = (name, fn) => { try { const r = fn(); console.log("✓", name + (r ? " · " + r : "")); } catch (e) { fails++; console.error("✗", name, "\n   ", String(e.message || e).split("\n").slice(0, 6).join("\n    ")); } };
const run = (f) => execSync("node " + JSON.stringify(path.join(__dirname, f)), { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// 抽解析器供 parse_test（它读 /tmp/parser.js）
const L = src.split("\n");
const hs = L.findIndex(l => /^function _nameKey/.test(l)); let end = -1;
for (let i = L.length - 1; i >= 0; i--) if (/seatCount: _seatCountN };/.test(L[i])) { end = i; break; }
fs.writeFileSync("/tmp/parser.js", L.slice(hs, end + 2).join("\n"));

step("parse_test", () => { const out = run("parse_test.js"); const bad = (out.match(/^✗/gm) || []).length; if (bad) throw new Error(out.split("\n").filter(l => l.startsWith("✗")).join("\n")); return (out.match(/^✓/gm) || []).length + " 断言"; });
step("e2e_test", () => { const out = run("e2e_test.js"); if (!/e2e 全绿/.test(out)) throw new Error(out.split("\n").filter(l => l.startsWith("✗")).join("\n")); return (out.match(/^✓/gm) || []).length + " 断言"; });
step("report_test", () => { const out = run("report_test.js"); if (!/报表 e2e 全绿/.test(out)) throw new Error(out.split("\n").filter(l => l.startsWith("✗")).join("\n")); return (out.match(/^✓/gm) || []).length + " 断言"; });
step("consistency_audit", () => run("consistency_audit.js").trim());

step("语法块审计", () => {
  const parts = src.split(/<script[^>]*>/).slice(1).map(s => s.split("</" + "script>")[0]);
  const bad = parts.map((p, i) => { if (!p.trim()) return null; try { new Function(p); return null; } catch (e) { return i; } }).filter(x => x !== null);
  if (bad.length !== 1) throw new Error("语法失败块=" + bad.length + "（预期 1：仅 ES module 块）");
  return "失败块=1（module 误报，预期）";
});
step("持久化写手审计", () => {
  const w = (src.match(/storageSet\('ticket-organizer-pending'/g) || []).length;
  const raw = (src.match(/localStorage\.setItem\('ticket-organizer-pending'/g) || []).length;
  if (w !== 2 || raw !== 1) throw new Error("写手=" + w + " 恢复直写=" + raw + "（预期 2/1）");
  return "写手=2 · 恢复直写=1";
});
step("测试桩泄漏审计", () => {
  const stubs = ["_MN3","MN2","CN_CITY_IATA","_CN_CABIN","_parseDebugLog"]; const leaks = [];
  for (const s of stubs) {
    if (new RegExp("^(const|let|var|function) " + s + "\\b", "m").test(src)) continue;
    for (const t of src.split(/^function /m).slice(1)) { const name = t.split("(")[0].trim(); if (name === "parseSingleBooking") continue; if (new RegExp("\\b" + s + "\\b").test(t.slice(0, t.search(/^}/m)))) leaks.push(s + "←" + name); }
  }
  if (leaks.length) throw new Error(leaks.join(" ")); return "0";
});
step("console.log / 重复函数", () => {
  const js = src.split(/<script[^>]*>/).slice(1).map(x => x.split("</" + "script>")[0]).join("\n");
  const cl = (js.match(/console\.log/g) || []).length;
  const fns = js.match(/function [A-Za-z_$][A-Za-z0-9_$]*/g) || []; const dup = fns.length - new Set(fns).size;
  if (cl || dup) throw new Error("console.log=" + cl + " dupFns=" + dup); return "0 / 0";
});
step("UI 静态审计（死函数引用/重复 id/死 id）", () => {
  const js = src.split(/<script[^>]*>/).slice(1).map(x => x.split("</" + "script>")[0]).join("\n");
  const defs = new Set();
  for (const m of js.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) defs.add(m[1]);
  for (const m of js.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm)) defs.add(m[1]);
  for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defs.add(m[1]);
  const skip = new Set(["if","for","while","switch","return","function","event","document","window","this","confirm","alert","prompt","parseInt","parseFloat","String","Number","Boolean","Array","Object","Math","JSON","setTimeout","clearTimeout","clearInterval","setInterval","encodeURIComponent","navigator","location","console","void","rgba","var","catch","async","await","requestAnimationFrame"]);
  const dead = new Set();
  for (const m of src.matchAll(/on(?:click|input|change|keydown|keyup|submit|blur|focus|dblclick)\s*=\s*"([^"]*)"/g)) for (const c of m[1].matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) { if (!skip.has(c[1]) && !defs.has(c[1])) dead.add(c[1]); }
  const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]).filter(id => !id.includes("${"));
  const cnt = {}; for (const id of ids) cnt[id] = (cnt[id] || 0) + 1; const dup = Object.entries(cnt).filter(([, c]) => c > 1).map(([k]) => k);
  const idSet = new Set(ids); const created = new Set([...js.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
  const missing = new Set(); for (const r of [...js.matchAll(/getElementById\(\s*['"]([^'"$]+)['"]\s*\)/g)].map(m => m[1])) if (!idSet.has(r) && !created.has(r) && !src.includes('id="' + r + '"') && !src.includes("id='" + r + "'") && !src.includes('id=\\"' + r + '\\"')) missing.add(r);
  if (dead.size || dup.length || missing.size) throw new Error("死函数引用=" + [...dead].join(",") + " 重复id=" + dup.join(",") + " 死id=" + [...missing].join(","));
  return "0 / 0 / 0";
});
step("兼容性：lookbehind 正则", () => {
  const js = src.split(/<script[^>]*>/).slice(1).map(x => x.split("</" + "script>")[0]).join("\n").replace(/\/\/[^\n]*/g, "");
  const n = (js.match(/\(\?<[!=]/g) || []).length; if (n) throw new Error(n + " 处（旧 iOS Safari 会整页白屏）"); return "0";
});
console.log(fails ? "\n✗ 门槛未过 " + fails + " 项" : "\n✓ 全部门槛通过 — 可发货");
process.exit(fails ? 1 : 0);
