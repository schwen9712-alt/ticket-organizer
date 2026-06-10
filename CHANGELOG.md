## 2026-06-09 — 代码审视优化：修复分档价格断链（识别不到位的根因）

**做了什么**
系统审视全部代码，发现并修复了用户反复反馈"识别不到位"的真正根因，外加两项优化。

**🔴 关键修复：分档价格（成人/儿童运价）双重断链**

用户的格式 `TOTAL CNY 17365 成人运价 / TOTAL CNY 16845 儿童运价` 之前在两个环节断裂：

1. **解析断裂**：旧逻辑要求类型词在 TOTAL 行之前的独立行（"大人运价" 换行 "TOTAL CNY..."），通过 _lastFareType 传递。但用户的类型词在 TOTAL 行**行尾**（TOTAL CNY 17365 **成人运价**）→ _lastFareType 为 null → 分支不进 → 价格没存
2. **传递断裂**：即使存进 parsedFareByType，**return 对象里也没有这个字段** → 解析完直接丢弃，订单上永远看不到

修复：
- TOTAL CNY regex 支持行尾类型词（成人/大人/儿童/小儿/婴儿），行尾词优先于 _lastFareType
- return 加 fareByType 字段
- schema 加 fareByType + 订单组装应用
- 价格预览新增分档显示行：`📊 分档运价（请核对各乘客适用价）成人 ¥17,365 · 儿童 ¥16,845`

端到端测试通过：
- ✓ TOTAL CNY 17365 成人运价 → adult=17365（作主运价）
- ✓ TOTAL CNY 16845 儿童运价 → child=16845（入分档）
- ✓ 普通 TOTAL CNY 13555（无类型词）→ 不受影响，仍走原 pTotal 分支

**🟡 优化：黑名单出票时二次提醒**
之前黑名单只在解析时弹一次窗，几天后出票早忘了。现在快速出票确认时，若订单含黑名单乘客，再次 confirm 提醒（可取消出票）。

**🧹 清理**
- 移除 console.log 残留（rolling-backup 调试日志）

**审视结论（健康项）**
- ✓ 515 个函数，零重复定义
- ✓ console.log 清零
- ✓ fareByType 全链路完整：解析 → return → schema → 组装 → 显示
- ✓ 价格分支互不遮蔽（bareNumFare/cabinGluedFare/totalCny 各管各的格式）
- ✓ 护照卡合并不被中文日期/GDS拆分干扰

**改动位置**
- index.html 10262 附近：totalCnyMatch 支持行尾类型词
- index.html 10806 附近：return 加 fareByType
- index.html 5582 附近：schema 加 fareByType
- index.html 11506 附近：订单组装应用 fareByType
- index.html 18740 附近：价格预览显示分档运价
- index.html 19597 附近：出票确认黑名单二次提醒
- index.html 23712 附近：移除 console.log

**风险或注意事项**
- ⚠ 分档价格目前是"显示供核对"，不自动按乘客类型分别计费（每个乘客实际用哪档价仍需人工核对，避免自动分错）
- ⚠ 黑名单出票提醒用 confirm，点取消会中止出票
- ⚠ 部署后记得 Ctrl+Shift+R 强刷；用设置里有无 ⛔ BLACKLIST 判断是否最新版

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后分档价格又会解析丢失。

---
