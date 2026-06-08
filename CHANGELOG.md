## 2026-05-23 — 新增黑名单乘客功能

**改了什么**
新增黑名单乘客名单：录入订单时，如果乘客姓名命中黑名单，弹窗强提醒（订单仍照常录入）。

**为什么改**
用户需求：「有些名字是黑名单，增加黑名单乘客名字记录功能」

确认的需求：
- 撞到黑名单 → 强提醒（弹窗警告，但能继续）
- 只按姓名匹配（如 ZHANG/SAN）
- 只存名字，不要原因/备注

**功能组成**
1. **黑名单管理界面**（设置 → ⛔ BLACKLIST）：添加/查看/删除黑名单姓名
2. **录入强提醒**：解析订单后，若有乘客命中黑名单，弹窗列出所有命中的姓名
3. **订单行徽章**：命中黑名单的订单行显示黑色「⛔ 黑名单」徽章，点击看详情

**匹配规则（只按姓名）**
- 规范化匹配：大小写、空格、斜杠两边空格都会被统一
- "ZHANG/SAN" = "zhang/san" = "ZHANG / SAN" 视为同一人
- 不涉及出生日期/护照号

**单元测试 13/13 全过**
- ✓ 添加 / 重复添加被拒（规范化去重）
- ✓ 命中匹配（大小写、空格、斜杠变体都命中）
- ✓ 不在名单不误判
- ✓ 订单乘客检查（多乘客命中部分）
- ✓ null/空对象安全
- ✓ 删除后不再命中

**怎么用**
1. 设置 → ⛔ BLACKLIST → 输入姓名（如 ZHANG/SAN）→ 加入黑名单
2. 以后录入订单时，若乘客命中，会弹窗：
   "⚠️ 黑名单提醒：以下乘客在黑名单中：• ZHANG/SAN。请谨慎处理！（订单仍会照常录入）"
3. 命中的订单在待出票列表显示黑色「⛔ 黑名单」徽章

**新增字段/函数**
- settings.blacklist（姓名数组）
- normalizeBlacklistName / isBlacklisted / orderBlacklistHits / addToBlacklist / removeFromBlacklist
- renderBlacklistList / addBlacklistName / removeBlacklistName（UI）

**改动位置**
- index.html DEFAULT_SETTINGS：加 blacklist 字段
- index.html loadSettings：blacklist 数组保护
- index.html computeFinalPrice 前：黑名单工具函数
- index.html 解析完成处：录入弹窗强提醒
- index.html 订单行徽章：加 ⛔ 黑名单徽章
- index.html 设置面板：加 BLACKLIST 管理 section
- index.html renderOperatorsList 后：黑名单 UI 函数

**风险或注意事项**
- ⚠ 只按姓名匹配。同名不同人也会触发提醒（但因为是"强提醒可继续"，不会误拦）
- ⚠ 黑名单存在 settings 里，会随 Firebase 同步到所有设备
- ⚠ 弹窗用 alert（强提醒但不阻断），录入照常完成

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后黑名单功能消失（已存的 blacklist 数据保留但不再生效）。

---
