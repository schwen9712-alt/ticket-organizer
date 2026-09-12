// 报表模板端到端：原文 → 建单 → buildInternalCopy / buildClientCopy 文本断言（舱位词/婴儿标注/合计/产品词）
// 运行：node tests/report_test.js（自包含）
// ⏱ 测试时间钉死（v-EA）：婴儿 48 个月、美国境内 <2 岁、"最近未来年"推断都依赖"今天"，不钉死会随日历变红
{
  const FIXED = new Date(2026, 8, 10, 12, 0, 0).getTime();   // 2026-09-10 本地时间
  const _RealDate = Date;
  class PinnedDate extends _RealDate {
    constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
    static now() { return FIXED; }
  }
  globalThis.Date = PinnedDate;
}

const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// 状态机配平：跳过字符串/模板/行注释/块注释内的花括号
const grab = (n) => {
  const i = src.indexOf("function " + n + "("); if (i < 0) throw new Error("missing " + n);
  let p = src.indexOf("(", i), pd = 0; for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let d = 0, k = src.indexOf("{", p), mode = null;
  for (; k < src.length; k++) {
    const c = src[k], nx = src[k + 1];
    if (mode === "line") { if (c === "\n") mode = null; continue; }
    if (mode === "block") { if (c === "*" && nx === "/") { mode = null; k++; } continue; }
    if (mode) { if (c === "\\") { k++; continue; } if (c === mode) mode = null; continue; }
    if (c === "/" && nx === "/") { mode = "line"; k++; continue; }
    if (c === "/" && nx === "*") { mode = "block"; k++; continue; }
    if (c === "'" || c === '"' || c === "`") { mode = c; continue; }
    if (c === "{") d++; else if (c === "}") { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + n);
};
const L = src.split("\n");
const hs2 = L.findIndex(l => /^function _stripTitle/.test(l)); let end2 = -1;
for (let i = L.length - 1; i >= 0; i--) if (/seatCount: _seatCountN };/.test(L[i])) { end2 = i; break; }
globalThis.settings = { rate: 7.2, discountRules: [], fareClassByAirline: {} };
globalThis.dateGapDays = () => 0;
globalThis._MN3 = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
globalThis.MN2 = _MN3; globalThis._CN_CABIN = {}; globalThis.toast = () => {}; globalThis.CN_CITY_IATA = {};
globalThis._parseDebugMode = false; globalThis._parseDebugLog = [];
globalThis.isUSOrigin = () => false; globalThis._paxDobIssues = () => []; globalThis._isSeatTight = () => false;
eval(src.match(/const CABIN_RANK = \{[^}]+\}/)[0].replace("const ", "globalThis."));
eval(src.match(/const CABIN_EN_TO_ZH = \{[^}]+\}/)[0].replace("const ", "globalThis."));
{ const i = src.indexOf("const POINTS_TYPES = {"); let d = 0, k = src.indexOf("{", i); for (; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (d === 0) break; } } eval(src.slice(i, k + 1).replace("const ", "globalThis.") + ";"); }
globalThis.STATE = { fareClassByAirline: { UA: { P: "Business", G: "Economy", W: "Economy" }, AF: {}, AA: { C: "Business" }, DL: { I: "Business", X: "Economy" } }, classMap: {}, orders: [] };
(0, eval)(L.slice(hs2, end2 + 2).join("\n"));
const DEPS = ["newOrder","_isInfantPax","_infantSum","matchDiscountRule","computeFinalPrice","calculateAgeAtFlight","inferCabinFromSegments","_liveCabinZh","_orderCabinWord","_cabinFullName","formatDateCN","isCardPayment","effectiveRate","buildClientCopy","buildInternalCopy"];
for (const n of DEPS) (0, eval)(grab(n));
const defined = new Set([...src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
function withDeps(fn) {   // 自动发现缺失依赖：ReferenceError → grab → 重试（上限 25 轮）
  for (let round = 0; round < 25; round++) {
    try { return fn(); }
    catch (e) {
      const m = /^(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      const name = m[1];
      if (defined.has(name)) { (0, eval)(grab(name)); DEPS.push(name); continue; }
      const ci = src.search(new RegExp("^const " + name + " = ", "m"));
      if (ci >= 0) {   // 常量配平抽取（对象/数组多行）
        const eqi = src.indexOf("=", ci); let k = eqi + 1; while (/\s/.test(src[k])) k++;
        let endk;
        if (src[k] === "{" || src[k] === "[") { const open = src[k], close = open === "{" ? "}" : "]"; let d = 0, mode = null; for (endk = k; endk < src.length; endk++) { const c = src[endk]; if (mode) { if (c === "\\") { endk++; continue; } if (c === mode) mode = null; continue; } if (c === "'" || c === '"' || c === "`") { mode = c; continue; } if (c === open) d++; else if (c === close) { d--; if (d === 0) break; } } }
        else endk = src.indexOf("\n", k) - 1;
        (0, eval)(src.slice(ci, endk + 1).replace(/^const /, "globalThis.").replace(/;\s*$/, "") + ";"); DEPS.push(name + "(常量)"); continue;
      }
      globalThis[name] = () => ""; DEPS.push(name + "(桩)");   // 未知：空桩
    }
  }
  throw new Error("依赖发现超限");
}
const bs = src.indexOf("    const o = newOrder({"), be = src.indexOf("    o.rawPnr = bookingText;", bs);
const buildSlice = src.slice(bs, be);
function buildOrder(raw, ctx) {
  const chunk = splitIntoBookings(raw)[0]; const primary = parseSingleBooking(chunk);
  let { pax, segs, airline, rmb, usd, trip, discount, cabin, paxPrices } = primary;
  const sharedAgent = ctx.agent || "梁", sharedBranch = "", sharedTableLabel = ctx.tableLabel || "A", sharedClient = "", sharedIsTableY = false;
  const effectiveCabin = cabin || "", specialNote = "", proposals = [], isSpecial = false;
  const finalDiscount = discount != null ? discount : null;
  let o; eval(buildSlice.replace("const o = newOrder(", "o = newOrder(")); return o;
}
let fails = 0;
const has = (n, txt, needle) => { const ok = txt.includes(needle); if (!ok) { fails++; console.error("✗", n, "缺", JSON.stringify(needle), "\n---", txt.slice(0, 400)); } else console.log("✓", n); };
const N = String.raw`1.  UA286  P   SU13SEP  ICNEWR DK1   1715   1800   789  0   ----
 2.  UA285  P   MO21SEP  EWRICN DK1   1035   1520+1 789 
成人
FARE  KRW     4300000 EQUIV  CNY  21120
TAX   CNY      38AY CNY     118BP CNY  3320XT
TOTAL CNY   24596
=============================
婴儿
SEL PFK000VP        IN                 NVB14SEP26 NVA13MAR27 1PC
FARE  KRW     430000 EQUIV  CNY  2120
TAX   CNY      38AY CNY     158US CNY  281XT
TOTAL CNY    2597


SSR DOCS UA HK1 P/CN/EM1280219/CN/02NOV72/F/24MAR34/LI/LIQIN/P1
SSR DOCS UA HK1 P/CN/EJ6412705/CN/15JUL98/F/24OCT32/XIANG/YUYI/P2
SSR DOCS UA HK1 P/CN/EQ1269971/CN/05JAN25/M/07JUL30/XIANG/HANTING/P3
SSR DOCS UA HK1 P/CN/EQ1269913/CN/05JAN25/M/07JUL30/ZHAO/HANCHEN/P4
SSR DOCS UA HK1 P/CN/EH0140122/CN/08JUN99/M/21AUG29/ZHAO/YUTAO/P5
`;
const R = String.raw`1.  UA1074 W   FR18SEP  BOSSFO DK1   1134 1457    SEAME  B 3
 01 WAA7AHDN                     2750 CNY        
  P/CN/ER1356414/CN/01AUG97/M/WANG/WENBO/P1
  P/CN/EP8170377/CN/01JUN97/F/LI/WENWEN/P2
  P/CN/A78132530/CN/24FEB26/M/WANG/ADRIAN/P3  婴儿
`;
const O = String.raw`1.  UA772  G   MO12OCT  PEKLAX DK9   1200   0920   789  0 E  3 B
 2.  UA888  G   MO19OCT  SFOPEK DK9   1035   1525+1 777  0 E  I 3
CUI/QIANQIAN     F    28MAR84
ZHANG/ANDING    M     26MAR73
ZHANG/SHUAIBO     M    20FEB92
ZHANG/KAIYAN    F    07JUN01
ZHANG/ZHIMIN     M   08FEB69
ZHANG/HONGLI     F     21OCT77
LI/YAKE    M     24NOV80
LI/QUANLONG    M    06APR93
LI/HONGJU     F   16APR67
WANG/ANQI     F    05NOV93
基础经济7236*0.92*10                                                                 
      =66571.2000
`;
{ const o = buildOrder(N, {}); const t = withDeps(() => buildInternalCopy(o)); has("RP1 婴儿全价标注", t, "婴儿全价"); has("RP2 合计 ¥71,603", t, "71,603"); has("RP3 舱位商务", t, "商务"); }
{ const o = buildOrder(R, {}); const t = withDeps(() => buildInternalCopy(o)); has("RP4 婴儿免费标注", t, "婴儿免费"); has("RP5 合计 ¥4,950", t, "4,950"); }
{ const o = buildOrder(O, {}); const t = withDeps(() => buildInternalCopy(o)); has("RP6 内部复制头基础经济舱", t, "基础经济舱"); has("RP7 十人价 7236×92%", t, "7236"); const c = withDeps(() => buildClientCopy(o)); has("RP8 代理商报表 BASIC ECONOMY", c, "BASIC ECONOMY"); }
const S = String.raw`乘机人： 1.YAN/XIAOYING 2.QIN/JINZHE
1. DL1388  09月29日  罗利 - 底特律  05:34  07:16 
2. DL389  09月29日  底特律 - 上海浦东  11:55  15:25+1 
3. DL068  11月11日  台北桃园 - 西雅图  10:55  05:35 
4. DL489  11月11日  西雅图 - 罗利  15:59  23:55
SSR DOCS DL HK1 P/CN/ER6245546/CN/03SEP55/F/23MAR36/F/YAN/XIAOYING/P1
SSR DOCS DL HK1 P/CN/ER6245545/CN/10JUL51/M/23MAR36/M/QIN/JINZHE/P2 
舱位：I+I+X+X
01 INX0ZNDZ+*          4400.53 USD
`;
{ const o = buildOrder(S, {}); const c = withDeps(() => buildClientCopy(o)); has("RP9 混舱单报表舱位取最高(商务)", c, "商务舱"); has("RP10 USD 单折算人民币", buildInternalCopy(o), "31683.82"); }
const Q = String.raw`9月07日 AF 公务舱 HKG-CDG-LHR
ZHANG/SAN M 01JAN80
TOTAL CNY 12312`;
{ const o = buildOrder(Q, {}); const t = withDeps(() => buildInternalCopy(o)) + withDeps(() => buildClientCopy(o)); has("RP12 速记单报表无 undefined", t.includes("undefined") ? "" : "ok", "ok"); has("RP13 速记单行程行", t, "AF HKG-CDG-LHR"); }
const T = String.raw`GAO/FENG 女 22MAR89
XU/DANNI  女 26AUG96
 1.  UA858  K   MO19OCT  PVGSFO DK1   1210 0835            
 2.  UA5460 K   MO19OCT  SFOPHX DK1   1225 1443     
02 KLX8IHBI            6593 CNY
`;
{ const o = buildOrder(T, {}); const it = withDeps(() => buildItineraryCopy(o)); has("RP14 行程复制 BASIC ECONOMY-K", it, "BASIC ECONOMY-K"); has("RP15 行程复制含两段", it, "UA5460"); }
console.log("依赖:", DEPS.slice(15).join(", ") || "(无额外)");
console.log(fails ? "✗ 报表 e2e 失败 " + fails : "✓ 报表 e2e 全绿");
process.exit(fails ? 1 : 0);
