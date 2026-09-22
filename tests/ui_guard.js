// 功能存在性守卫（v-EQ）：对比当前 index.html 的功能锚与快照——任何"消失"即失败（防功能被粗粒度删除时悄悄带走）
// 用法：node tests/ui_guard.js          → 校验
//       node tests/ui_guard.js --update → 刷新快照（新增功能后显式执行；消失项不会被 --update 静默接受）
const fs = require("fs"); const path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = src.split(/<script[^>]*>/).slice(1).map(x => x.split("</" + "script>")[0]).join("\n");
const cur = {
  functions: [...new Set([...js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))].sort(),
  onclickFns: [...new Set([...src.matchAll(/on(?:click|input|change)\s*=\s*"([^"]*)"/g)].flatMap(m => [...m[1].matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)].map(c => c[1])))].filter(n => !/^(if|for|while|switch|return|event|document|window|this|confirm|alert|prompt|parseInt|parseFloat|String|Number|Boolean|Array|Object|Math|JSON|setTimeout|clearTimeout|clearInterval|setInterval|encodeURIComponent|navigator|location|console|void|rgba|var|catch|async|await|requestAnimationFrame|try)$/.test(n)).sort(),
  ids: [...new Set([...src.matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]))].sort(),
};
const snapPath = path.join(__dirname, "ui_snapshot.json");
if (process.argv.includes("--update")) {
  if (fs.existsSync(snapPath)) {
    const old = JSON.parse(fs.readFileSync(snapPath, "utf8"));
    const gone = Object.keys(old).flatMap(k => (old[k] || []).filter(x => !cur[k].includes(x)).map(x => k + ":" + x));
    if (gone.length) { console.error("✗ 快照更新被拒：以下功能锚已消失，请先确认是有意删除并在 CHANGELOG 记录，再手工从 ui_snapshot.json 移除：\n  " + gone.join("\n  ")); process.exit(1); }
  }
  fs.writeFileSync(snapPath, JSON.stringify(cur, null, 1));
  console.log("✓ 快照已更新：函数 " + cur.functions.length + " · 按钮引用 " + cur.onclickFns.length + " · 元素 id " + cur.ids.length);
  process.exit(0);
}
if (!fs.existsSync(snapPath)) { console.error("✗ 无快照，先执行 node tests/ui_guard.js --update"); process.exit(1); }
const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
let gone = [], added = [];
for (const k of Object.keys(snap)) {
  gone.push(...(snap[k] || []).filter(x => !cur[k].includes(x)).map(x => k + ":" + x));
  added.push(...cur[k].filter(x => !(snap[k] || []).includes(x)).map(x => k + ":" + x));
}
if (gone.length) { console.error("✗ 功能锚消失 " + gone.length + " 项（若为有意删除，先在 CHANGELOG 记录，再手工从快照移除）：\n  " + gone.join("\n  ")); process.exit(1); }
console.log("✓ 功能锚完整（函数 " + snap.functions.length + " · 按钮引用 " + snap.onclickFns.length + " · id " + snap.ids.length + "）" + (added.length ? " · 新增 " + added.length + " 项未入快照，发货前请 --update" : ""));
process.exit(added.length ? 1 : 0);
