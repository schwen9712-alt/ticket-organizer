// ════════════════════════════════════════════════════════════════════
// Ticket Organizer · 解析器测试（自包含：全部样本内嵌，无外部文件依赖）
// 运行：先按下方注释抽取 parser.js，然后 node tests/parse_test.js
// 容器/环境重置后：解包 repo-update.zip 即恢复本文件，无需重建。
// ════════════════════════════════════════════════════════════════════
const fs = require('fs');
const settings = { rate: 7.2 };
const dateGapDays = () => 0;
const _MN3 = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MN2 = _MN3; const _CN_CABIN = {}; const POINTS_TYPES = {}; const toast = () => {};
const CN_CITY_IATA = { '北京首都': 'PEK', '洛杉矶': 'LAX' };
let _parseDebugMode = false; const _parseDebugLog = [];
// parser.js 由跑测者从 index.html 抽取（锚定法）：
//   hs=$(grep -n '^function _ordKey' index.html | cut -d: -f1)
//   end=$(grep -n 'seatCount: _seatCountN };' index.html | tail -1 | cut -d: -f1)
//   sed -n "${hs},$((end+1))p" index.html > /tmp/parser.js
eval(fs.readFileSync(process.env.PARSER_JS || '/tmp/parser.js', 'utf8'));
let fails = 0;
const eq = (n, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.error('✗', n, JSON.stringify(got), '≠', JSON.stringify(want)); } else console.log('✓', n); };
// 本刀主样本：三行 DOCS 变体
const r = parseSingleBooking(`P/EJ1525540/CN/03JUL65/M/26AUG30/ZHANG/YOUHUA/P1
P/US/A62748268/US/14OCT74/F/10JUL35/ZHOU/LIYA/p
P/US/A62788044/US/18dec07/M/15JUL35/ZHANG/SHUKAI/p`);
const P = (nm) => (r.pax || []).find(p => p.name === nm) || {};
eq('S24 缺国籍变体+效期不丢', [P('ZHANG/YOUHUA').dob, P('ZHANG/YOUHUA').passportExpiry, P('ZHANG/YOUHUA').gender], ['03JUL65', '26AUG30', 'MALE']);
eq('S25 小写p尾', [P('ZHOU/LIYA').gender, P('ZHOU/LIYA').dob, P('ZHOU/LIYA').passportExpiry], ['FEMALE', '14OCT74', '10JUL35']);
eq('S26 小写月份规范+全通', [(r.pax||[]).length, P('ZHANG/SHUKAI').dob, (r.unrecognizedLines||[]).length], [3, '18DEC07', 0]);
// 历史抽查：Sabre 星期前缀+跨天标
const sb = parseSingleBooking(`1.  UA152  K   SU25OCT  LAXHKG NN1   1210 1915+1    789      E ----`);
eq('R1 Sabre 跨天回归', [sb.segs.length, sb.segs[0].arrTime, sb.segs[0].date], [1, '1915+1', '25OCT']);
// 历史抽查：斜杠全字段 DOCS + /P1
const fd = parseSingleBooking(`P/CHN/ED0905935/CHN/17SEP82/F/03MAY28/YU/DONGHONG/P1`);
eq('R2 全字段 DOCS 回归', [((fd.pax||[])[0]||{}).name, ((fd.pax||[])[0]||{}).passportExpiry], ['YU/DONGHONG', '03MAY28']);
// 微信聊天记录清洗
const w1 = _wechatClean(`东莞 2026/8/14 10:22
1.  UA153  P   TH24SEP  HKGLAX NN1   1240 1110      789      E ----
东莞: P/CHN/ED0905935/CHN/17SEP82/F/03MAY28/YU/DONGHONG/P1  成人
[图片]
10:25`);
eq('W1 单代理清洗', [w1.agent, w1.stripped >= 3, w1.cleaned.includes('UA153'), w1.cleaned.includes('YU/DONGHONG'), w1.cleaned.includes('东莞')], ['东莞', true, true, true, false]);
const wr = parseSingleBooking(w1.cleaned);
eq('W2 清洗后可解析', [(wr.segs||[]).length, ((wr.pax||[])[0]||{}).name], [1, 'YU/DONGHONG']);
const w3 = _wechatClean(`姓名： LI CHUNXUE
性别：女
姓名： ZHAO XIA
性别：女`);
eq('W3 关键词不误伤', [w3.agent, w3.stripped, w3.cleaned.includes('LI CHUNXUE')], [null, 0, true]);
const w4 = _wechatClean(`东莞: 单一
南京: 单二
东莞: 单三
南京: 单四`);
eq('W4 多说话人不剥前缀', [w4.agent, w4.multi, w4.cleaned.includes('东莞: 单一')], [null, true, true]);
const w5 = _wechatClean(`1.  DL188  D   MO24AUG  ICNATL GK1   1625   1720   359  0 E`);
eq('W5 纯 PNR 零动作', [w5.stripped, w5.cleaned.includes('DL188')], [0, true]);
// UA 英文官网行程
const EN = String.raw`ROUNDTRIP (2 TRAVELERS)
Revise this trip
Shanghai (PVG) PVG to San Francisco SFO
Nov 11 · 1:30 pm to 8:40 am · Nonstop
Show details
Basic Economy
868 kg CO2
San Francisco SFO to Shanghai (PVG) PVG
Dec 2 · 12:55 pm to 6:45 pm · Nonstop
Please note this flight involves a date change
Show details
Basic Economy
1,417 kg CO2
Fare
$2,360.40
2 adults 18+
$1,180.20/person
Taxes and fees
$176.86
Total due
$2,537.26
`;
const en = parseSingleBooking(EN);
eq('E1 两段+跨天警告消费', [(en.segs||[]).length, en.segs[0].arrTime, en.segs[1].arrTime, en.segs[0].depTime, en.segs[1].depTime], [2, '08:40', '18:45+1', '13:30', '12:55']);
eq('E2 舱位回填', [en.segs[0].cls, en.segs[1].cls], ['Basic Economy', 'Basic Economy']);
eq('E3 金额契约(每人化+paxPrices)', [en.rmb, JSON.stringify(en.paxPrices), (en.fareByType||{}).adult, (en.unrecognizedLines||[]).length], [+(2537.26/2*7.2).toFixed(2), JSON.stringify([+(2537.26/2*7.2).toFixed(2), +(2537.26/2*7.2).toFixed(2)]), +(1180.2*7.2).toFixed(2), 0]);
// 订单更改分析
const mk = (names, fl, dt) => ({ passengers: names.map(n => ({ name: n })), segments: [{ flight: fl, date: dt }] });
const A1 = _analyzeAgentChanges(
  [mk(['ZHANG/SAN'], 'UA153', '24SEP'), mk(['LI/SI', 'WANG/WU'], 'DL188', '24AUG')],
  [mk(['zhang/san '], 'ua153', '24sep'), mk(['ZHAO/LIU'], 'CA981', '01OCT'), mk(['LI/SI', 'WANG/WU'], 'DL188', '25AUG')]
);
eq('O1 未见识别+键归一', [A1.missing.length, _ordLine(A1.missing[0]), _ordLine(A1.missing[1])], [2, 'ZHAO/LIU · CA981 01OCT →', 'LI/SI 等2人 · DL188 25AUG →']);
eq('O2 乘客序不敏感', _analyzeAgentChanges([mk(['B/B', 'A/A'], 'UA1', '01JAN')], [mk(['A/A', 'B/B'], 'UA1', '01JAN')]).missing.length, 0);
eq('O3 首段日期改=不同单', _analyzeAgentChanges([mk(['A/A'], 'UA1', '01JAN')], [mk(['A/A'], 'UA1', '02JAN')]).missing.length, 1);
// 乘法算式运价
const FF = parseSingleBooking(String.raw`4.AA1287 G1 SA22AUG MIADFW HK3 1215 1432 E -- 0 
5.AA3889 G1 SA22AUG DFWMTY HK3 1649 1736 E 0 A 
SSR DOCS AA  HK1 P/CN/ER9511300/CN/28APR92/M/21JUN36/CHU/RUNSHI/P1
SSR DOCS AA  HK1 P/CN/EM9807697/CN/30OCT93/F/23JUL34/SUN/CHUANJI/P2
SSR DOCS CA HK1 P/CN/EP1876246/CN/31MAR93/M/16FEB35/JIANG/JIANWEI
普通经济1PC 3807*0.9*3                                                                   
      =10278.9000     
`);
eq('F1 算式=票面3807/人+折扣90入字段', [(FF.segs||[]).length, (FF.pax||[]).length, FF.rmb, FF.discount, JSON.stringify(FF.paxPrices), FF.cabin, (FF.unrecognizedLines||[]).length], [2, 3, 3807, 90, JSON.stringify([3807,3807,3807]), '经济舱', 0]);
const F2 = parseSingleBooking(`公务2PC 12000*0.85`);
eq('F2 舱位前缀+折扣入字段', [F2.rmb, F2.discount], [12000, 85]);
const F3 = parseSingleBooking(`3500*4`);
eq('F3 裸算式每人票面', [F3.rmb, F3.discount || null, (F3.fareByType||{}).adult], [3500, null, 3500]);
// 转机时长
eq('L1 12小时制归一', [_t2min('5:50PM'), _t2min('2:09pm'), _t2min('12:10AM')], [{min:1070,plus:0},{min:849,plus:0},{min:10,plus:0}]);
eq('L2 4位与跨天标', [_t2min('1915+1'), _t2min('0900+1'), _t2min('17:50')], [{min:1155,plus:1},{min:540,plus:1},{min:1070,plus:0}]);
eq('L3 同日转机(Amex样本)', _layoverMinutes({arrTime:'5:50PM',date:'20SEP'},{depTime:'8:55PM',date:'20SEP'}), 185);
eq('L4 跨日转机', _layoverMinutes({arrTime:'23:50',date:'20SEP'},{depTime:'01:30',date:'21SEP'}), 100);
eq('L5 缺数据守卫', [_layoverMinutes({arrTime:'',date:'20SEP'},{depTime:'01:30',date:'21SEP'}), _layoverMinutes(null,null)], [null,null]);
eq('L6 换城断口36天(截图样本)', [_layoverMinutes({arrTime:'12:29PM',date:'14SEP'},{depTime:'12:35PM',date:'20OCT'}), _fmtLayover(51846)], [51846, '36天']);
eq('L7 同城停留天级', _fmtLayover(1440 * 2 + 185), '2天 3h');
process.exit(fails ? 1 : 0);
