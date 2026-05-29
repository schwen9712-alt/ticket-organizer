## 2026-05-23 — 新增「✈ 复制行程」：简洁行程文字一键发卡主

**改了什么**
订单卡片新增「✈ 复制行程」按钮（在「📋 乘客」和「💳 分配卡主」之间），一键复制成简洁的纯文字行程，可直接粘贴发给卡主（微信等），让卡主直观看到整个行程。

**生成格式**
```
TRIP: ROUND TRIP (MULTI-STOP)

 1. UA1597  ECONOMY-L 18JUL  CMHSFO  0700 0906
 2. UA857   ECONOMY-L 18JUL  SFOPVG  1330 1725+1
 3. UA199   ECONOMY-L 04AUG  PVGLAX  2010 1720+1
 4. UA1692  ECONOMY-L 05AUG  LAXCMH  1045 1815

APPROX. PRICE  $2,025.06
```

**特点**
- **TRIP 类型自动识别**：1段=ONE WAY；2段且首尾同城=ROUND TRIP；闭环多段=ROUND TRIP (MULTI-STOP)；其余=MULTI-CITY
- **舱位全名**：从订单舱位标签或航段 class 推导 ECONOMY/BUSINESS/FIRST，拼成 `ECONOMY-L` 格式
- **隔夜标记**：arrTime 带 +N 直接显示；未标但到达时间早于出发时间则自动推断 +1
- **只含发卡主需要的信息**：航班、舱位、日期、航路、起降时间、USD 约价。不含 RMB 价格/折扣/PNR 等内部信息
- 美化：等宽对齐，航班号右补齐

**为什么改**
用户需求：「行程可以一键复制，目的是直接用文字形式发给卡主，更好直观看到」

之前的「代理商报表」「记录员报表」含 PNR/折扣/RMB 等内部信息，不适合直接发卡主。卡主只需要看到飞哪几段、什么舱、大概多少钱。

**测试验证（用户提供的真实订单）**
- ✓ UA四段 CMH-SFO-PVG-LAX-CMH → 正确生成，隔夜+1（SFOPVG显式、PVGLAX推断）都对
- ✓ ONE WAY 商务舱 → BUSINESS-J，TRIP: ONE WAY
- ✓ ROUND TRIP → 首尾同城识别为 ROUND TRIP
- ✓ USD 价格正确显示

**新增函数**
- `_cabinFullName(cls)` — booking class → ECONOMY/BUSINESS/FIRST
- `_orderCabinWord(o)` — 订单中文舱位 → 英文舱位词（优先于class推导）
- `buildItineraryCopy(o)` — 生成完整行程文字
- `copyOrderItinerary(idx)` — 复制到剪贴板 + toast

**改动位置**
- index.html buildClientCopy 后（约 18143）：新增 3 个行程生成函数
- index.html copyOrderCard 后（约 18566）：新增 copyOrderItinerary
- index.html 订单卡片按钮区（约 13248）：加「✈ 复制行程」按钮

**风险或注意事项**
- ⚠ **舱位推导基于 booking class 字母**：F/A/P→FIRST，J/C/D/I/Z/R→BUSINESS，其余→ECONOMY。不同航司 class 含义略有差异，但订单若有中文舱位标签会优先用它（更准）
- ⚠ **跨日推断**：arrTime<depTime 时自动+1。绝大多数正确，但若原始数据时间填错可能误判。显式 +N 标记优先
- ⚠ **TRIP 类型是按首尾城市判断**：你的 CMH→...→CMH 例子会标 "ROUND TRIP (MULTI-STOP)" 而非 "MULTI-CITY"（因为确实回到了起点）。如果你更想统一叫 MULTI-CITY，告诉我改
- ⚠ USD 价格优先用 o.usd，无则用 computeFinalPrice/汇率换算

**回滚方式**
从 .backups/ 找上一版覆盖。纯新增功能，回滚无副作用。

---
