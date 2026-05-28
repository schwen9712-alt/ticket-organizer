## 2026-05-23 — 取消自动出票快照（释放约 4.2 MB 本地存储）

**改了什么**
1. **移除所有自动 rolling backup 调用**（3 处）：
   - 出票前快照（22553）：删
   - 出票后快照（22609）：删
   - 批量出票快照（18618）：删
   - 手动补录快照（19066）：删
2. **快照上限从 5 → 2**：`ROLLING_BACKUP_SLOTS = 2`
3. **应用加载时一次性 trim 旧 ring buffer**：之前存的 5 个快照会自动截到最新 2 个，立即释放约 60% 空间。F12 Console 会有日志 `[rolling-backup] trimmed 5 → 2 snapshots`
4. **设置面板 UI 改文案**：「本地自动快照」→「本地手动快照（应急用，最多保留 2 个）」，并加绿色说明告知 Firebase 是主要安全网

**为什么改**
诊断结果：
- 本地 localStorage 总用量 5.06 MB（接近浏览器 5–10 MB 上限）
- `ticket-organizer-rolling-backup` 占 4.21 MB（83%！）
- 已出票截图已清空（0 张）— 不是它的问题
- 真正主数据 settings 才 866 KB（健康）

用户选择"取消出票快照"方案：彻底关掉自动备份，本地不再因每次出票而膨胀。

**保留了什么**
- ✅ `saveRollingBackup` 函数本体不删 — 手动按钮还在用，未来想恢复自动也能立刻加回 await 调用
- ✅ `restoreFromRollingBackup` 完整保留 — 现有快照（trim 后 2 个）仍可恢复
- ✅ 设置面板的「💾 立即保存一个快照」手动按钮 — 用户应急时仍能手动存
- ✅ Firebase 云同步、Google Sheets 同步、GitHub Gist 备份全部不动

**风险或注意事项**
- ⚠ **现在唯一的"撤销"机制是 Firebase 历史 + 手动快照**。如果某次操作出错（比如误删订单），不能再像以前那样回到"出票前 10 秒的快照"
- ⚠ **建议在重大操作前主动点一下「💾 立即保存一个快照」**（设置 → 本地手动快照 区域）。比如批量补录前 / 大规模合并卡主前 / 任何不可逆操作前
- ⚠ Firebase 端**不保留版本历史**（test mode 规则下没开启 versioning）。如果数据被错误的同步覆盖到云端，本地手动快照是唯一回退路径
- ⚠ 加载时的 trim 是**自动且不可撤销**的：现有的 5 个快照保留最新 2 个，老的 3 个会被删。如果你想保留某个老快照，下一版部署前先到 Application → Local Storage 手动备份 `ticket-organizer-rolling-backup` 的 JSON

**预期效果**
- localStorage 总用量从 5.06 MB → 约 1.7 MB（trim 后第一次加载）
- 出票后局部用量不再随每次出票膨胀
- 红色 "本地存储已满" 警告消失
- 出票速度可能略快（少 1 次大文件写入 localStorage）

**改动位置**
- `index.html` 行 22190：`ROLLING_BACKUP_SLOTS = 5` → `= 2`
- `index.html` 行 22411 附近：加 `_trimRollingBackupRing()` IIFE
- `index.html` 行 18618：删 `await saveRollingBackup` (批量)
- `index.html` 行 19066：删 `await saveRollingBackup` (手动补录)
- `index.html` 行 22553：删 `await saveRollingBackup` (出票前)
- `index.html` 行 22609：删 `await saveRollingBackup` (出票后)
- `index.html` 行 3675-3682：设置面板 hint 文案改写

**回滚方式**
从 `.backups/` 找上一版 `index.html` 覆盖即可。注意：**回滚不能恢复被 trim 掉的旧快照**（已物理删除）。如果想恢复"每次出票自动快照"机制，回滚后无需任何改动即可恢复 5-slot 行为；如果想保持函数体但加回自动调用，告诉我下一版部署做。

---
