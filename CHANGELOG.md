## 2026-05-23 — 【重大修复】多设备并发覆盖丢单 → 改为 Merge-by-ID 永不丢单

**这是什么问题**
用户每天出 30+ 单，但数据 3 天只涨 15 单（813→828），几十单凭空消失。

**根本原因（第一次审计漏掉的真 bug）**
Firebase 同步用的是「整体覆盖」模型：
- `fbPushNow` 把整个 `settings`（含全部 ticketed 数组）一次性写云端
- `fbApplyRemote` 用 `Object.assign(settings, remote.settings)` 整体替换本地

多设备/多标签并发时（用户手机+电脑+多标签同时用）：
```
设备A出票→821单→推云端
设备B还停在820（没收到A的推送，或被 remoteTs<=localTs 判断跳过）
设备B出票→本地821（820+1）→推云端→覆盖掉A的那单！应为822实为821
```
加上 `if (remoteTs <= localTs) return` 这个跳过逻辑 + 多设备时钟差，导致一台设备持续用「缺单的本地版本」覆盖云端。每天几十单只要有任何并发就丢。数据集看起来「干净无重复」恰恰因为丢得干净——被覆盖的单没留痕迹。

**怎么修的：Merge-by-ID（并集，永不丢）**
核心新增 `_mergeById(local, remote, keyField, tsField)`：取两个数组的并集
- 只在本地有 → 保留
- 只在远程有 → 加入
- 两边都有（同id）→ 用 ticketedAt 较新的；平局保留本地（防覆盖刚编辑的）

应用到三个层面：
1. **fbApplyRemote**：收到云端数据时，ticketed/cardholders/knownPax/actions/discountRules 等全部 merge，不再整体替换
2. **fbPushNow 改 READ-MERGE-WRITE**：推送前先拉云端最新→合并本地进去→再写。即使本地数据不全，也不会覆盖掉云端别的设备刚加的单
3. **onSnapshot echo 防护精确化**：从「3秒内忽略所有远程」改成「只忽略自己刚写的那条 updatedAt」，避免误杀紧随其后的其他设备更新（merge 安全，echo 即使漏进来也只是自己merge自己=无害）

**附带修复的 ID 碰撞隐患**
出票订单 ID 原本是 `tk-{时间戳}-{下标}`，两台设备同毫秒出票同批次第0单 → ID 完全相同 → merge 会误当同一单丢一个。三处 ID 生成全部加 6 位随机后缀：
- 单单出票（22583）：加 -{6位随机}
- 批量出票（18595）：随机从3位→6位
- 手动补录（19053）：原本完全无随机 → 加 -{6位随机}

**单元测试 9/9 全过**（关键场景）
- ✓ 本地5单 + 空远程 = 5单（防清空，这就是防丢单核心）
- ✓ 空本地 + 远程5单 = 5单（新设备首次拉取）
- ✓ A出90单 + B出60单(20重叠) = 130单（模拟真实多设备并发）
- ✓ 同id取较新时间戳 / 本地较新则保留本地 / 字符串去重合并

**改动位置**
- index.html 18595, 19053, 22583：ID 加强随机
- index.html 23527 附近：加 _fbLastWrittenTs 变量
- index.html 23633 附近：onSnapshot echo 防护精确化
- index.html 23646 附近：fbApplyRemote 重写为 merge（+新增 _mergeById/_mergeUniqueStrings）
- index.html 23773 附近：fbPushNow 改 read-merge-write

**🔑 部署后必做的数据抢救（重要！）**
新 merge 逻辑是双向 loss-safe 的。被覆盖丢失的历史单，只要那台设备的 localStorage 没被清，就还在各设备本地。抢救方法：
1. 先在「最标准那台设备」部署+打开 → 828单 merge 进云端
2. 依次打开每一台其他设备/手机/每个浏览器标签（都部署同一份代码）
3. 每打开一台，它本地存的单自动 merge 进云端，数字只增不减地累加
4. 最后所有设备的单全部汇总，每台都显示完整总数

**风险或注意事项**
- ⚠ **删除会"复活"**：merge 是并集，如果用户故意删了某单，下次和别的设备（还有这单）merge 时会被加回来。本次未做删除墓碑（deletedIds）机制——因为当前痛点是丢单不是删不掉。如果以后需要"删了就别回来"，要再加墓碑机制
- ⚠ **fbPushNow 现在每次推送前多一次 getDoc 读取**：增加一点延迟和 Firebase 读配额消耗。但这是 loss-safe 的必要代价。test mode 下无所谓
- ⚠ **scalar 设置仍是 last-write-wins**：exchangeRate/theme 等标量设置不 merge（也无需 merge），最后写的赢
- ⚠ **🚨 Firebase test mode 6/22 到期仍未解决**：到期后所有同步失败，这比任何功能都紧急

**回滚方式**
从 .backups/ 找上一版覆盖。⚠ 回滚会恢复「整体覆盖」bug，多设备并发会重新开始丢单。强烈不建议回滚。

---
