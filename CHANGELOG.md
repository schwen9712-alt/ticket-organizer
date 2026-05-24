## 2026-05-23 — 修复名字斜杠后多空格无法识别的 bug

**改了什么**
修复了乘客名字解析的一个根本 bug —— 所有 5 处名字 regex 都假设 `LAST/FIRST` 中间最多只有 1 个空格。一旦数据源是 `LAST/  FIRST`（两个或更多空格），整个识别链全部失败。

具体的 5 处 regex 都做了 `\s?` → `\s*` 的修复（或允许 `/` 后多空格）：
- 8701 行 `isSharedHeaderLine`：判断是否名字行，影响多人订单的乘客切分
- 9265 行 `infantPaxMatch`：婴儿前缀格式 `婴儿：NAME 女 11MAR25`
- 9512 行 `nameRe`（主名字 regex）：扫描整行所有可能的名字
- 9529 行 `cnInlinePax`（中文 inline 格式）：`NAME 男/女童/婴 DATE`
- 9583 行 `nameMatch`（fallback）：单乘客行兜底

同时 9532 和 9267 行的 name 清理也补充了 `.replace(/\/\s+/, '/').replace(/\s+/g, ' ')`，确保提取出的 name 是 `TANG/NOAH` 而不是 `TANG/ NOAH`。

**为什么改**
用户报告：以下输入完全识别不出来：
```
TANG/  NOAH 男童  17JUN22
1. DL280 Z TH20AUG PVGSEA DK1 1730 1358 
2. DL2922 Z FR21AUG SEALAS GK1 0715 0951 
3. DL2844 V WE16SEP LASSEA DK1 0600 0846 
4. DL069 V WE16SEP SEATPE DK1 1600 1955+1 
01 ZNX7ZJDK+*     CNN  20367 CNY
```

根因：`TANG/[2 空格]NOAH` 中 `/` 后面有两个空格。所有 regex 都用 `\s?`（0 或 1）或 `[A-Za-z]`（必须立即接字母），导致 `/` 后跟多空格的情况零匹配。

这种格式在打字输入或某些 GDS 终端复制粘贴时很常见（对齐用），但解析器从来没考虑过。

**测试已验证 7 种 case 全过**
- ✓ `TANG/  NOAH 男童  17JUN22` → TANG/NOAH MALE CHILD（原 bug）
- ✓ `TANG/NOAH 男童 17JUN22` → TANG/NOAH MALE CHILD（标准）
- ✓ `WU/XINER 女 25DEC1993` → 成人
- ✓ `1. WANG/XIAO 男 18JAN95` → 编号前缀
- ✓ `WANG/  XIAO MEI 女 18JAN95` → 双名 + 多空格
- ✓ `CHEN/GG 女 1990年5月23日` → 中文日期
- ✓ `HOSEL/  SUMMER RUBY 女婴 11MAR25` → 婴儿前缀多空格

**改动位置**
- `index.html` 行 8701, 9265, 9267, 9512, 9529, 9532, 9583

**风险或注意事项**
- 改 `\s?` → `\s*` 理论上可能让原来不匹配的"垃圾输入"现在能匹配。但考虑到 regex 前后还有锚点限制（`^`、`\s+(男女|MR|...)`、性别/日期 lookahead 等），实际不会引入误匹配
- 提取后用 `.replace(/\/\s+/, '/').replace(/\s+/g, ' ')` 归一化，确保下游 dedup（`pax.find(p => p.name === name)`）不会因为多空格判错

**回滚方式**
从 `.backups/` 找上一次的 `index.html` 覆盖即可。本次纯 regex 修复，不动 schema，不动行为路径，回滚 100% 安全。

---
