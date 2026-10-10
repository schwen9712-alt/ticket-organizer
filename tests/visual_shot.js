// 视觉门（v-FO）：无头 Chromium 真实加载本地构建 → parsePNR 建样例单（含加急/表 G）→ 截待出票/展开/已出票/CHASE。
// 用法：node tests/visual_shot.js [index.html]   （需 playwright；SHOT_DIR 指定输出目录）
// 不进 run_all：它产出图片供目检，不做断言。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.SHOT_DIR || '/tmp/rt/shots';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(process.argv[2] || '/home/claude/index.html'));
  await page.waitForTimeout(800);
  // seed: load the built-in sample and parse, several times with variations so groups/filters populate
  const seed = await page.evaluate(async () => {
    window._showOrderChangeAnalysis = () => {};
    const out = [];
    const samples = [
      { agent: '东莞', label: 'A', txt: `乘机人：1.ZHANG/WEI MR\n航程：UA877 10月07日(星期三) 旧金山-香港 23:30 05:00\nUA862 10月20日 香港-旧金山 11:00 08:00\n舱位：P+P\n含税：23227元/人` },
      { agent: '季凯', label: 'A', txt: `乘机人：1.LI/XIAOYUE MS 2.WANG/FANG MS\n航程：DL388 11月01日 上海浦东-底特律 10:00 10:31\nDL1230 11月01日 底特律-孟菲斯 17:55 18:55\n舱位：X+X\n含税：13676元/人` },
      { agent: 'ZHAOJIE', label: 'A', txt: `乘机人：1.CHEN/YEYUAN MR\n航程：AA128 12月07日 上海浦东-达拉斯 16:00 15:00\nAA2777 12月07日 达拉斯-拉斯维加斯 18:00 19:00\n舱位：J+J\n含税：36027元/人` },
      { agent: '东莞', label: 'A', txt: `乘机人：1.HOU/MING MR\n航程：UA1924 11月15日 拉斯维加斯-旧金山 08:00 09:40\nUA805 11月15日 旧金山-马尼拉 11:30 17:20\n舱位：Z+Z\n含税：36855元/人` },
      { agent: '东莞', label: 'G', txt: `乘机人：1.SUN/DAN MS 2.SUN/BIJUAN MS\n航程：UA153 11月28日 香港-洛杉矶 11:25 08:05\nUA2741 11月28日 洛杉矶-拉斯维加斯 12:50 14:07\n舱位：S+S\n含税：8938元/人` },
      { agent: '南京', label: 'A', txt: `乘机人：1.GAO/XIAOJIAN MR\n航程：UA131 10月30日 纽瓦克-北京 12:00 14:00\n舱位：J\n含税：60734元/人` },
    ];
    for (const s of samples) {
      try {
        document.getElementById('f-agent').value = s.agent;
        document.getElementById('f-tableLabel').value = s.label;
        const ta = document.getElementById('pnrInput') || document.querySelector('textarea');
        ta.value = s.txt;
        await parsePNR();
        document.querySelectorAll('.verify-modal-overlay, .block-modal-overlay, [class*="modal-overlay"]').forEach(e => e.remove());
        out.push('ok');
      } catch (e) { out.push('ERR ' + e.message); }
    }
    return out;
  });
  console.log('seed', seed.join(','));
  // mark one urgent
  await page.evaluate(() => { if (STATE.orders[2]) { STATE.orders[2].urgent = true; } persistOrdersNow && persistOrdersNow(); });
  const views = [
    ['pending', () => [...document.querySelectorAll('.tab')].find(t => /待出票/.test(t.textContent)).click()],
    ['ticketed', () => [...document.querySelectorAll('.tab')].find(t => /已出票/.test(t.textContent)).click()],
    ['chase', () => [...document.querySelectorAll('.tab')].find(t => /CHASE/.test(t.textContent)).click()],
  ];
  for (const [name, fn] of views) {
    await page.evaluate(fn);
    await page.evaluate(() => document.querySelectorAll('[class*="modal-overlay"]').forEach(e => e.remove()));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    if (name === 'pending') {
      await page.evaluate(() => { const fb = document.getElementById('pendingFilterBar'); if (fb) window.scrollTo(0, fb.getBoundingClientRect().top + window.scrollY - 80); });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/pending-list.png`, fullPage: false });
      // expand first card
      await page.evaluate(() => { const h = document.querySelector('.order-collapse-header'); if (h) h.click(); });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/pending-expanded.png`, fullPage: false });
    }
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
