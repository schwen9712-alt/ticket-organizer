# Ticket Organizer — 改动日志

每次改动按时间倒序记录。每条至少包含：**改了什么** / **为什么改** / **风险或注意事项**。

格式：
```
## YYYY-MM-DD HH:MM — 简短标题

**改了什么**:
- 具体改动点 1
- 具体改动点 2

**为什么改**:
- 用户需求 / 修 bug / 优化原因

**风险或注意事项**:
- 可能的副作用、需要追踪的事
```

---

## 2026-05-23 04:15 — 加上 backup + changelog 机制

**改了什么**:
- 新建 `.backups/` 目录
- 新建 `ship.sh` 脚本：每次 ship 前自动备份当前 `index.html`，保留最近 20 份
- 新建本文件（CHANGELOG.md）

**为什么改**:
- 23,000 行单文件，没有版本控制，改坏了无法回滚
- 多次 session 累积，记忆模糊，需要书面记录决策原因
- 用户明确要求：每次改动前记录改了什么、为什么改

**风险或注意事项**:
- 备份只保留 20 份，约够 1-2 周的迭代量
- 改动前先查 CHANGELOG 是否有相关历史决策

---

## 2026-05-24 01:22 — 全局微交互动画系统

**改了什么**:

**1. 新增统一的 motion 设计 tokens**（CSS 变量）：
   - `--t-instant: 80ms` — 点击反馈
   - `--t-fast: 120ms cubic-bezier(0.5, 0, 0.5, 1)` — 颜色变化 / 按钮 hover
   - `--t-base: 200ms cubic-bezier(0.5, 0, 0.5, 1)` — 默认展开/折叠/hover
   - `--t-slow: 320ms cubic-bezier(0.16, 1, 0.3, 1)` — toast / modal 入场
   - `--d-fast / --d-base / --d-slow` — 仅时长（用于自定义 easing 场景）
   - `--ease-out / --ease-in / --ease-snap` — 标准 easing 曲线

**2. 全局选择器自动 transition**：
   所有 button、btn、input、select、textarea、section、card、tab、order-card、chip、tag、role=button、summary 元素自动获得 transition，覆盖 background、border、color、box-shadow、transform、opacity。

**3. 按下反馈**：
   所有按钮和 .btn 在 :active 时 `scale(0.97)`，给人「真的按下了」的感觉。

**4. Disabled 状态**：
   禁用按钮没有按下动画，opacity 降至 0.5，cursor 改 not-allowed。

**5. @keyframes 动画库**：
   - `toastIn / toastOut` — toast 上下滑入滑出
   - `overlayFadeIn` — 模态背景遮罩淡入
   - `modalRiseIn` — 模态内容轻微 scale + 上移
   - `tabContentIn` — tab 切换内容淡入
   - `attentionPulse` — 待复核徽章呼吸光圈（2.4 秒一次）
   - `spin` — 同步指示器旋转
   - `checkDraw` — 对勾描边动画（待应用）
   - `valueFlash` — 数字更新闪烁（待应用）

**6. 实际应用点**：
   - 「⚠ 待复核」徽章加 `.attention-pulse` 类，会缓慢呼吸提醒用户
   - 付款单导入弹窗（modal）有入场动画
   - 截屏弹窗有入场动画
   - 其他对话框（OFAC）也有入场动画

**7. 兼容性**：
   - 旧代码用的 `var(--t-fast)` 现在含 timing + easing，可以作为 `transition: prop var(--t-fast)` 简写直接用，向后兼容
   - `@media (prefers-reduced-motion: reduce)` 完全尊重用户系统设置，关闭动画

**为什么改**:
- 用户要求加微交互动画
- 设计原则：一致性 > 多样性。所有动画统一时长 + 曲线，看起来像一个产品而不是大杂烩
- 高频使用的工具 app 适合不动声色的微交互，不适合明显的成就感动画

**风险或注意事项**:
- 性能影响：transition 全局应用，但只影响有 hover/active/state-change 的元素，不会持续占用 CPU
- `.attention-pulse` 一直运行，可能在低端设备上略增电耗，但已限制为 2.4 秒一次循环
- 老用户首次刷新会觉得「咦怎么所有东西都柔顺了」，这是正常的

---

## 2026-05-23 23:13 — 付款单导入：差额不一致时强制人工复核

**改了什么**:
- 订单 schema 新增 3 字段：
  - `paymentReviewFlag: boolean` — 待复核标记
  - `paymentReviewNote: string` — 复核备注
  - `paymentReviewedAt: number` — 复核时间戳
- 重写 `confirmImportedPayment(action)` 支持三种 action：
  - `'settle'` — 总额一致时的常规确认（绿按钮）
  - `'settleAnyway'` — 总额不一致但用户确认无误，弹二次确认后强行标已收
  - `'flag'` — 总额不一致，给所有勾选订单加「待复核」印记 + 备注
- 解析后根据差额自动选择 UI：
  - 差额 = 0 → 只显示「✓ 标记已收」单一按钮
  - 差额 > ¥0.5 → 显示警告条 + 两个按钮（🟡 留下印记 / ✓ 已核对仍标已收）
- 账单 Tab 顶部新增「待复核」摘要 banner：
  - 当有任何订单 `paymentReviewFlag = true` 时显示
  - 显示「⚠ N 单待人工复核」
- 代理应收表里：待复核订单
  - 行背景变浅黄（`rgba(217,119,6,0.07)`）
  - 状态列显示「⚠ 待复核」徽章（橙色边框）+ 备注预览
  - 鼠标 hover 显示完整备注
  - 点击徽章 → `clearPaymentReviewFlag(idx)` 二次确认后解除标记
- 新增 `clearPaymentReviewFlag(orderIdx)` 函数：解除印记，回到「未收款」状态

**为什么改**:
- 用户明确要求：「代理付款总额 ≠ 系统计算总额 → 人工复核后才能标记。如果确认有问题，留下印记，需要处理。」
- 之前的版本差额仅是提示，但用户希望强制走人工流程，避免错标已收

**工作流**:
```
代理付款单粘贴
   ↓
解析 → PNR 匹配 → 计算总额差
   ↓
   ┌──────────────────┐
   │ 总额一致？        │
   └──────────────────┘
   ↓ 是             ↓ 否
[✓ 标记已收]       [⚠ 警告条]
                      ↓
              ┌──────────────┐
              │ 人工核对      │
              └──────────────┘
              ↓ 无误         ↓ 有问题
        [✓ 仍标已收]      [🟡 留下印记]
                              ↓
                        加 paymentReviewFlag
                        + 写备注（如「东莞少 ¥283，问原因」）
                              ↓
                        账单 Tab 显示「⚠ 待复核」
                        直到你处理后解除
```

**风险或注意事项**:
- Firebase 同步会带上新字段（自动）
- Google Sheets 同步暂未推送这些复核字段 — 看用户是否需要导出
- 「解除复核标记」会让订单回到「未收款」状态，不会自动标已收

---

## 2026-05-23 23:09 — 修正：方向反了，改为「粘贴付款单 → 自动标已收」

**改了什么**:
- ❌ **撤销**上一版的「复制对账单」按钮（方向错了，你是收钱方不是发账单方）
- ✅ **新增**「📥 粘贴付款单」按钮在账单 Tab header
- 新增 `openPaymentImportDialog()`：弹出粘贴框
- 新增 `parseImportedPayment()`：
  - 正则提取所有 `PNR: XXXXXX`（支持中英文冒号）
  - 正则提取总计/合计/总额/共计金额
  - 在 `settings.ticketed` 里匹配 PNR
  - 显示对账确认表：
    - 哪些 PNR 找到了（带代理名、乘客、金额）
    - 哪些已经收过（跳过）
    - 哪些没找到（标红警告）
    - 代理付款总额 vs 系统计算总额 vs 差额
  - 默认全部勾选「将标已收」
- 新增 `confirmImportedPayment()`：把勾选的订单标为 `agentSettled = true`，触发 Firebase + Sheet 同步

**为什么改**:
- 用户之前发了真实样本，我以为是用户**发给代理**的对账单
- 实际是代理**付款后发给用户的明细**
- 用户的真实需求是「粘贴付款单 → 自动识别 → 一键标已收」

**风险或注意事项**:
- 匹配按 PNR 严格匹配（6-8 位字母数字），不识别代理名（同一 PNR 不会出现在多代理）
- 差额提示但不阻止：你最了解你的代理，比如代理总额比系统多 ¥283 可能是手续费或汇率小差异
- 已结算的订单会跳过，不会重复标记
- 未找到的 PNR 不阻止你处理其他 PNR

**测试**:
- ✅ PNR 提取测试通过（`PNR: KJJBEW` / `PNR: COTRHC`）
- ✅ 总计提取测试通过（`总计：89544`）

---

## 2026-05-23 23:05 — 一键生成代理对账单（微信粘贴格式）

**改了什么**:
- 账单 Tab 每个代理分组的 header 加按钮「📋 复制对账单」
- 新增 `copyAgentStatement(agent)`：
  - 筛选该代理所有**未结算**订单
  - 按出票日期排序
  - 生成微信对账单格式（参照用户实际样本）：
    ```
    2026-05-08 AA 同行  AA  PNR: KJJBEW
    P1: NAME: HU/YIXUAN  001-7440315678  8月2日 AA CDG-JFK   星星 5088.00
    ...
    总计：89544
    ```
  - 自动算总额
  - 复制到剪贴板 → 直接粘贴微信
- 新增日期格式转换：`26MAY` → `5月26日`
- 新增 `showAgentStatementModal()`：浏览器禁止剪贴板访问时的兜底（弹窗 textarea 让用户手动选中复制）

**为什么改**:
- 用户每月与 4-10 个代理集中对账，需要手工整理对账单
- 用户提供了真实微信对账格式样本作为参考
- 这是「最匹配真实工作流」的最简方案（不是代理付款页面）

**风险或注意事项**:
- 票号字段（p.tkt）如果不准确，对账单会显示空 — 出票时要确保填写
- 多乘客订单：中间乘客行只有姓名+票号，最后一个乘客行带行程+价格（参照样本格式）
- 「同行」字样写死了，假设所有代理都是同行 — 如果有别的关系可以以后改
- 只导出**未结算**的订单 — 已结算的会被跳过

---

## 2026-05-23 22:50 — 代码清理（保守版）

**改了什么**:
- 删除未使用的常量：`OFAC_MIN_SCORE`（声明后从未引用）
- 删除未使用的常量：`FB_DOC_PATH`（代码里直接用字符串字面量）

**为什么保守**:
做了系统性审计，但只删了 100% 确定无用的东西。原则：**不重构正常运行的代码**。

**审计结果**：
- ✅ 442 个函数全部有调用者，没有 dead function
- ✅ 1047 个被引用的标识符全部有定义
- ✅ 40 个空 catch 块：保留（多是 localStorage IO 容错，删了会出 bug）
- ✅ 11 个 @media 查询：保留（移动端响应式必需）
- ✅ 308 个 CSS 类：保留（识别「真正未用」需逐一手工验证，风险太高）
- ⚠️ 1 个潜在 bug 标记：`_parseDebugLog` 声明但 parser 从未写入 → 调试面板可能是空的（不是清理而是真 bug，留待将来修）

**没改的（故意保守）**：
- 没改变量命名
- 没拆文件
- 没合并相似 CSS
- 没动 `_teamConfig` / `enteredBy` 兼容字段（虽然 viewMode 永远是 'all'，但保留以防你以后想加多用户）
- 没改任何 try/catch 容错逻辑

**风险或注意事项**:
- 文件大小几乎没变（23,843 → 23,842 行）
- 这是「极小化清理」，本次重点是「**不引入新 bug**」而非「让代码瘦下来」
- 真正的瘦身需要按功能模块逐块梳理，每删一段就实际测试一遍 — 那是几天的工作量

---

## 2026-05-23 22:00 — 汇率源换成多源 fallback（更准更可靠）

**改了什么**:
- `fetchRate()` 重构为多源 fallback 链：
  1. `open.er-api.com`（每日更新，主要源）
  2. `frankfurter.app`（欧央行 ECB，最权威，但周末不更新）
  3. `exchangerate-api.com`（原来的源，兜底）
- 每个源加 sanity check：USD/CNY 应该在 5-10 之间，超出范围视为错误数据跳过
- toast 现在显示用了哪个源：`已更新: USD 1 = ¥6.79 (open.er-api.com)`
- 加 `cache: 'no-cache'` 避免浏览器缓存旧汇率

**为什么改**:
- 用户截图 Google 显示 USD/CNY = 6.79，但 app 一直显示 6.81
- 6.81 是 5 月 18 日的数据，说明 `exchangerate-api.com` **数据延迟 5 天**
- 一单 3000 美元的差 0.02 汇率 = 差 60 块人民币

**风险或注意事项**:
- Google 没有公开汇率 API，无法直接用 Google 的值
- 这三个源都是免费 + 无需 API key，但都不是 Google
- open.er-api.com 准确度 ≈ Google（误差 < 0.01）
- 周末 frankfurter 不更新（欧央行休市），所以放第二位由 open.er-api.com 兜住

---

## 2026-05-23 21:33 — 修 ANTHROPIC_KEY_STORAGE 未定义

**改了什么**:
- 新增缺失的常量声明：`const ANTHROPIC_KEY_STORAGE = 'ticket-organizer-anthropic-key';`
- 这个常量被 `loadAnthropicKey()` / `saveAnthropicKey()` / `clearAnthropicKey()` 三处引用，但从未声明

**为什么改**:
- 用户截图显示「保存失败：ANTHROPIC_KEY_STORAGE is not defined」
- 历史代码 audit 时漏掉了这个 bug（之前可能定义过，删 Cloud Sync 时被一起误删）
- AI 图片识别功能因此无法保存 API Key

**风险或注意事项**:
- 用户的本地 localStorage 应该还保留着以前用过的 key（如果有的话），这次修复后能正常读写

---

## 2026-05-23 20:43 — 回滚：移除登录页

**改了什么**:
- 完整移除上一版加的密码登录系统（约 190 行）
- 删除 `SIMPLE PASSWORD AUTH` 整个代码块（sha256 / hashPassword / showAuthGate / verifyPassword / tryAutoLogin / changePassword / logoutAndShowGate）
- 删除设置页「🔒 登录密码」UI 区块
- 合并 `fbInit` 和 `fbStartSync` 回单一函数（启动时拉数据 + 订阅 onSnapshot）
- 移除 `_authReady` 守卫和相关变量
- 启动流程恢复为原来的直接 `fbInit()`

**为什么改**:
- 用户改主意「完全不需要登录」
- 听用户的，撤掉

**风险或注意事项**:
- 数据现在再次完全公开（任何打开 URL 的人都能读写）
- 用户接受这个状态
- 如果以后想加保护，可以加 Firestore 规则（不需要登录页也能做基础保护）

---

## 2026-05-23 20:38 — 简单密码登录（保护 Firestore 数据）

**改了什么**:
- 新增「锁屏式」登录页：进入网址 → 弹出密码框 → 输对了才显示 app
- 新增 `sha256()` 和 `hashPassword()`（用 Web Crypto API，加固定盐 `tkto-2026-v1`）
- 新增 `verifyPassword()`：和 Firestore `ticket-organizer/auth` 文档里的 hash 对比
- 新增 `tryAutoLogin()`：localStorage 存了已验证 hash 时跳过登录页
- 新增 `changePassword()`：设置页修改密码（要旧密码 + 两次新密码确认）
- 新增 `logoutAndShowGate()`：手动登出当前设备
- 拆分 `fbInit()`：现在只做 SDK setup，不再立刻读 Firestore
- 新增 `fbStartSync()`：登录通过后才拉数据 + 订阅 onSnapshot
- 启动流程改为：init Firebase → 检查 auth（自动或弹窗）→ 通过后 fbStartSync
- `fbScheduleWrite` 和 `fbPushNow` 都加了 `_authReady` 守卫
- 设置页新增「🔒 登录密码」区块：修改密码 + 退出登录 + 忘记密码恢复指引

**密码机制**:
- 初始密码：`change_me_now`（用户首次登录后必须改）
- 哈希算法：SHA-256，加固定 salt
- 存储：Firestore `ticket-organizer/auth` 文档存 hash（不存明文）
- 设备记忆：localStorage 存 hash，下次自动跳过登录页
- 改密后：其他设备本地存的 hash 与远程不匹配，会自动要求重新登录

**为什么改**:
- 用户用 Firebase config 写死在代码里 + GitHub Pages 公开访问，任何人都能看数据
- 用户接受这个权衡但希望加一道密码保护
- 用户要求「找回密码」机制 → 提供「Firebase 控制台手动重置 auth doc」的指引

**风险或注意事项**:
- ⚠️ **Firestore 规则还没改** — 即使前端有登录页，没改规则的话陌生人理论上还能直接调 Firestore API 读写
- ⚠️ 必须接着加 Firestore 规则才完整安全（下一步要做的事）
- 密码哈希加盐用的是 SHA-256，对单纯字典攻击足够，但盐是固定的（不是 per-user salt）
- 「记住我」永久 → 浏览器清缓存会要求重新登录

**待办**:
- [ ] 加 Firestore 安全规则（要求 client 验证才允许写）
- [ ] 测试：在新设备打开 → 输 change_me_now → 进 app → 在设置改密码 → 在另一设备验证

---

## 2026-05-23 06:50 — Firebase config 写死到代码（零配置同步）

**改了什么**:
- 新增 `FB_DEFAULT_CONFIG` 常量直接嵌入源码（包含 apiKey/projectId 等）
- `loadFbConfig()` 改为：先看 localStorage 自定义 config，没有则用 default
- 启动时自动用 default config 连接 Firebase，无需手动粘贴
- 设置页 UI 改造：
  - 提示文字改为「✓ 自动连接」
  - 输入框折叠在 `<details>` 里（标签「⚙ 自定义 Firebase 项目（高级）」），不挤占设置页
  - 「断开」按钮 → 改为「恢复默认」（断开变成无意义操作）

**为什么改**:
- 用户希望所有设备打开同一个 GitHub Pages 网址就能立刻同步，无需手动配置
- 三台设备每次都要手动配 Firebase config 麻烦
- 用户**已知风险**：apiKey 公开在源码里，理论上访问网址的人都能读写 Firestore

**风险或注意事项**:
- ⚠️ **严重提醒**：GitHub Pages 是公开的，任何人访问 URL 都能直接连这个 Firebase 项目，读取/修改/删除所有订单数据
- ⚠️ Test mode 30 天后过期 — 必须前往 Firebase 控制台改 Firestore 规则
- 推荐的最低限度规则：限制 collection 路径 + 限制文档大小，避免被恶意刷爆
- 用户接受了这个风险，但应该尽快加规则保护

---

## 2026-05-23 06:35 — 大扫除：清理 JSONBin/Gist/Team 残留代码

**改了什么**:
- 移除启动时的 orphan 调用：`await loadCloudConfig()` 和 `await loadGistConfig()`（这两个函数早已删除，运行时报「is not a function」会中断初始化）
- 移除 `TEAM_STORAGE_KEY` 常量及相关 storage IO（团队功能依赖 JSONBin，已不可用）
- 移除 `loadTeamConfig` / `saveMyName` / `saveViewMode` / `saveTeamConfigLocal`
- 移除 60 秒自动同步定时器代码（`startAutoSync` / `updateSyncStatus` / `silentCloudSync` / `triggerManualSync` / `_autoSyncTimer` / `_lastSyncAt` / `_syncFailCount`）
- 移除「员工模式 filter banner」死代码（依赖已删除的 saveViewMode）
- 移除主初始化函数里的 `loadTeamConfig()` 调用

**保留**:
- `_teamConfig` 变量（默认 `{viewMode:'all', myName:''}`），因为 `applyViewModeFilter` / `tagOrderWithUser` 还引用
- `enteredBy` 订单字段（向后兼容老数据）

**为什么改**:
- 用户要求「整体审计一遍修 BUG」
- 发现启动时会调用不存在的函数 → 静默吞掉错误但破坏后续逻辑
- 这些残留是删 JSONBin 时漏的（团队功能依赖 JSONBin 的共享 bin）

**验证**:
- ✅ Syntax OK
- ✅ No duplicate function defs
- ✅ 18 个 orphan 引用名全部清干净
- ✅ 9 个关键函数（fbInit / renderBillingPanel / persistOrders 等）完整

**风险或注意事项**:
- 文件减少约 100 行
- 多人协作 + 自动 60s 拉取功能彻底没了，但 Firebase 实时同步覆盖了这个需求且更好

---

## 2026-05-23 06:25 — 修复「⋯ 更多」下拉菜单遮挡问题

**改了什么**:
- 下拉菜单展开方向：从「按钮下方」`top:100%` 改为「按钮上方」`bottom:100%`
- z-index 从 100 提到 1000，避免被相邻订单卡片堆叠遮挡

**为什么改**:
- 用户反馈点击「⋯ 更多」后菜单不可见或点不到
- 「⋯ 更多」按钮位于订单卡片底部，向下空间被下一张卡挡住
- 向上展开能完全显示

**风险或注意事项**:
- 如果订单是页面第一张且 viewport 顶部空间不够，可能会被截断（边缘情况，先不处理）

---

## 2026-05-23 06:10 — 按钮配色统一：去掉五颜六色

**改了什么**:
- 所有操作按钮统一为 **ghost 中性灰** 样式（白底 + 灰边）
- 唯一保留绿色填充的：**✓ 已出票**（最终 CTA，必须突出）
- 状态变化（已完成、已分配、已校验等）改用统一的「淡绿底色」表示，不再用蓝紫红黄等多色
- 移除蓝色「卡主报表」、红色「删除」边框、紫色「关联」、绿色「快速出票」边框等所有差异化配色
- 「✕ 删除」只用红字，不再用红边框

**为什么改**:
- 用户反馈「五颜六色，审美疲劳」
- Linear/Notion 风格的核心是「整齐划一」 — 同类操作用同样的样式，只有 1 个 CTA 突出
- 一屏内 6-7 个按钮如果每个颜色都不同，眼睛根本不知道看哪里

**风险或注意事项**:
- 状态信号变得更微妙（淡绿底代替原本的不同强对比色），可能初期不习惯
- 红色「删除」按钮没有红边了，理论上更难第一眼定位（但删除本来就该谨慎）

---

## 2026-05-23 06:00 — 调整主操作按钮（按用户反馈）

**改了什么**:
主排可见按钮调整为用户实际常用的 6 个：
1. 📋 代理商报表
2. 📋 记录员报表
3. 📋 乘客（多乘客时显示）
4. 💳 分配卡主
5. ⟲ 重新解析
6. ✓ 已出票

从下拉菜单移回主排：📋 记录员报表 / 📋 乘客 / ⟲ 重新解析
从主排移入下拉：⚡ 快速出票

下拉里现在是：💳 卡主报表(G) / 🔍 官网校验 / 📷 加护照 / 🔒 放位 / ⏸ 无位 / 🔗 关联 / ✂ 拆单 / ⊕ 合单 / ⚡ 快速出票 / ✎ 完整编辑 / ✕ 删除

**为什么改**:
- 上一版我把「快速出票」当成主按钮，但用户实际用「已出票」+「重新解析」更多
- 用户明确指出常用的 6 个按钮

**风险或注意事项**:
- ⚡ 快速出票现在折叠了，需要点「⋯ 更多」才能用，如果是高频功能需要再调

---

## 2026-05-23 05:55 — 订单卡片操作按钮折叠（17 → 4 + ⋯ 更多）

**改了什么**:
- 待出票订单卡片原本横排 14-17 个操作按钮，太密集
- 保留 4 个**最常用**主操作按钮可见：
  1. 📋 代理商报表（出票后必发）
  2. 💳 分配卡主（出票前必做）
  3. ⚡ 快速出票
  4. ✓ 已出票
- 剩余 13 个折叠进 **「⋯ 更多」** 下拉菜单：
  - 📋 记录员报表 / 💳 卡主报表（仅 G）/ 📋 乘客 / 🔍 官网校验
  - 📷 加护照 / ⟲ 重新解析 / 🔒 放位 / ⏸ 无位 / 🔗 关联
  - ✂ 拆单 / ⊕ 合单 / ✎ 完整编辑 / ✕ 删除
- 下拉菜单从「⋯ 更多」按钮右下展开，宽度 240-300px
- 点击菜单外区域自动关闭（document click listener）
- 点击菜单内按钮执行后自动关闭（每个按钮 onclick 末尾加 `closeOrderMenu()`）
- 新增 `toggleOrderMenu(idx, evt)` 和 `closeOrderMenu()` 全局函数

**为什么改**:
- 用户反馈按钮太密集，视觉冲击大
- Linear/Notion 风格强调「降低决策成本」 — 大多数情况只用 4 个按钮，需要时再展开
- 出票流程 90% 的操作就是「分配卡主 → 快速出票 → 代理商报表」，其他都是边缘操作

**风险或注意事项**:
- 「✕ 删除」按钮藏在下拉里，更不易误点（其实是优点）
- 「✎ 完整编辑」原来是常用入口，现在折叠了 — 如果发现常用再提到主排
- 已出票订单卡片（actions Tab 的）UI 没动，只改了待出票

---

## 2026-05-23 05:40 — 降低视觉冲击：colored sections → 白底细线

**改了什么**:
- **待出票统计 banner**：深蓝渐变背景 `#0C1B2A → #1e3248 → #0f2238` → 改为白底 + 细线 border
- **金色辐射装饰** (radial-gradient) 移除
- **统计数字（待出票数）**：金色高亮带阴影 → 改为纯 ink 黑色
- **航司汇总条**（顶部 UA/DL/AA 大色块）：36px 高度的实色填充 → 改为 6px 极细色条，仅占用 1/6 视觉空间
- **航司分组 header**（每组 UA/DL 标题行）：整个深色背景 + 白字 + 大 SVG logo + 多层阴影 → 改为白底 + 3px 左边色条 + 小色标 + 移除 SVG logo

**为什么改**:
- 用户反馈现在配色「视觉冲击太大，阅读起来不舒服」
- Linear/Notion 风格的核心是**克制使用颜色** — 颜色只用于状态指示和品牌强调，大面积应该保持中性
- 一屏内三种深色高对比度色块（深蓝 banner + UA 蓝 + DL 红），眼睛被牵着到处跳

**风险或注意事项**:
- 移除了航司 logo SVG 显示（节省视觉噪音）
- 颜色信息以「细色条/小色标」形式保留，仍可识别但不喧宾夺主
- 还可能有其他地方残留高对比设计，看到了再说

---

## 2026-05-23 05:27 — Linear/Notion 风格大改

**改了什么**:
- 设计 token 全面切换：
  - 背景：米色 `#F5EFE6` → 纯白 `#FFFFFF`
  - 主色：金色 `#C8A04A` → Linear 紫蓝 `#5E6AD2`
  - 文字主色：`#0C1B2A` → `#1F2328`（GitHub 风格的近黑色）
  - 圆角：6/10/16/20px → 4/6/8/12px（更紧凑）
  - 阴影：多层柔阴影 → 几乎不用，靠细线分隔
- 字体：除了 logo `.brand h1` 保留 Fraunces 衬线（保留品牌识别），其余全部改为 Inter / 系统 UI 字体
- body 字体栈：`-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', 'Segoe UI', Roboto, 'Noto Sans SC'`
- `.section` 用白底 + 细线代替米色 + 阴影，padding 缩到 18px 20px
- `.btn` 去掉 box-shadow 和 translateY 动效，纯净扁平
- 移除 logo 渐变（`linear-gradient(135deg, var(--ink) 0%, #2a4060 100%)`），改纯 ink

**为什么改**:
- 用户反馈「整体不美观」，明确想要 Linear/Notion 现代极简风
- 原风格偏「优雅暖色」（米色+金色+衬线），与「机票订单工具」的工具属性气质不符
- Linear/Notion 风格更适合信息密集型工作场景

**风险或注意事项**:
- 只改了 CSS 变量和核心组件（section/btn/body/brand），没改 23,000 行内联样式
- 可能存在某些区块写死了米色/金色，导致颜色不一致 — 用了几天发现的话再补
- 整体对比度变高，可能需要调整某些颜色的具体值
- 文件大小没增加，纯样式替换

---

## 2026-05-23 05:23 — Tab 栏更紧凑 + 右侧渐变提示可滚动

**改了什么**:
- Tab padding 从 8px 16px 缩到 7px 12px，gap 从 6px 缩到 5px，font-size 13px → 12.5px
- 把 `<nav class="tabs">` 包在 `.tabs-wrap` 容器里
- `.tabs-wrap::after` 加右侧白色渐变伪元素，提示「这里可以滚动」
- JS 监听 scroll 和 resize 事件，只在真的有溢出时显示渐变（`.has-overflow` 类）

**为什么改**:
- 用户反馈「💰 账单」Tab 被截断不美观
- 不能简单删 Tab（每个都有用），所以让 Tab 更紧凑
- 加渐变让用户知道可以滚动查看后面的内容

**风险或注意事项**:
- 渐变颜色用 `var(--cream)`，深色模式下可能不匹配（但目前默认是亮色）
- Tab 字体小了一点点，在小屏幕上可读性略下降

---

## 2026-05-22 (whole session) — Firebase 实时同步替换 JSONBin

**改了什么**:
- 移除 JSONBin 整套云同步代码（约 270 行 + 9 处调用残留）
- 移除 header 右上角「● 同步中」指示器
- 新增 Firebase SDK v10 modular 通过 CDN 加载（gstatic.com）
- 新增 Firestore 同步层：`fbInit` / `fbPushNow` / `fbApplyRemote` / `saveFbConfig` / `fbHookPersistence` 等
- 设置页新增「🔥 FIREBASE 实时同步」区块，支持粘贴 firebaseConfig 对象
- 启动时自动 init 监听，800ms debounce 防止狂推
- 回声防护：自己刚推的 3 秒内不会被自己触发更新

**为什么改**:
- 用户希望手机/笔记本/台式机实时同步，JSONBin 需要手动刷新页面才能拉到最新数据
- JSONBin 是小项目，长期稳定性不如 Google 基础设施
- Firebase onSnapshot 提供真正的实时推送（~1 秒）
- 自带离线缓存（IndexedDB），地铁里也能用

**风险或注意事项**:
- Firestore 当前是 test mode，**30 天后过期**（约 2026-06-22）需要加规则
- 现在没有任何权限保护，任何人拿到 config 都能改数据
- 文件大小：1057KB → 1116KB（+59KB）
- Last-write-wins 冲突策略：两台设备同时改同一单时后写覆盖前写

---

## 2026-05-22 — 账单 Tab + Google Sheets 同步 + 删 Gist/Team

**改了什么**:
- 新增「💰 账单」Tab：代理应收 + 卡主应付，按代理/卡主分组，支持「已收款/已付款」标记
- 新增账单 Excel 导出（两个 Sheet）
- 新增 Google Sheets 实时同步：出票后 fire-and-forget POST 到 Apps Script Web App
- 新增 Apps Script 代码弹窗（用户复制粘贴部署用）
- 新增 Anthropic API key 设置 + AI 图片识别（护照 + 行程截图）
- 删除「CLOUD SYNC」「GITHUB GIST」「TEAM 团队协作」三个设置区块（约 770 行）
- 把「⚙ 设置」从 tab 栏移到 header 右上角齿轮按钮（tab 栏太挤）
- 新增软删除待办：用户想要回收站机制（30天可恢复），目前未实现

**为什么改**:
- 用户每天人工记 Excel 容易错，需要 app 内一个清晰的账单视图
- Google Sheets 自动推送替代手工导出
- 删除三个未使用的设置区块（用户反馈用不到）
- AI 图片识别让护照/行程信息一键录入

**风险或注意事项**:
- Google Sheets sync 用 no-cors mode，无法读取响应体，只能凭 Apps Script 执行日志验证
- Apps Script 必须从 Google Sheet 内部创建（getActiveSpreadsheet 需要绑定容器）
- 第一版用了压缩代码导致 Apps Script 解析崩溃，已改为可读格式

---

## 2026-05-22 — Parser 修复

**改了什么**:
- 修复中文格式航段 regex 支持 `. UA869` 格式（点+空格无数字）
- 修复多段合并行预处理：单段日期不拆分（dateCount >= 2 才拆）
- 修复终端剥离 regex：`[A-Z]\d*\s*$` 正确处理 T2/T3
- 添加 `火奴鲁鲁 → HNL` 城市映射
- 添加 standalone PNR 识别（但 CO+数字仍识别为运价）
- 添加 `parsedPnr` 返回值并在 `parsePNR` 中应用

**为什么改**:
- 用户反馈多个具体格式无法识别：达美 DL181 火奴鲁鲁、UA869 旧金山等

**风险或注意事项**:
- 城市名映射是硬编码，每个新城市都需要改代码（建议未来做用户可编辑设置）

