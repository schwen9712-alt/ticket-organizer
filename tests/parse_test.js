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
let _parseDebugMode = false; let _parseDebugLog = [];
// parser.js 由跑测者从 index.html 抽取（锚定法）：
//   hs=$(grep -n '^function _nameKey' index.html | cut -d: -f1)   # v-CW 起解析区首函数为 _nameKey
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
// MCT 判级
eq('M1 SFO国内转国际偏紧(截图样本)', _mctCheck({from:'LAX',to:'SFO'},{from:'SFO',to:'ICN'},67), {level:'tight',mct:60});
eq('M2 低于参考线风险', _mctCheck({from:'LAX',to:'SFO'},{from:'SFO',to:'ICN'},45), {level:'risk',mct:60});
eq('M3 亚洲枢纽宽裕与未知机场', [_mctCheck({from:'PVG',to:'HKG'},{from:'HKG',to:'JFK'},90), _mctCheck({from:'A',to:'XXX'},{from:'XXX',to:'B'},30)], [null, null]);
eq('M4 国际入境含入关口径', _mctCheck({from:'ICN',to:'SFO'},{from:'SFO',to:'DEN'},95), {level:'risk',mct:105});
// 调试模式 DOM 守卫
_parseDebugMode = true;
const _dr = parseSingleBooking('运价 6417');
eq('D1 调试模式无DOM环境安全', [typeof _dr, _dr.rmb], ['object', 6417]);
_parseDebugMode = false;
// UA 英文官网粘连形态
const EN2 = String.raw`San Francisco SFO to Hong Kong (HKG) HKG
Oct 2Friday, October 21:25 PM to 6:55 PMNonstop
alertPlease note this flight involves a date change
Show details
2,185 kg CO2Carbon emissions estimate: 2,185 kilograms.Learn more about carbon emissions
Flight 2 of 2
Osaka KIX to San Francisco SFO
Oct 13Tuesday, October 134:55 PM to 11:00 AMNonstop
Show details
1,364 kg CO2Carbon emissions estimate: 1,364 kilograms.Learn more about carbon emissions
Price breakdown
Fare
$8,973.00
3 adults 18+
$2,991.00/person
Taxes and fees
$350.19
Total due
$9,323.19
`;
const e2 = parseSingleBooking(EN2);
eq('N1 粘连日期两段落座', [(e2.segs||[]).length, e2.segs[0].from, e2.segs[0].to, e2.segs[0].date, e2.segs[0].depTime, e2.segs[0].arrTime], [2, 'SFO', 'HKG', '02OCT', '13:25', '18:55+1']);
eq('N2 第二段与人数', [e2.segs[1].from, e2.segs[1].to, e2.segs[1].date, e2.segs[1].depTime, e2.segs[1].arrTime], ['KIX', 'SFO', '13OCT', '16:55', '11:00']);
eq('N3 每人化契约+清零', [e2.rmb, JSON.stringify(e2.paxPrices), (e2.fareByType||{}).adult, (e2.unrecognizedLines||[]).length], [+(9323.19/3*7.2).toFixed(2), JSON.stringify([+(9323.19/3*7.2).toFixed(2), +(9323.19/3*7.2).toFixed(2), +(9323.19/3*7.2).toFixed(2)]), +(2991*7.2).toFixed(2), 0]);
// UA 中文详情分行版
const CN2 = String.raw`旧金山SFO至香港(HKG)HKG
10月2日·下午1:25至下午6:55·直飞
请注意，本航班涉及日期变更
时长:14小时30分钟
旅客:1
航班号:UA869
飞机类型:Boeing 777-300ER
每个座位类型的排放:732千克二氧化碳
^ 隐藏详细信息
大阪KIX至旧金山SFO
10月13日·下午4:55至上午11:00·直飞
时长:10小时5分钟
旅客:1
航班号:UA34
飞机类型:Boeing777-200
每个座位类型的排放:457千克二氧化碳
TOTAL USD 9,323.19
`;
const c2 = parseSingleBooking(CN2);
eq('C1 中文分行两段+航班号+悬挂变更', [(c2.segs||[]).length, c2.segs[0].flight, c2.segs[0].arrTime, c2.segs[1].flight, c2.segs[1].date], [2, 'UA869', '18:55+1', 'UA34', '13OCT']);
eq('C2 TOTAL USD+单人+清零', [c2.rmb, c2.usd, (c2.unrecognizedLines||[]).length], [+(9323.19*7.2).toFixed(2), 9323.19, 0]);
// 婴儿名单+双日期 DOCS+TOTAL 分型
const GS = String.raw`1.YU/LIQIN 2.SUN/BINGBING 3.ZHOU/YU 4.LIU/RENRAN（婴儿）
 5.  UA198  P   TH03SEP  LAXPVG DK4   1315   1745+1 789  0   ----
 6.  UA810  R   SU15NOV  MNLSFO DK4   2325   2000   77W  0   ----
 7.  UA580  B   SU15NOV  SFOLAX DK4   2120   2255   738  0   ----
护照信息
CN/EP8310307/CN/27DEC63/F/22JUL35/YU/LIQIN/P1
CN/EN7495183/CN/15SEP60/F/12DEC34/SUN/BINGBING/P2
CN/EJ4427430/CN/07NOV86/M/17MAR32/ZHOU/YU/P3
婴儿
US/A82599381/US/26JUL26/19AUG31/LIU/RENRAN/P1


TOTAL  成人 CNY 20591
TOTAL 婴儿 CNY 2176
`;
const _gb = splitIntoBookings(GS);
eq('G0 分单不裂(多行版)', _gb.length, 1);
const g1 = parseSingleBooking(_gb[0]);
eq('G1 四乘客型别与婴儿双日期', (g1.pax||[]).map(p=>[p.name,p.forcedType||null,p.dob,p.passportExpiry||null]), [['YU/LIQIN',null,'27DEC63','22JUL35'],['SUN/BINGBING',null,'15SEP60','12DEC34'],['ZHOU/YU',null,'07NOV86','17MAR32'],['LIU/RENRAN','INFANT','26JUL26','19AUG31']]);
eq('G2 三段+TOTAL每人价直存+清零', [(g1.segs||[]).length, g1.rmb, (g1.fareByType||{}).adult, (g1.fareByType||{}).infant, JSON.stringify(g1.paxPrices), (g1.unrecognizedLines||[]).length], [3, 20591, 20591, 2176, JSON.stringify([20591,20591,20591,2176]), 0]);
// 单行粘连版（微信压行）
const GS2 = String.raw`1.YU/LIQIN 2.SUN/BINGBING 3.ZHOU/YU 4.LIU/RENRAN（婴儿）  5.  UA198  P   TH03SEP  LAXPVG DK4   1315   1745+1 789  0   ----  6.  UA810  R   SU15NOV  MNLSFO DK4   2325   2000   77W  0   ----  7.  UA580  B   SU15NOV  SFOLAX DK4   2120   2255   738  0   ---- 护照信息 CN/EP8310307/CN/27DEC63/F/22JUL35/YU/LIQIN/P1 CN/EN7495183/CN/15SEP60/F/12DEC34/SUN/BINGBING/P2 CN/EJ4427430/CN/07NOV86/M/17MAR32/ZHOU/YU/P3 婴儿 US/A82599381/US/26JUL26/19AUG31/LIU/RENRAN/P1
TOTAL  成人 CNY 20591 TOTAL 婴儿 CNY 2176
`;
const _gb2 = splitIntoBookings(GS2);
eq('G0b 分单不裂(粘连版)', _gb2.length, 1);
const g2r = parseSingleBooking(_gb2[0]);
eq('G3 单行粘连版等价多行版', [(g2r.segs||[]).length, (g2r.pax||[]).length, g2r.rmb, JSON.stringify(g2r.fareByType), (g2r.unrecognizedLines||[]).length], [3, 4, 20591, JSON.stringify({adult:20591,infant:2176}), 0]);
// Sabre FARE/TAX/TOTAL 运价块 + 分组头 + NM 粘连名单
const HS = String.raw`1.  UA889  P   MO24AUG  PEKSFO DK1   1725   1420   777  0   ----
 2.  UA1141 P   MO24AUG  SFOEWR DK1   2235   0706+1 777  0   ----
 3.  UA131  P   WE02SEP  EWRHND DK1   1030   1335+1 777  0   ----
 4.  NH963  P   TH03SEP  HNDPEK DK1   1715   2015   788  0 E  3 3
FARE  CNY     37280                  
TAX   CNY      76AY CNY      90CN CNY  5236XT
TOTAL CNY   42682
大人
======================
FARE  CNY     3730                  
TAX   CNY      76AY CNY       0CN CNY  492XT
TOTAL CNY    4298
婴儿


3个大人
NM1LONG/QI MS1SUN/XIAOMAN MS1WANG/ZEYU MR
SSR DOCS UA HK1 P/CN/EN5034604/CN/02JUN70/F/29SEP34/LONG/QI/P1
SSR DOCS UA HK1 P/CN/EJ7034219/CN/17DEC94/F/11JAN33/SUN/XIAOMAN/P2
SSR DOCS UA HK1 P/CN/EJ8049802/CN/30DEC91/M/05FEB33/WANG/ZEYU/P3
1个婴儿
NM1WANG/RUOCHU
SSR DOCS UA HK1 P/CN/H23818828/CN/03MAR25/F/08APR30/WANG/RUOCHU/P1
`;
const _hb = splitIntoBookings(HS);
eq('H0 分单不裂(======运价块)', _hb.length, 1);
const h1 = parseSingleBooking(_hb[0]);
eq('H1 四段混航司+运价块每人', [(h1.segs||[]).length, h1.segs[3].flight, h1.rmb, JSON.stringify(h1.fareByType)], [4, 'NH963', 42682, JSON.stringify({adult:42682,infant:4298})]);
eq('H2 四客铺价+清零', [(h1.pax||[]).length, JSON.stringify(h1.paxPrices), (h1.unrecognizedLines||[]).length], [4, JSON.stringify([42682,42682,42682,4298]), 0]);
// 运价块再压行变形（段号粘FARE/TAX+TOTAL+类型词一锅粥/名单巨行）
const HS2 = String.raw`1. UA889 P MO24AUG PEKSFO DK1 1725 1420 777 0 ----
2. UA1141 P MO24AUG SFOEWR DK1 2235 0706+1 777 0 ----
3. UA131 P WE02SEP EWRHND DK1 1030 1335+1 777 0 ----
4. NH963 P TH03SEP HNDPEK DK1 1715 2015 788 0 E 3 3 
5. 
6. 
7. FARE CNY 37280
TAX CNY 76AY CNY 90CN CNY 5236XT TOTAL CNY 42682 大人 ====================== FARE CNY 3730
TAX CNY 76AY CNY 0CN CNY 492XT TOTAL CNY 4298 婴儿

3个大人 NM1LONG/QI MS1SUN/XIAOMAN MS1WANG/ZEYU MR SSR DOCS UA HK1 P/CN/EN5034604/CN/02JUN70/F/29SEP34/LONG/QI/P1 SSR DOCS UA HK1 P/CN/EJ7034219/CN/17DEC94/F/11JAN33/SUN/XIAOMAN/P2 SSR DOCS UA HK1 P/CN/EJ8049802/CN/30DEC91/M/05FEB33/WANG/ZEYU/P3 1个婴儿 NM1WANG/RUOCHU SSR DOCS UA HK1 P/CN/H23818828/CN/03MAR25/F/08APR30/WANG/RUOCHU/P1
`;
const _hb2 = splitIntoBookings(HS2);
eq('H0b 分单不裂(行内======)', _hb2.length, 1);
const h3 = parseSingleBooking(_hb2[0]);
eq('H3 再压行变形等价', [(h3.segs||[]).length, (h3.pax||[]).length, h3.rmb, JSON.stringify(h3.fareByType), (h3.unrecognizedLines||[]).length], [4, 4, 42682, JSON.stringify({adult:42682,infant:4298}), 0]);
// 分单器多单场景不误伤
eq('S1 多单-----分隔正常切分', splitIntoBookings(GS + '\n-----\n' + HS).length, 2);
// Delta/Chase 列式布局
const IS = String.raw`Lima (LIM) > New York (FK), New York (LGA) > Orlando (MCO)
1 traveler
Flight 1: Sun, Oct 25, 2026, Delta One Classic
12:00 pmDelta Air LinesLIMDL 6068 Operated by /Latam Airlines PeruFlight 2: Mon, Oct 26, 2026, Delta One Classic8:10 amDelta Air LinesLGA
DL 1511 Operated by Delta Air Lines Inc
8h10m
Non-stop
2h 55m
Non-stop
367,857 pts or $3,678.57
Includes taxes/fees
Remove flight
9:10 pm
JFKMCO
11:05 am
`;
const _ib = splitIntoBookings(IS);
eq('I0 分单不裂', _ib.length, 1);
const i1 = parseSingleBooking(_ib[0]);
eq('I1 列式两段拼装', [(i1.segs||[]).length, i1.segs[0].flight, i1.segs[0].from, i1.segs[0].to, i1.segs[0].arrTime, i1.segs[1].flight, i1.segs[1].from, i1.segs[1].to], [2, 'DL6068', 'LIM', 'JFK', '21:10', 'DL1511', 'LGA', 'MCO']);
eq('I2 金额舱位清零', [i1.usd, i1.rmb, i1.cabin, (i1.unrecognizedLines||[]).length], [3678.57, +(3678.57*7.2).toFixed(2), '商务舱', 0]);
// 中文城市航段
const JS = String.raw`1. UA134  12月20日  纽约纽瓦克—苏黎世 1825 0820+1
2. UA9748 12月30日  苏黎世—纽约 纽瓦克 1715 2030 
TOTAL USD 25243.15
`;
const _jb = splitIntoBookings(JS);
eq('J0 分单不裂', _jb.length, 1);
const j1 = parseSingleBooking(_jb[0]);
eq('J1 中文城市两段', [(j1.segs||[]).length, j1.segs[0].flight, j1.segs[0].from, j1.segs[0].to, j1.segs[0].date, j1.segs[0].arrTime, j1.segs[1].from, j1.segs[1].to], [2, 'UA134', 'EWR', 'ZRH', '20DEC', '0820+1', 'ZRH', 'EWR']);
eq('J2 金额清零', [j1.usd, j1.rmb, (j1.unrecognizedLines||[]).length], [25243.15, +(25243.15*7.2).toFixed(2), 0]);
// AA 代码共享 + JPY EQUIV 运价块 + 大/小单字标签
const KS = String.raw`第2单 商务9折
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
TOTAL CNY 30024
`;
const _kb = splitIntoBookings(KS);
eq('V0 分单不裂', _kb.length, 1);
const k1 = parseSingleBooking(_kb[0]);
eq('V1 代码共享段+头行提取', [(k1.segs||[]).length, k1.segs[0].flight, k1.segs[0].cls, k1.cabin, k1.discount], [1, 'AA8439', 'C', '商务舱', 90]);
eq('V2 大/小定型+铺价+清零', [JSON.stringify(k1.fareByType), JSON.stringify(k1.paxPrices), k1.rmb, (k1.unrecognizedLines||[]).length], [JSON.stringify({adult:39234,child:30024}), JSON.stringify([39234,30024,30024]), 39234, 0]);
// 名单/护照名写法不一致（空格）去重合并
const LS = String.raw`1.JIANG/JIAN QING 2.YAN/XIAO FENG
 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W  0 E  2 I
 4.  UA857  G   TU13OCT  SFOPVG HK2   1300   1725+1 77W  0 E  I 2
护照：
ER7683152/CN/30NOV67/M/14APR36/JIANG/JIANQING/P1
ER9927893/CHN/11NOV65/F/27MAY36/YAN/XIAOFENG/P2
`;
const _lb = splitIntoBookings(LS);
eq('X0 分单不裂', _lb.length, 1);
const l1 = parseSingleBooking(_lb[0]);
eq('X1 两人不重复+资料合并', [(l1.pax||[]).length, l1.pax[0].name, l1.pax[0].dob, l1.pax[0].gender, l1.pax[1].name, l1.pax[1].dob], [2, 'JIANG/JIAN QING', '30NOV67', 'MALE', 'YAN/XIAO FENG', '11NOV65']);
eq('X2 两段+清零', [(l1.segs||[]).length, l1.segs[1].arrTime, (l1.unrecognizedLines||[]).length], [2, '1725+1', 0]);
// 交叉对抗矩阵（v-CX 主动质检固化）
{
  const seg = " 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W  0 E  2 I\n";
  const a3 = parseSingleBooking(splitIntoBookings("1.JIANG/JIAN-QING\n" + seg + "护照：\nER7683152/CN/30NOV67/M/14APR36/JIANG/JIANQING/P1")[0]);
  eq('Y1 连字符名合并+效期', [(a3.pax||[]).length, a3.pax[0].dob, a3.pax[0].passportExpiry], [1, '30NOV67', '14APR36']);
  const a4 = parseSingleBooking(splitIntoBookings("1.LI/WEI 2.LI/WEI MING\n" + seg + "护照：\nER1111111/CN/30NOV67/M/14APR36/LI/WEI/P1\nER2222222/CN/11NOV65/F/27MAY36/LI/WEIMING/P2")[0]);
  eq('Y2 同姓不同名不误合并', (a4.pax||[]).length, 2);
  const a5 = parseSingleBooking(splitIntoBookings("乘机人：JIANGJIANQING\n" + seg + "护照：\nER7683152/CN/30NOV67/M/14APR36/JIANG/JIANQING/P1")[0]);
  eq('Y3 无斜杠手打名升级证件名', [(a5.pax||[]).length, a5.pax[0].name], [1, 'JIANG/JIANQING']);
  const e1 = parseSingleBooking(splitIntoBookings("1.ZHANG/SAN\n" + seg + "TOTAL CNY 39234\n大人\n小计 39234")[0]);
  eq('Y4 小计行不当儿童价', !!(e1.fareByType||{}).child, false);
  const f1 = parseSingleBooking(splitIntoBookings("1.ZHANG/SAN 2.LI/SI  1. *AA8439 C   SU03JAN  KIXLAX DK1   1800 1120   M 0  2. *AA8440 C   SU05JAN  LAXKIX DK1   1800 1120   M 0")[0]);
  eq('Y5 代码共享*段粘连拆段', (f1.segs||[]).length, 2);
}
// 全局对抗矩阵（v-CZ 固化：解析边界）
{
  const P = (raw) => { const b = splitIntoBookings(raw); return parseSingleBooking(b[0] || ""); };
  eq('Z1 空输入不炸', Array.isArray(P("").segs), true);
  eq('Z2 三种分隔混用切2单', splitIntoBookings("第1单\n1.A/B\n 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W\n-----\n第2单\n1.C/D\n 3.  UA857  G   TU13OCT  SFOPVG HK2   1300   1725+1 77W\n======\nTOTAL CNY 100").length, 2);
  const s5 = "1.JIANG/JIANQING\n 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W\n";
  eq('Z3 重复粘贴幂等', (P(s5 + s5).pax||[]).length, 1);
  eq('Z4 超大金额不入库', !(P("1.A/B\n 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W\nTOTAL CNY 99999999").rmb > 2000000), true);
  const t0 = Date.now(); P("1.A/B\n" + " 3.  UA858  T   FR25SEP  PVGSFO  HK2   1210   0835   77W\n".repeat(3000));
  eq('Z5 3000行<2s', Date.now() - t0 < 2000, true);
}
// Sabre 显示格式 + SSR 六位数字生日变体
const MS = String.raw`1.  UA2019 B1  TH01OCT  TPALAX DK1   1244 1456    SEAME ----
 2.  UA820  R1  TH01OCT  LAXHKG DK1   2345 0540+2    SEAME ----
 
FSI/UA/PREC
S UA  2019B01OCT TPA1244 1456LAX0X    7M8          #DJCDZYBMEUHQVWSTLKGN#CP
S UA   820R01OCT LAX2345+0540HKG0S    789          #DJCDZOARYBMEUHQVWSTLKG#CP
01 RLX4ISBU                     10230 CNY                    INCL TAX  　XSFSQ01
 
SSR DOCS UA HK1 P/USA/A39321637/USA/761015/M/CHANG/WEYLU
`;
const _mb = splitIntoBookings(MS);
eq('AA0 分单不裂', _mb.length, 1);
const m1 = parseSingleBooking(_mb[0]);
eq('AA1 六位生日变体乘客', [(m1.pax||[]).length, m1.pax[0].name, m1.pax[0].dob, m1.pax[0].gender], [1, 'CHANG/WEYLU', '15OCT76', 'MALE']);
eq('AA2 段/金额/系统行静默', [(m1.segs||[]).length, m1.segs[1].arrTime, m1.rmb, (m1.unrecognizedLines||[]).length], [2, '0540+2', 10230, 0]);
// KRW EQUIV 运价块（类型词在块前）+ 48 个月婴儿口径
const NS = String.raw`1.  UA286  P   SU13SEP  ICNEWR DK1   1715   1800   789  0   ----
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
const _nb = splitIntoBookings(NS);
eq('AB0 分单不裂', _nb.length, 1);
const n1 = parseSingleBooking(_nb[0]);
eq('AB1 前置类型词定型+五客分档铺价', [(n1.pax||[]).length, n1.rmb, JSON.stringify(n1.fareByType), JSON.stringify(n1.paxPrices), (n1.unrecognizedLines||[]).length], [5, 24596, JSON.stringify({adult:24596,infant:2597}), JSON.stringify([24596,24596,2597,2597,24596]), 0]);
// 48 个月口径：起飞 13SEP（2026）时 05JAN23 生 = 3 岁 8 个月 → 婴儿价
const n48 = parseSingleBooking(splitIntoBookings(NS.replace('05JAN25/M/07JUL30/XIANG/HANTING', '05JAN23/M/07JUL30/XIANG/HANTING'))[0]);
eq('AB2 未满48月配婴儿价', n48.paxPrices[2], 2597);
// v-DE：无 SEL 行（线上旧单原文形态）——类型词模式锁定消歧，不依赖 SEL 兜底
const nNoSel = parseSingleBooking(splitIntoBookings(NS.replace(/SEL [^\n]*\n/, '').replace(/=+\n/, ''))[0]);
eq('AB3 无SEL无分隔线仍分档', [nNoSel.rmb, JSON.stringify(nNoSel.fareByType), JSON.stringify(nNoSel.paxPrices)], [24596, JSON.stringify({adult:24596,infant:2597}), JSON.stringify([24596,24596,2597,2597,24596])]);
// 裸 P/ 证件行尾斜杠变体
const ad1 = parseSingleBooking('P/CN/EJ7464953/CN/23FEB76/F/06MAR33/ZHANG/XIU/');
eq('AD1 尾斜杠证件行', [(ad1.pax||[]).length, ad1.pax[0].name, ad1.pax[0].dob, ad1.pax[0].gender, ad1.pax[0].passportExpiry, (ad1.unrecognizedLines||[]).length], [1, 'ZHANG/XIU', '23FEB76', 'FEMALE', '06MAR33', 0]);
// 简表名单 + 基础经济产品保留
const OS = String.raw`1.  UA772  G   MO12OCT  PEKLAX DK9   1200   0920   789  0 E  3 B
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
const o1 = parseSingleBooking(splitIntoBookings(OS)[0]);
eq('AF1 简表十客干净', [(o1.pax||[]).length, o1.pax[0].name, o1.pax[0].gender, o1.pax[0].dob, o1.pax[9].name], [10, 'CUI/QIANQIAN', 'FEMALE', '28MAR84', 'WANG/ANQI']);
eq('AF2 基础经济产品+算式', [o1.cabin, o1.rmb, o1.discount, (o1.paxPrices||[]).length, (o1.unrecognizedLines||[]).length], ['基础经济舱', 7236, 92, 10, 0]);
process.exit(fails ? 1 : 0);
