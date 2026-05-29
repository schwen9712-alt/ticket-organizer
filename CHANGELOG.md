## 2026-05-23 — 拦截可人工释放 + 全新可视化拦截 UI

**改了什么**
1. **所有重复/行程拦截都可人工释放**：之前 STRONG 拦截用 alert() 直接挡死（无法录入），现在每条拦截都有「🔓 我已核实，强制录入」按钮
2. **全新可视化拦截 modal**：替换掉旧的 alert()/confirm() 纯文字弹窗，改为美观的卡片式 modal
3. **再次代码审计**：移除未使用的 strongCount 变量，修正 summary 跳过数统计逻辑

**新 modal 长什么样**
- 顶部：图标 + 标题（行程冲突🚫 / 重复订单⚠️）+ "所有拦截都可人工放行"提示
- 中部：每个冲突一张卡片
  - 彩色徽章标明类型：🧭位置冲突 / ⏱时间冲突 / 🔁已出票重复 / 🔁待出票重复 / ✈接续行程 / ❓可能相关
  - 冲突原因（红/橙色）
  - 新录入 vs 已存在 的航班对比（等宽字体网格）
  - **STRONG 卡片**：「🔓 我已核实，强制录入」按钮，点击后卡片变绿显示"✓ 已放行"
  - **WEAK 卡片**：三个按钮「✓作为新单录入」「↻更新已有单」「跳过」
- 底部：「🔓 全部放行」+「取消全部」+「确认处理 →」
- 动画：overlayIn 淡入 + modalIn 弹性入场；颜色全走 CSS 变量（深色模式自适应）

**为什么改**
用户需求：「增加人工干预功能，所有的拦截都需要可以进行人工手动释放，再次检测优化代码，提升UI的美观」

旧的 alert() 拦截是死路一条——一旦判定 STRONG（同PNR/全航班相同/同人同日位置冲突），用户只能取消，没法强制录入。但现实中可能有合理的例外（比如系统误判、特殊业务场景），操作员需要能手动放行。

**单元测试 8/8 全过（jsdom 真实 DOM 交互）**
- ✓ modal 渲染到 DOM
- ✓ strong 释放按钮 + weak 三动作按钮正确生成
- ✓ 点释放后显示"已放行"标签 + 卡片变绿
- ✓ weak 选 add 后显示决定
- ✓ 返回值正确：放行的进 releasedStrong，add 的不进 weakUpdates（作为新单）
- ✓ 确认后 modal 关闭

**新增函数**
- `showBlockingModal(strong, weak)` — 返回 Promise<{releasedStrong:Set, weakUpdates:Map, weakSkipped:Set}>
  - 内部含 routeOf/dateOf/paxOf/whenOf 渲染辅助
  - 逐卡片事件绑定 + 全部放行 + 取消全部

**主流程改动**
- parsePNR 里删除三段 alert()/confirm() 墙（约 80 行）
- 改为 `await showBlockingModal(strong, weak)` 一次性处理所有冲突
- 根据返回的 releasedStrong / weakUpdates / weakSkipped 决定哪些订单录入

**改动位置**
- index.html detectDuplicates 后（约 10573）：新增 showBlockingModal 函数（~230行）
- index.html parsePNR 内（约 10826）：三段 alert/confirm 替换为 modal 调用
- index.html summary（约 11159）：跳过数改为统计真实未放行的 strong

**行为变化总结**
| 情况 | 旧行为 | 新行为 |
|---|---|---|
| STRONG 拦截 | alert() 死挡，只能取消 | 卡片 + 🔓 强制录入按钮 |
| WEAK 确认 | 连续 confirm() 弹窗 | 卡片 + 三按钮一次看全 |
| 多个冲突 | 一个个 alert/confirm | 全部在一个 modal 里 |
| 全部放行 | 不可能 | 一键「全部放行」 |

**风险或注意事项**
- ⚠ **人工放行 = 真的会录入**：点了「强制录入」就会把订单加进待出票，可能造成真重复。这是用户明确要的功能，责任在操作员
- ⚠ modal 是 Promise-based 异步：parsePNR 会 await 它，用户不点确认/取消就一直等（不会超时）。点遮罩不关闭（强制明确选择）
- ⚠ 代理暂停拦截（pauseOverride）**未纳入本次改动**：它已经有自己的绕过 confirm，已满足"可释放"。如需统一进这个 modal 风格，下一版做
- ⚠ 删除/清空等其他 confirm（33处）是正常用途，不在本次范围

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后恢复 alert()/confirm() 拦截（STRONG 不可放行）。

---
