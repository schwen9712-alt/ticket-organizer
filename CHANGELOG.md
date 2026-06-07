## 2026-05-23 — 全面代码审核 + 热路径空值防御（防白屏）

**做了什么**
对最新版本做系统性审核，修复可能导致白屏的运行时空值问题。

**审核结论（健康项）**
- ✓ 508 个函数，无重复定义
- ✓ 无真正的孤儿调用（核心函数引用完整）
- ✓ 核心算法全部唯一：computeFinalPrice/computeSettlement/effectiveRate/parsePNR/detectDuplicates/renderPendingList/renderPreview
- ✓ 最近功能字段一致：flatPriceMode/basicFare/ticketSeqNote/flatPriceCny 都有 schema
- ✓ Firebase 同步健康：fbScheduleWrite 18处、autoCloudPush 零残留、_mergeById 防丢单在位

**修复的运行时隐患（白屏根源）**
审核发现 98 处 `getElementById(x).y` 直接访问 + 多个热路径函数缺空值保护。热路径函数被每个订单行反复调用，一旦某订单数据不完整（缺 passengers/为 null），就抛错中断渲染 → 整页白屏。

修复 3 个最关键的热路径函数：
1. **computeFinalPrice(o)**：加 `if(!o) return null`；`o.passengers.length` → `(o.passengers && o.passengers.length) || 1`（2处）
2. **effectiveRate(o)**：`o.customRate` → `o && o.customRate`（防 o 为 null）
3. computeSettlement 通过 isCardPayment 的 `o &&` 已间接安全

**测试 8/8 全过（坏数据不再抛错）**
- ✓ computeFinalPrice(null/undefined/{})
- ✓ flatPrice 无 passengers
- ✓ discount 无 passengers/basePrice
- ✓ effectiveRate(null/{})

这些坏数据场景之前会抛 "Cannot read property 'length' of undefined" 之类的错，中断整页渲染导致白屏。现在安全返回 null/默认值。

**改动位置**
- index.html 8402 computeFinalPrice：空值防御
- index.html 11677 effectiveRate：空值防御

**为什么这样改（而非大改）**
白屏通常是单个数据问题引发的连锁渲染中断。修热路径函数的空值容错，是性价比最高的防护——让坏数据"安全降级"而非"整页崩溃"。没有大规模重写，避免引入新风险。

**风险或注意事项**
- ⚠ 如果白屏仍出现，需要 F12 Console 的具体报错来定位（不同白屏可能不同根因）
- ⚠ 本次只修了最热的 2 个函数。其余 98 处 getElementById 直接访问大多是安全的（元素确定存在），未逐一加判空以免过度改动
- ⚠ 这版包含之前所有功能：一口价、基础运价、多航段拆分、关联订单、行程复制等

**回滚方式**
从 .backups/ 找上一版覆盖。本次纯防御性加固，回滚无功能影响但会恢复空值抛错风险。

---
