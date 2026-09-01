// 端到端：原文 → splitIntoBookings → parseSingleBooking → 页面建单段（真码切片）→ computeFinalPrice
// 运行：node tests/e2e_test.js（自包含：自行从 index.html 抽取，不依赖 /tmp）
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const lines = src.split('\n');
const li = (re) => lines.findIndex(l => re.test(l));
// 解析区
const hs = li(/^function _nameKey/); let end = -1;
for (let i = lines.length - 1; i >= 0; i--) if (/seatCount: _seatCountN };/.test(lines[i])) { end = i; break; }
const parserSrc = lines.slice(hs, end + 2).join('\n');
// 真函数抽取（大括号配平）
const grab = (n) => {
  const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n);
  // 先配平参数括号（默认参数可能含 {}），再从函数体 { 起配平
  let p = src.indexOf('(', i), pd = 0;
  for (; p < src.length; p++) { if (src[p] === '(') pd++; else if (src[p] === ')') { pd--; if (pd === 0) break; } }
  let d = 0;
  for (let k = src.indexOf('{', p); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
};
// 建单段切片（锚定）
const bs = src.indexOf('    const o = newOrder({');
const be = src.indexOf('    o.rawPnr = bookingText;', bs);
if (bs < 0 || be < 0) throw new Error('build slice anchors missing');
const buildSlice = src.slice(bs, be);

// 桩
globalThis.settings = { rate: 7.2, discountRules: [], fareClassByAirline: {} };
globalThis.dateGapDays = () => 0;
globalThis._MN3 = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
globalThis.MN2 = _MN3; globalThis._CN_CABIN = {}; globalThis.POINTS_TYPES = {}; globalThis.toast = () => {};
globalThis.CN_CITY_IATA = {};
globalThis._parseDebugMode = false; globalThis._parseDebugLog = [];
globalThis.isUSOrigin = () => false;
globalThis._paxDobIssues = () => []; globalThis._isSeatTight = () => false;
eval(parserSrc);
for (const n of ['newOrder','_isInfantPax','_infantSum','matchDiscountRule','computeFinalPrice','calculateAgeAtFlight']) eval(grab(n));

function buildOrder(raw, ctx) {
  const chunk = splitIntoBookings(raw)[0];
  const primary = parseSingleBooking(chunk);
  let { pax, segs, airline, rmb, usd, trip, discount, cabin, paxPrices } = primary;
  const sharedAgent = ctx.agent || '梁', sharedBranch = '', sharedTableLabel = ctx.tableLabel || 'A', sharedClient = '', sharedIsTableY = false;
  const effectiveCabin = cabin || '', specialNote = '', proposals = [], isSpecial = false;
  const finalDiscount = discount != null ? discount : null;
  let o;
  eval(buildSlice.replace('const o = newOrder(', 'o = newOrder('));   // eval 内 const 不泄漏，改赋外层 let
  return { o, primary };
}
let fails = 0;
const eq = (n, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.error('✗', n, JSON.stringify(got), '≠', JSON.stringify(want)); } else console.log('✓', n); };

// 样本 N：3 成人 + 2 婴儿（KRW EQUIV 块，类型词前置）
const N = `1.  UA286  P   SU13SEP  ICNEWR DK1   1715   1800   789  0   ----
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
SSR DOCS UA HK1 P/CN/EH0140122/CN/08JUN99/M/21AUG29/ZHAO/YUTAO/P5`;
{
  const { o } = buildOrder(N, {});
  eq('E1 落库 basePrice=成人每人(非 EQUIV 21120)', o.basePrice, 24596);
  eq('E2 落库 paxPrices 五份分档', o.paxPrices, [24596, 24596, 2597, 2597, 24596]);
  eq('E3 落库 discount 默认90', o.discount, 90);
  eq('E4 落库 rmb=成人×3×90%+婴儿全价×2', o.rmb, +((24596 * 3 * 0.9) + 2597 * 2).toFixed(2));
  eq('E5 卡片最终价 computeFinalPrice', computeFinalPrice(o), Math.round(24596 * 3 * 0.9 + 2597 * 2));
}
// 样本 K：1 成人 + 2 儿童（商务9折）
const K = `第2单 商务9折
1. *AA8439 C   SU03JAN  KIXLAX DK1   1800 1120   M 0  R E 1 B  OP-JL60
大
SSR DOCS 航司 HK1 P/USA/567850673/USA/20NOV88/M/29JAN30/HOU/QIAN/P1
小
SSR DOCS 航司 HK1 P/USA/A12260348/USA/22DEC22/M/10MAR28/HOU/LENNOX/P1
SSR DOCS 航司 HK1 P/USA/A46136069/USA/07SEP19/F/18AUG29/HOU/LEXI/P1
大   
FARE  JPY 870000   EQUIV CNY 36570                                              
TAX   CNY 14OI   CNY 140SW   CNY 2510 XT                                        
TOTAL CNY 39234
小
FARE  JPY 652500   EQUIV CNY 27430                                              
TAX   CNY 14OI   CNY 70SW   CNY 2510 XT                                         
TOTAL CNY 30024`;
{
  const { o } = buildOrder(K, {});
  eq('E6 儿童单 paxPrices', o.paxPrices, [39234, 30024, 30024]);
  eq('E7 儿童不豁免折扣 fp', computeFinalPrice(o), Math.round((39234 + 30024 * 2) * 0.9));
}
// 样本 G：3 成人 + 1 婴儿（TOTAL 分型每人）
const G = `1.YU/LIQIN 2.SUN/BINGBING 3.ZHOU/YU 4.LIU/RENRAN（婴儿）
 5.  UA198  P   TH03SEP  LAXPVG DK4   1315   1745+1 789  0   ----
护照信息
CN/EP8310307/CN/27DEC63/F/22JUL35/YU/LIQIN/P1
CN/EN7495183/CN/15SEP60/F/12DEC34/SUN/BINGBING/P2
CN/EJ4427430/CN/07NOV86/M/17MAR32/ZHOU/YU/P3
婴儿
US/A82599381/US/26JUL26/19AUG31/LIU/RENRAN/P1


TOTAL  成人 CNY 20591
TOTAL 婴儿 CNY 2176`;
{
  const { o } = buildOrder(G, {});
  eq('E8 婴儿单 fp=成人×3×90%+婴儿全价', computeFinalPrice(o), Math.round(20591 * 3 * 0.9 + 2176));
}
console.log(fails ? `\n✗ e2e 失败 ${fails}` : '\n✓ e2e 全绿');
process.exit(fails ? 1 : 0);
