## 2026-05-23 — 修复含空格姓名 + 双国籍证件信息解析失败

**改了什么**
修复两类导致解析失败的格式：
1. **姓/名含空格**（如 `SABIK III/JOSEPH FRANK`，姓带罗马数字后缀）
2. **双国籍证件信息行**（如 `证件信息：USA/565508418/USA/26APR61/M/28FEB28/SABIK III/JOSEPH FRANK/P1`）

**为什么改**
用户反馈以下行程无法识别：
```
1. SABIK III/JOSEPH FRANK
1.  UA2153  Z   02JUL  CLESFO   0700  0912
...
证件信息：USA/565508418/USA/26APR61/M/28FEB28/SABIK III/JOSEPH FRANK/P1
74538CNY
```

诊断结果：
- **航段全部正常**（pattern[2] 不要求星期前缀，5段含跳号5/6都能识别）
- **姓名行失败**：`SABIK III/JOSEPH FRANK` 的姓 "SABIK III" 含空格，旧 regex `[A-Z]{2,}\/` 要求斜杠前连续大写字母，只抓到 `III/JOSEPH FRANK`（丢了 SABIK）
- **证件信息行失败**：格式是 `国籍/护照/国籍/出生/性别/到期/姓/名/Pn`（开头是国籍 USA 而非护照号），旧 compactDocMatch 假设第一段是护照号，不匹配

**修复方案**
1. 三处姓名 regex 的"姓"部分 `[A-Z]{2,}` → `[A-Z]{2,}(?:\s+[A-Z]+)*`，允许姓含空格（SABIK III、VAN DER BERG、DELA CRUZ 等）
2. 新增「双国籍证件信息」格式分支：`NATIONALITY/DOCNUM/NATIONALITY/DOB/GENDER/EXPIRY/SURNAME/GIVEN/Pn`，姓名支持空格，并提取护照到期日
3. 旧 compactDocMatch 的 surname 也从 `[A-Z]+` 放宽为 `[A-Z][A-Z\s]*?`，支持含空格的姓

**端到端测试全部通过（用户的真实输入）**
- ✓ 姓名 SABIK III/JOSEPH FRANK（罗马数字后缀完整保留）
- ✓ DOB 26APR61 · 性别 MALE · 护照到期 28FEB28
- ✓ 5 段航程全部识别（含跳号的第5、6段）
- ✓ 总价 ¥74538

**边界测试（确保不误伤）**
- ✓ 普通姓名 XU/SHENBO 正常
- ✓ 名含空格 WANG/XIAO MEI 正常
- ✓ 称谓后缀 SMITH/JOHN MR → 正确截断为 SMITH/JOHN（MR 被 lookahead 挡住）
- ✓ 航段行不被误判为姓名

**改动位置**
- index.html 8724：isSharedHeaderLine 检测，姓允许空格
- index.html 9354 前：新增双国籍证件信息格式分支
- index.html 9357：compactDocMatch surname 放宽支持空格
- index.html 9535：主 nameRe，姓允许空格
- index.html 9606：fallback nameMatch，姓允许空格

**风险或注意事项**
- ⚠ 姓允许空格后理论上可能多吃一个词，但 lookahead（航段号/称谓/中文性别/行尾）能正确截断，边界测试已验证
- ⚠ 双国籍证件格式的护照到期日现在会被存到 passportExpiry 字段（之前这种格式根本没解析出来）
- ⚠ 不影响已能识别的其他格式（普通姓名、标准证件行、中文姓名等）

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后含空格姓名和双国籍证件行会重新解析失败。

---
