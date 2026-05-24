## 2026-05-23 — Anthropic API Key 密码加密同步

**改了什么**
- 新增 AES-GCM 密码加密的 API Key 跨设备同步功能
- API Key 现在可以勾选「同步到其他设备」选项，用密码加密后通过 Firebase 同步
- 设置面板「AI 图片识别」区域底部新增 `☐ 同步到其他设备（密码加密，存 Firebase）` 复选框
- 状态条新增三种显示状态：
  - `✓ 已配置 sk-ant-xxx... · ☁ 已加密同步`（本机有 key + 已同步）
  - `🔒 云端有加密 Key，本机未解锁 [🔓 输密码解锁]`（新设备首次访问）
  - `⚠ 云端有但本机密码缺失`（异常状态）
- 清除 API Key 时同步清除云端密文 + 本机密码

**为什么改**
解决「每次在新设备打开应用都要手动重新输入 API Key」的痛点。之前 API Key 只存本机 `localStorage`，跨设备完全不共享。现在密码加密后存 Firebase，新设备输入一次密码即可解锁，密码本身存本机（不上云）。

**技术细节**
- PBKDF2-SHA256 派生密钥，200,000 次迭代
- AES-GCM 加密，每次重新加密生成新的随机 salt（16 字节）+ IV（12 字节）
- AES-GCM 自带认证标签，密码错误会直接抛错（不会得到错误解密结果）
- 密文格式：`{"v":1,"salt":"base64","iv":"base64","ct":"base64"}` 存在 `settings.anthropicKeyEncrypted`
- 新增 localStorage key：`ticket-organizer-anthropic-pw`（本机密码，不同步）

**改动位置**
- `index.html` HTML 设置面板（约 3580 行附近）：API Key 区域加复选框 + 提示文案
- `index.html` JS（约 23641 行起）：新增 ~170 行加密工具函数 + `saveAnthropicKey` / `clearAnthropicKey` / `updateAiKeyStatus` 升级 + `unlockAnthropicKey` 新函数 + `fbApplyRemote` 增加自动解密流程

**新增/修改的函数**
- `_b64` / `_b64dec` / `_deriveKey` / `_aesEncrypt` / `_aesDecrypt`（加密工具，全新）
- `loadAnthropicPw` / `saveAnthropicPw` / `clearAnthropicPw`（密码存取，全新）
- `syncAnthropicKeyToCloud`（加密并写入 settings，全新）
- `tryAutoDecryptCloudKey`（拉到密文后自动用本机密码尝试解密，全新）
- `unlockAnthropicKey`（用户主动点「🔓 解锁」按钮，全新）
- `saveAnthropicKey`（升级：支持勾选同步 + 弹密码框）
- `clearAnthropicKey`（升级：顺便清云端 + 本机密码）
- `updateAiKeyStatus`（升级：显示云端状态 + 解锁按钮）
- `fbApplyRemote`（升级：拉到密文后自动尝试解密 + 处理云端密文被删的情况）

**风险或注意事项**
- ⚠ **密码本身存本机 localStorage（明文）**：物理拿到设备 + 浏览器没锁 = 别人能直接读密码再下载云端密文解密。这种风险和原来本地存明文 key 等价
- ⚠ **密文上 Firebase 公开**（Firebase test mode 安全规则未配，到期 2026-06-22），安全完全依赖密码强度。**强烈建议密码 ≥ 12 位**，别用生日 / 123456 / qwerty
- ⚠ **忘密码 = 永远解不开**：没有忘记密码流程（设计上不可能做，云端没有反推信息）。处理方式：在某台已解锁设备点「清除」→ 重新走一次「保存 + 勾选同步 + 设新密码」流程
- ⚠ **Session 5 那个「每次部署后 key 消失」的原谜团未根除**：如果根因是 localStorage 被清，这次改动也救不了（密码也是 localStorage）。但因为云端有密文，**最坏情况只是再输一次密码**，比之前要去 console.anthropic.com 复制完整 key 强多了

**测试流程**
1. A 设备：设置 → AI 图片识别 → 输入 key + 勾选「同步到其他设备」→ 弹两次密码输入（≥6 位）→ 状态变 `☁ 已加密同步`
2. B 设备：刷新页面（Ctrl+Shift+R）→ 设置 → AI 图片识别 → 看到 `🔒 云端有加密 Key` + `🔓 输密码解锁` 按钮 → 点按钮 → 输同一密码 → 状态变 `✓ 已配置`
3. 任一设备：清除 key → 另一设备同步收到清除（状态变 `未配置`）
4. 任一设备：改 key（不勾选同步）→ 云端密文被删除

**回滚方式**
如果出问题，从 `.backups/` 找上一次的 `index.html` 覆盖即可。本次改动**不修改任何现有 settings 字段含义**，只新增 `settings.anthropicKeyEncrypted` 字段；回滚后多出来的这个字段无害（不会被任何旧代码读到）。本机 `localStorage` 多出来的 `ticket-organizer-anthropic-pw` 也不会被旧代码读到，无影响。

---
