# 工作流程 — 给 Claude（包括未来 sessions）的说明

## 每次改动前

1. **查 CHANGELOG.md** 看看相关改动历史，避免重复或冲突
2. 如果是大改动，先简单说改了什么、为什么改

## 每次 ship 前

**用 `bash ship.sh` 代替手动 `cp`**。这个脚本会：
- 自动备份当前 `index.html` 到 `.backups/index-YYYY-MM-DD-HHMM.html`
- 保留最近 20 份备份，旧的自动删除
- 复制到 `/mnt/user-data/outputs/ticket_organizer.html`
- 提示写 CHANGELOG

## 每次 ship 后

立即在 CHANGELOG.md **顶部**插入一条新记录，格式：

```markdown
## YYYY-MM-DD HH:MM — 简短标题

**改了什么**:
- ...

**为什么改**:
- ...

**风险或注意事项**:
- ...

---
```

不写 CHANGELOG = 这次改动没做完。

## 如果改坏了需要回滚

```bash
bash restore.sh              # 列出所有备份
bash restore.sh latest       # 回到上一版
bash restore.sh 2026-05-23-0414  # 回到指定时间点
```

restore.sh 会在回滚前再存一份当前状态到 `pre-restore-*.html`，所以回滚本身也是可撤销的。

## 文件说明

- `index.html` — 主源码（开发时编辑这个）
- `ship.sh` — 部署脚本
- `restore.sh` — 回滚脚本
- `CHANGELOG.md` — 改动日志（每次 ship 必更新）
- `WORKFLOW.md` — 本文件
- `.backups/` — 自动备份目录（gitignored）
- `/mnt/user-data/outputs/ticket_organizer.html` — ship.sh 输出位置
