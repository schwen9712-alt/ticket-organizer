## 2026-05-23 — 一致性审计：修复 autoCloudPush 未定义 bug

**改了什么**
修复一个运行时 bug：`autoCloudPush()` 函数在历史重构中被 `fbScheduleWrite()` 取代，但有 3 处调用没改过来，导致调用一个不存在的函数。

3 处全部改为 `if (typeof fbScheduleWrite === 'function') fbScheduleWrite();`：
- `persistOrders()` 的 debounce 回调（23413）— **影响最大**
- `restoreFromRollingBackup()`（22482）
- 5766 行（原本有 typeof 守卫，不会报错但永远不执行 → 同样修正）

**为什么改 / bug 的真实影响**
通过一致性审计发现：`autoCloudPush` 定义 0 处，调用 3 处。

最关键的是 `persistOrders()` —— 每次编辑订单后 debounce 400ms 会触发它：
- ✓ 本地保存正常（`storageSet('ticket-organizer-pending')` 在前一行已执行）
- ✗ 但紧接着 `autoCloudPush()` 抛 ReferenceError → **编辑订单的改动没有触发 Firebase 同步**

结果：用户在 A 设备编辑订单（改价格、改卡主、改舱位等），改动只存了本地，**没有及时推送到 Firebase**。要等到下次出票 / 手动操作等其他会调用 fbScheduleWrite 的路径，才会把累积的改动一起推上去。这可能是"多设备同步偶尔慢半拍"的原因之一。

修复后：编辑订单 → 本地保存 + Firebase 同步，两件事都正常完成。

**一致性审计的其他结论（本次未改动，仅记录）**
健康项：
- ✓ 核心算法 computeSettlement/computeFinalPrice/effectiveRate/extractDOB 等全部唯一定义，无重复
- ✓ 0 个重复函数定义
- ✓ POINTS_TYPES 无硬编码 *0.65，全走配置
- ✓ 10 个 localStorage key 命名规范统一
- ✓ 无真 TODO/FIXME（XXX 和"临时"都是正常文案/业务术语）

发现但未处理（低优先级，刻意不动以避免引入风险）：
- IATA 月份字典 {JAN:0...} 重复 8 处（可抽常量但收益小）
- 空 catch{} 42 处（多为合理兜底）
- 23 个死函数 248 行（1% 体积，ROI 太低）

发现的 2 个半成品功能（完整实现但没接 UI，待用户决定是否激活）：
- `checkPassportExpiry` — 护照过期/不足6个月警告（防拒登机）
- `detectPriceAnomalies` — 同航线价格异常检测（防报错价亏钱）

**改动位置**
- `index.html` 行 5766、22482、23413：autoCloudPush → fbScheduleWrite

**风险或注意事项**
- ⚠ 修复后编辑订单会更频繁触发 Firebase 写入（之前是炸掉不写）。fbScheduleWrite 本身有 debounce，不会造成请求风暴。但如果你 Firebase 用量敏感，留意一下（test mode 下无所谓）
- ⚠ 这个修复**增加了**云同步频率（从"编辑时不同步"变成"编辑时同步"），是符合预期的正确行为，不是副作用

**回滚方式**
从 `.backups/` 找上一版 `index.html` 覆盖即可。注意回滚后会恢复 autoCloudPush bug（编辑订单不触发云同步）。100% 安全回滚但不建议（会带回 bug）。

---
