## 2026-05-23 — 修复 SSR 证件「缺护照到期日」时漏识别乘客

**改了什么**
SSR DOCS 证件行的护照到期日改为可选，修复部分乘客（尤其儿童）因缺到期日而完全漏识别的问题。

**为什么改**
用户反馈这段 5 个乘客的订单解析不对：
```
SSR DOCS 航司 HK1 P/CHN/EJ4815199/CHN/07JUL87/F/17MAY31/XU/YIFAN/P1
SSR DOCS EY HK1 P/USA/A70008688/USA/01AUG85/M/07OCT35/SUN/LIBIN/P2
SSR DOCS EY HK1 P/USA/675913327/USA/28DEC13/M/SUN/JUSTIN/P3        ← 缺到期日
SSR DOCS 航司 HK1 P/CHN/EA7593331/CHN/21JUN57/F/WENG/DEMING/P4     ← 缺到期日
SSR DOCS EY HK1 P/USA/A05978056/USA/14NOV18/F/SUN/ISABELLE/P5  儿童 ← 缺到期日+行尾"儿童"
```

诊断结果：
- 航段（UA507/LX1613/LX038）全部正常
- **5 个乘客只识别出 2 个（P1/P2）**，P3/P4/P5 全漏
- 根因：SSR regex 强制要求两个日期（DOB + 到期日），格式 `.../DOB/性别/到期/姓/名/Pn`。但 P3/P4/P5 缺到期日，是 `.../DOB/性别/姓/名/Pn`（少一段），不匹配
- 漏掉的恰好包括儿童（JUSTIN 2013年生、ISABELLE 2018年生）

**修复方案**
SSR + bareDoc 两处 regex 都改：
1. **护照到期日改为可选**：`(?:(到期日)\/)?` —— 有就提取到 passportExpiry，没有就留空，姓名照常识别
2. **支持行尾儿童/婴儿标记**：容忍 `/P5  儿童` 这种结尾（CHD/INF/CHILD/INFANT/儿童/婴儿）
3. 姓名支持空格（多词姓名）

**端到端测试 5/5 全通过**
| 乘客 | 修复前 | 修复后 |
|---|---|---|
| XU/YIFAN | ✓ | ✓ DOB07JUL87 到期17MAY31 |
| SUN/LIBIN | ✓ | ✓ DOB01AUG85 到期07OCT35 |
| SUN/JUSTIN | ✗漏 | ✓ DOB28DEC13（无到期）|
| WENG/DEMING | ✗漏 | ✓ DOB21JUN57（无到期）|
| SUN/ISABELLE | ✗漏 | ✓ DOB14NOV18（无到期，行尾"儿童"正确忽略）|

有到期日的不会把到期日误当姓；缺到期日的正确识别姓名。

**改动位置**
- index.html 9582 附近：SSR ssrMatch regex 到期日可选 + 儿童标记
- index.html 9603 附近：bareDocMatch 同样修复

**关于价格分档（未自动处理，需手动）**
这单价格是分档的：「32041 商务大人 4位」+「32000 儿童价格」。系统会识别到价格数字，但"4位大人+儿童"的分配需要你在录入后手动核对每个乘客的价格（尤其 JUSTIN/ISABELLE 是儿童）。多档价格自动分配较复杂，本次未做，避免分错。

**风险或注意事项**
- ⚠ 到期日可选后，有到期日的 SSR 仍正确提取到期日（regex 优先匹配日期格式，姓是纯字母不会混淆）
- ⚠ 缺到期日的乘客 passportExpiry 留空，不影响出票（到期日非必填）
- ⚠ 不影响其他证件格式

**回滚方式**
从 .backups/ 找上一版覆盖。回滚后缺到期日的乘客（含儿童）又会漏识别。

---
