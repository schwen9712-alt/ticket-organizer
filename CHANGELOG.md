## 2026-06-11 — 修复乘客名撞航司代码被误删（GONG/KE 丢失）

**改了什么**
`isMetaName` 新增强上下文参数：同一行带 男/女+出生日期 时跳过"名字=航司代码"过滤。

**为什么改**
用户输入解析缺一个乘客：
```
GONG/KE  男  1981年 6月24日
LIU/MINGZHU  女  1983年1月19日
```
诊断：`isMetaName` 的航司代码启发式（本用于过滤 FSICH/CA 类 GDS 元数据行）把 **KE（大韩航空代码）**当成元数据标记，GONG/KE 整行被丢弃。日期里的空格（1981年 6月24日）是无辜的，extractDOB 本就支持。同理会受影响的常见名拼音：KE（柯/可/科）、BA（巴）。

**修复方案**
- `isMetaName(n, hasStrongPaxContext)`：强上下文（性别+生日同行）时跳过航司代码判定；精确元词表和 FSI 前缀过滤不变
- 仅 cnInlinePax 分支以 `true` 调用；其余路径（nameRe 兜底等）过滤强度不变

**端到端测试（用户输入）通过**
- ✓ GONG/KE 男 24JUN81 + LIU/MINGZHU 女 19JAN83 两乘客齐全
- ✓ DL280/DL281 双航段、7401×0.9（识别为9折）、经济舱 全部正常

**防误伤测试通过（6项）**
- ✓ FSICH/CA 无上下文仍过滤
- ✓ WANG/KE 女 1990年5月1日 → 正常识别
- ✓ 儿童行 LIU/QINGHE 儿童 女10JAN2022 正常
- ✓ 婴儿撞码 CHEN/BA 女婴 → 正常识别为婴儿
- ✓ 普通经济6129 舱位粘连价正常
- ✓ 无上下文裸名 SMITH/KE 仍过滤（保守策略）

**改动位置**
- index.html ~10003：isMetaName 签名 + 航司代码分支加 `!hasStrongPaxContext` 条件
- index.html ~10053：cnInlinePax 提交处改为 `isMetaName(name, true)`

**风险或注意事项**
- ⚠ 无性别/生日上下文的裸名行，若名恰为航司代码（如单独一行 SMITH/KE）仍会被过滤——保守策略；SSR/证件行有自己的解析路径，不受影响
- 顺带确认：`普通经济7401×0.9` 的价格+折扣+舱位本就由其他分支正确解析，此次未改动

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后 GONG/KE 类名字又会丢失。

---
## 2026-06-10 — 修复 SSR 折行导致的假乘客（乘客数错误）

**改了什么**
新增 SSR 续行合并预处理：GDS 终端折断的 SSR 证件行自动拼回一行，修复乘客数识别错误。

**为什么改**
用户反馈这段识别错误（实际只有 2 个乘客）：
```
SSR DOCS MU HK1 P/USA/A88984286/USA/04JUL08/F/07MAY36/KRAFT/CHRISTINE
TIANTIAN/P1
SSR DOCS MU HK1 P/USA/572194822/USA/15MAY72/F/23MAY27/WANG/YANLIALICE/P2
```

诊断：第一条 SSR 被 GDS 终端宽度**折断成两行**——`...KRAFT/CHRISTINE`（没有 /P1 结尾）+ 孤立的 `TIANTIAN/P1`。真实乘客名是 **KRAFT/CHRISTINE TIANTIAN**（名字两个词）。

旧解析的错误行为：
- 行3 SSR 匹配成 KRAFT/CHRISTINE（名字缺 TIANTIAN）
- 行4 "TIANTIAN/P1" 被姓名 fallback **误判为第三个乘客** "TIANTIAN/P"
→ 解析出 3 个乘客（1个名字不完整 + 1个假乘客），实际只有 2 个

**修复方案**
预处理阶段加"SSR 续行合并"：
- 条件1：SSR DOC 行**没有**以 /Pn（或儿童/婴儿标记）结尾
- 条件2：下一行是短的纯大写片段（≤30字符，可带 /Pn 结尾，不是另一条SSR/航段/价格）
- 两个条件都满足 → 拼回一行

**端到端测试（用户输入）通过**
- ✓ 折断的 SSR 正确合并
- ✓ 正好 2 个乘客（假乘客 TIANTIAN/P 消失）
- ✓ KRAFT/CHRISTINE TIANTIAN 名字完整（DOB 04JUL08，到期 07MAY36）
- ✓ WANG/YANLIALICE 正常（DOB 15MAY72，到期 23MAY27）

**防误伤测试通过（5项）**
- ✓ 完整SSR + 下一条SSR → 不合并
- ✓ 完整SSR + TOTAL价格 → 不合并
- ✓ 缺Pn的SSR + 价格行 → 不误合并（含数字不匹配续行模式）
- ✓ 缺Pn的SSR + 航段行 → 不误合并
- ✓ 缺Pn的SSR + 中文行 → 不误合并

**改动位置**
- index.html 9449 前：新增 SSR 续行合并预处理（在护照卡合并之前）

**风险或注意事项**
- ⚠ 续行判定要求纯大写字母片段 ≤30 字符，更长或含数字的行不会被当续行（保守策略）
- ⚠ 顺便注意：KRAFT/CHRISTINE TIANTIAN 出生 2008 年，是未成年人
- ⚠ 不影响完整的（未折行的）SSR 解析

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后折行 SSR 又会产生假乘客。

---
