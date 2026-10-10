// 🚦 运行时冒烟（v-FM）：在 jsdom 里真实启动整页 → 走 parsePNR 主入口建单 → 渲染列表/速览 → 断言 DOM 与零未捕获异常 → 计时
// 与静态审计的区别：这里跑的是真代码路径（启动钩子、持久化、渲染模板），函数存在但运行时炸的问题在这里现形。
// 运行：node tests/runtime_test.js   （依赖 jsdom：npm i jsdom；run_all 在缺依赖时跳过并标注）
const fs = require("fs"); const path = require("path");
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); } catch (e) { console.log("⚠ runtime_test 跳过：未安装 jsdom（npm i jsdom）"); process.exit(0); }
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const FIXED = new Date(2026, 9, 10, 12, 0, 0).getTime();
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { const m = String(e && (e.detail && e.detail.message || e.message) || e); if (/not implemented|canvas|getContext|navigation/i.test(m)) return; errors.push("jsdomError: " + m.slice(0, 160)); });
vc.on("error", (...a) => { const m = a.map(x => String(x && x.message || x)).join(" "); if (/not implemented|canvas|favicon/i.test(m)) return; errors.push("console.error: " + m.slice(0, 160)); });
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://schwen9712-alt.github.io/ticket-organizer/", virtualConsole: vc,
  beforeParse(window) {
    const RD = window.Date;
    window.Date = class extends RD { constructor(...a) { if (!a.length) super(FIXED); else super(...a); } static now() { return FIXED; } };
    window.fetch = () => Promise.reject(new Error("offline"));
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
    window.HTMLCanvasElement.prototype.getContext = () => null;
    window.scrollTo = () => {};
    window.requestAnimationFrame = (f) => setTimeout(f, 0);
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true });
    window.addEventListener("error", (ev) => { const m = String(ev.message || ev.error || ev); if (!/not implemented|canvas/i.test(m)) errors.push("uncaught: " + m.slice(0, 160)); });
    window.addEventListener("unhandledrejection", (ev) => { const m = String(ev.reason && ev.reason.message || ev.reason); if (!/offline|not implemented/i.test(m)) errors.push("unhandledrejection: " + m.slice(0, 160)); });
  }
});
const w = dom.window, d = w.document;
const ST = () => w.eval("STATE");   // 顶层 let/const 不挂 window，经 eval 取
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (n, cond, extra) => { if (cond) console.log("✓", n + (extra ? " · " + extra : "")); else { fails++; console.error("✗", n + (extra ? " · " + extra : "")); } };
const SAMPLES = [
  "第一单   89商务   48391 含税\n1.  UA1967 P   SA19DEC  ORDLAX GK1   1745   2025   753  0 E  1 7\n 2.  UA771  P   SA19DEC  LAXPEK GK1   2335   0635+2 789  0 E  7 3\nSSR DOCS UA HK1 P/USA/643312053/USA/07JAN69/F/13MAY29/GAO/XIAOJIAN/P1",
  " 1.  AA1973 O   FR23OCT  YYCDFW UC1  1254 1741   M 0    E --0\n 2.  AA127  O   SA24OCT  DFWPVG DK1   1205   1650+1 L 0 RE 0 2\nSSR DOCS AA HK1 P/CN/EL4695616/CN/08SEP96/M/05DEC33/LIU/XUAN/P1\n普通经济5211*0.9",
  "9月29日 B6 LAX-BOS 12:46-21:52\nTOTAL USD 408\nSSR DOCS XX HK1  P/CN/ER1356414/CN/01AUG97/M/WANG/WENBO/P1\nSSR DOCS XX HK1  P/CN/EP8170377/CN/01JUN97/F/LI/WENWEN/P2\nSSR DOCS XX HK1  P/CN/A78132530/CN/24FEB26/M/WANG/ADRIAN/P3",
  "1.HUANG/YITAO  男 22NOV64\n 2.  UA889  P   WE28OCT  PEKSFO HK1   1920 1550\n01 PLX0IPTP            22757 CNY\n位置紧张  第一个开 [炸弹]\n----------\n1.HE/WEI  女 08NOV68\n 2.  UA889  P   MO26OCT  PEKSFO HK1   1920 1550\n01 PLX4IPTP            25757 CNY\n第二个开 [炸弹]",
];
(async () => {
  const t0 = Date.now();
  await sleep(300);   // 启动钩子（DOMContentLoaded/load/setTimeout）跑完
  const bootMs = Date.now() - t0;
  ok("页面启动无未捕获异常", errors.length === 0, errors.slice(0, 3).join(" | ") || `${bootMs}ms`);
  { const leaks = [...d.body.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim().slice(0, 20)); const first = d.body.firstElementChild ? d.body.firstElementChild.tagName : ""; ok("页面无属性泄漏（body 无裸文本、首元素非标签残片）", leaks.length === 0 && /^[A-Z]+$/.test(first) && !/^(RECT|PATH|SVG)$/.test(first), leaks.join("|") || first); }
  ok("核心入口存在", ["parsePNR", "renderPendingList", "renderAirlineUsdPanel", "computeFinalPrice", "persistOrdersNow"].every(n => typeof w[n] === "function"));
  ok("标签页标题已初始化", /Ticket Organizer/.test(d.title), d.title);
  // ── 走真实主入口建单 ──
  const before = (ST() && ST().orders || []).length;
  const setField = (id, v) => { const el = d.getElementById(id); if (!el) return; el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); el.dispatchEvent(new w.Event("change", { bubbles: true })); };
  for (const s of SAMPLES) { setField("f-agent", "东莞"); setField("f-tableLabel", "A"); d.getElementById("rawInput").value = s; await w.parsePNR(); await sleep(50); }
  await sleep(200);
  const orders = ST().orders || [];
  ok("parsePNR 入库 5 单（4 段原文，其中一段含两单）", orders.length - before === 5, `now ${orders.length}`);
  ok("入库后无未捕获异常", errors.length === 0, errors.slice(0, 3).join(" | "));
  const uc = orders.find(o => (o.segments || []).some(s => s.status === "UC"));
  ok("UC 段状态落库", !!uc, uc ? uc.segments.map(s => s.flight + ":" + (s.status || "")).join(",") : "无");
  const b6 = orders.find(o => o.airline === "B6");
  const b6per = b6 && ((Array.isArray(b6.paxPrices) && b6.paxPrices[0]) || b6.basePrice);
  ok("美国境内婴儿免费结算（B6 三人：每人价 ×2 人 ×90%，婴儿 0）", b6 && w.computeFinalPrice(b6) === Math.round(b6per * 2 * 0.9), b6 ? `${w.computeFinalPrice(b6)} = ${b6per}×2×90% · paxPrices ${JSON.stringify(b6.paxPrices)}` : "无 B6 单");
  // v-FP 算式后约定成交价 → 每人一口价；段行 D0L39 修复
  {
    setField("f-agent", "季凯"); setField("f-tableLabel", "A");
    d.getElementById("rawInput").value = "1.CAI/CHENGYUN\n2.  D0L39   Z   TH24DEC  LAXPVG DK1   1100 1720+1    SEAME  3 1\n3.  DL068   V1  WE27JAN  TPESEA DK1   1055 0536    SEAME  2--\n4.  DL1628 V1  WE27JAN  SEALAX DK1   0720 1015    SEAME -- 3\n\n护照信息\nEL1032838/CHN/29APR05/M/06SEP33/CAI/CHENGYUN/P1\n\nCO26153*0.9=23537.7=23540";
    await w.parsePNR(); await sleep(100);
    const cai = (ST().orders || []).find(o => (o.passengers || []).some(p => /CAI\/CHENGYUN/.test(p.name || "")));
    ok("约定成交价入库为每人一口价 23540（原价 26153 · 90% 保留）", !!cai && cai.flatPriceMode === true && cai.flatPriceCny === 23540 && cai.flatPricePerPax === true && w.computeFinalPrice(cai) === 23540 && cai.basePrice === 26153 && cai.discount === 90,
      cai ? `flat=${cai.flatPriceMode}/${cai.flatPriceCny}/${cai.flatPricePerPax} final=${w.computeFinalPrice(cai)} base=${cai.basePrice} disc=${cai.discount}` : "无 CAI 单");
    ok("段行 D0L39 修复后三段入库", !!cai && (cai.segments || []).length === 3 && cai.segments[0].flight === "DL39", cai ? cai.segments.map(s => s.flight).join(",") : "无");
  }
  const linked = orders.filter(o => o.ticketOrder);
  ok("显式序号自动关联（第一个开/第二个开）", linked.length === 2 && linked.every(o => (o.linkedOrderIds || []).length === 1), linked.map(o => o.ticketOrder + ":" + (o.linkedOrderIds || []).length).join(" "));
  // ── 渲染 ──
  const t1 = Date.now(); w.renderPendingList(); const renderMs = Date.now() - t1;
  await sleep(100);
  const headers = d.querySelectorAll("#pendingArea .order-collapse-header").length;
  const builtBodies = d.querySelectorAll("#pendingArea .order-card-body[data-built]").length;
  const expanded = d.querySelectorAll("#pendingArea .order-collapse-header.is-expanded").length;
  ok("列表渲染出折叠行（v-FQ 惰性卡体：只有展开的卡才构建 DOM）", headers >= 5 && builtBodies === expanded, `${headers} 行 · 已建卡体 ${builtBodies} = 展开 ${expanded} · ${renderMs}ms`);
  ok("速览行含「⚠ UC 未确认」徽章", /UC 未确认/.test(d.body.innerHTML));
  // 点开含 UC 段的折叠行 → 惰性构建卡体，卡片徽章出现
  {
    const ucHeader = uc && d.querySelector(`#pendingArea .order-collapse-header[data-order-id="${uc.id}"]`);
    if (ucHeader && !ucHeader.classList.contains("is-expanded")) ucHeader.click();
    await sleep(80);
    const body = ucHeader && ucHeader.nextElementSibling;
    ok("点开折叠行后卡体惰性构建且含「⚠ UC 未确认」", !!body && body.dataset.built === "1" && body.style.display !== "none" && /UC 未确认/.test(body.innerHTML) && d.querySelectorAll("#pendingArea .ticket-card").length >= 1,
      body ? `built=${body.dataset.built} display=${body.style.display || "''"} bytes=${body.innerHTML.length}` : "无 UC 行");
    const dupBodies = d.querySelectorAll("#pendingArea .order-card-body[data-built]").length;
    ok("单展开模式：点开一张后其余折叠，已建卡体数不随订单数增长", dupBodies <= 2, `${dupBodies} 份`);
  }
  // 每分钟轻刷（v-FQ）：就地更新时长徽章/倒计时，不整表重建
  {
    const before = d.querySelectorAll("#pendingArea .order-collapse-header").length;
    const bodyBefore = d.querySelector("#pendingArea .order-card-body[data-built]");
    w.tickPendingTimers(); await sleep(30);
    const after = d.querySelectorAll("#pendingArea .order-collapse-header").length;
    ok("每分钟轻刷：行数不变、已建卡体对象未被重建、徽章仍在、无异常", before === after && d.querySelector("#pendingArea .order-card-body[data-built]") === bodyBefore && d.querySelectorAll("#pendingArea .collapse-age").length >= 1 && errors.length === 0, `${before}→${after} 行`);
  }
  const alRow = d.getElementById("airlineFilterRow");
  ok("航司快切行渲染（与代理行同一筛选条）", !!alRow && alRow.closest(".filter-bar") === d.querySelector("#agentSummaryBar .filter-bar") && alRow.querySelectorAll(".fchip").length >= 3, alRow ? alRow.textContent.replace(/\s+/g, " ").trim().slice(0, 60) : "无");
  ok("代理行 chip 类化", d.querySelectorAll("#agentFilterRow .fchip").length >= 2, `${d.querySelectorAll("#agentFilterRow .fchip").length} 个`);
  // ── 代理筛选：克隆一单到「北京」→ 点「北京」chip → 真变量生效、速览只剩该代理 ──
  { const src0 = ST().orders.find(o => o.segments && o.segments.length); const c = JSON.parse(JSON.stringify(src0)); c.id = "rt-bj"; c.agent = "北京"; c.linkedOrderIds = []; c.ticketOrder = null; c.passengers = [{ name: "BEIJING/TEST", dob: "01JAN80", gender: "MALE" }]; ST().orders.push(c); w.renderPendingList(); await sleep(80); }
  const bjChip = [...d.querySelectorAll("#agentFilterRow .fchip")].find(b => b.textContent.includes("北京"));
  ok("代理 chip 渲染含「北京」", !!bjChip);
  if (bjChip) { bjChip.click(); await sleep(80); }
  ok("点「北京」后真变量生效（此前 window.xxx= 赋值从未生效）", w.eval("_usdAgentFilter") === "北京", JSON.stringify(w.eval("_usdAgentFilter")));
  ok("速览仅剩北京的单", d.getElementById("airlineUsdGrid").textContent.includes("BEIJING") && !d.getElementById("airlineUsdGrid").textContent.includes("HUANG"), "");
  [...d.querySelectorAll("#agentFilterRow .fchip")].find(b => /^全部/.test(b.textContent.trim())).click(); await sleep(80);
  ok("点「全部」恢复", w.eval("_usdAgentFilter") === null && d.getElementById("airlineUsdGrid").textContent.includes("HUANG"));
  { const i = ST().orders.findIndex(o => o.id === "rt-bj"); if (i >= 0) ST().orders.splice(i, 1); w.renderPendingList(); await sleep(80); }
  // ── 航司快切：点 UA chip → 列表只剩 UA 分组 ──
  const alRow2 = d.getElementById("airlineFilterRow");
  const uaChip = [...alRow2.querySelectorAll(".fchip")].find(b => /^UA/.test(b.textContent.trim()));
  uaChip.click(); await sleep(50);
  ok("点 UA chip 后真变量生效、chip 高亮、速览无 AA", w.eval("_usdAirlineFilter") === "UA" && d.querySelector("#airlineFilterRow .fchip.is-active").textContent.trim().startsWith("UA") && !d.getElementById("airlineUsdGrid").textContent.includes("LIU/XUAN"), JSON.stringify(w.eval("_usdAirlineFilter")));
  [...d.getElementById("airlineFilterRow").querySelectorAll(".fchip")].find(b => /^全部/.test(b.textContent.trim())).click(); await sleep(50);
  // ── 分组头改航司：点标签 → 弹层 → 点 AA → 全组改 ──
  const alLabel = [...d.querySelectorAll("#airlineUsdGrid span[onclick*='changeAirlineGroup']")].find(s => s.textContent.trim() === "B6");
  ok("分组头航司标签可点", !!alLabel);
  if (alLabel) {
    alLabel.click(); await sleep(50);
    const pop = d.getElementById("alPopover");
    ok("弹层出现且含候选 chip", !!pop && pop.querySelectorAll(".fchip").length >= 5, pop ? `${pop.querySelectorAll(".fchip").length} 候选` : "无");
    const aa = pop && [...pop.querySelectorAll(".fchip")].find(b => b.dataset.al === "AA");
    if (aa) { aa.click(); await sleep(150); }
    ok("B6 组整组改为 AA 且弹层关闭", !ST().orders.some(o => o.airline === "B6") && ST().orders.filter(o => o.airline === "AA").length >= 2 && !d.getElementById("alPopover"), ST().orders.map(o => o.airline).join(","));
  }
  ok("标签页标题带待出票数", /待出票/.test(d.title), d.title);
  ok("渲染后无未捕获异常", errors.length === 0, errors.slice(0, 3).join(" | "));
  // ── 规模：200 单渲染计时（克隆现有单）──
  const base = orders.slice();
  while (ST().orders.length < 200) { for (const o of base) { if (ST().orders.length >= 200) break; const c = JSON.parse(JSON.stringify(o)); c.id = "rt-" + ST().orders.length; c.linkedOrderIds = []; c.ticketOrder = null; ST().orders.push(c); } }
  const t2 = Date.now(); w.renderPendingList(); const render200 = Date.now() - t2;
  const t3 = Date.now(); w.renderAirlineUsdPanel(ST().orders); const panel200 = Date.now() - t3;
  ok("200 单列表渲染 < 3000ms（jsdom 比浏览器慢 3–5×）", render200 < 3000, `${render200}ms`);
  ok("200 单速览渲染 < 1500ms", panel200 < 1500, `${panel200}ms`);
  ok("规模渲染无未捕获异常", errors.length === 0, errors.slice(0, 3).join(" | "));
  // ── 持久化往返 ──
  await w.persistOrdersNow();
  const raw = w.localStorage.getItem("ticket-organizer-pending");
  ok("持久化落盘且含 200 单", !!raw && (JSON.parse(raw).orders || JSON.parse(raw)).length >= 200);
  console.log(`\n${fails ? "✗ 运行时冒烟失败 " + fails : "✓ 运行时冒烟全绿"} · 启动 ${bootMs}ms · 5单渲染 ${renderMs}ms · 200单渲染 ${render200}ms · 速览 ${panel200}ms`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("✗ 运行时冒烟崩溃:", e && e.stack || e); process.exit(1); });
