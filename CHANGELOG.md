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

