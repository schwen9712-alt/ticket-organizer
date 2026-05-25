## 2026-05-23 — 积分支付补充现金补差功能

**改了什么**
新增 `cashUsd` 字段（现金补，美金），用于卡主积分不够时用现金补足差额的混合支付场景。

成本公式从：
```
cost(USD) = miles × mult × cpp
```
变成：
```
cost(USD) = miles × mult × cpp + cashUsd
```

`cashUsd` 是**可选字段**，默认 0 / null，不填等于原来的行为（完全兼容）。出票校验**不要求**填写。

**为什么改**
用户反馈：「卡主积分进行功能完善，有时候卡主的积分不够，会用不够的部分使用现金计算。比如 AMEX 一个预定需要 16 万的分，卡主可能就是 15 万的分 + 100 美金的现金」

之前系统只支持纯积分或纯刷卡，混合支付的场景没法准确记录成本。

**改动位置**
- `index.html` 行 5489 附近：order schema 新增 `cashUsd` 字段
- `index.html` 行 8299/8307：`computeSettlement` usesPoints 路径加 cashUsd
- `index.html` 行 8161 附近：录入表单的 `summary-settlement` 摘要支持显示混合公式
- `index.html` 行 12695 附近：出票完成表单的「积分 Points」「单价 CPP」之间插入「现金补 USD」字段（可选标签，紫色高亮当有值）
- `index.html` 行 12771 / 14831 附近：底栏公式预览改成 `m × mult × cpp + $cash = $total`（cash > 0 时才显示 cash 部分）
- `index.html` 行 13260 附近：分配卡主弹窗的快速利润预览也读 o.cashUsd，避免 profit 算错
- `index.html` 行 14739：`updatePendingField` 数值字段白名单加入 cashUsd

**UI 行为**
1. 出票表单 usesPoints 模式下，「单价 CPP」右边出现「现金补 USD（可选）」输入框
2. 不填或填 0 → 行为完全不变（成本就是 miles × mult × cpp）
3. 填了正数 → 输入框紫色高亮 + 底部公式从 `X × 0.65 × 1.34CPP = $4393.22` 变成 `X × 0.65 × 1.34CPP + $100.00 = $4493.22`
4. 分配卡主弹窗的利润预览也跟着分项显示：积分成本 / + 现金补 / 总成本

**测试已验证**
- ✓ 无现金补（cashUsd = null）：504388 × 0.65 × 0.0134 = $4393.22（与图中数据一致，无 regression）
- ✓ 15 万分 + $100：150000 × 0.65 × 0.0134 + 100 = $1406.50
- ✓ cashUsd = "100"（字符串）→ 正确解析为数字
- ✓ cashUsd = ""（空串）→ 当 0 处理
- ✓ cashUsd = -50（负数）→ 允许（可用于积分退款场景，比如卡主先用了 100 美金后退了 50）

**风险或注意事项**
- ⚠ Excel 导出**目前不单独列 cashUsd 一列**：因为成本汇总在 `o.cardholderFee`（= computeSettlement 结果，已含 cash）。如果以后需要 Excel 显示明细，可以再加。现在导出的总成本数字是对的
- ⚠ 老数据没有 cashUsd 字段，读取时是 `undefined → Number(undefined) = NaN → || 0 → 0`，**完全向后兼容**
- ⚠ 分配卡主弹窗里**没加 cashUsd 输入框**（保持简洁，cash 是边缘情况）。如果你想在分配卡主时就指定 cash，需要先到主表单填好再分配
- ⚠ 现金补走的是卡主头上（cardholderFee），跟刷卡折扣模式（B 表）不是一回事。如果你想区分"卡主给的现金"和"客户额外付的现金"，那是另一个 schema 变更

**回滚方式**
从 `.backups/` 找上一次的 `index.html` 覆盖即可。新字段 `cashUsd` 即使存在于已有订单里，旧代码读 `undefined` 也不会出错（所有路径都 `Number(x) || 0`）。100% 安全回滚。

---
