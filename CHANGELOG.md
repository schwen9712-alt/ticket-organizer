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
