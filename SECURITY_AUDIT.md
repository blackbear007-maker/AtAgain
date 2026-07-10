# 再啦讚！(AtAgain) — 安全審計報告

**審計日期**: 2026-07-11
**審計範圍**: Chrome 擴充功能 (Manifest V3)，content script 型錯字修正工具
**受檢檔案**: `manifest.json`、`content.js`、`popup.html`、`popup.js`、`privacy.html`、`package.json`
**整體嚴重程度**: 低（無高風險漏洞；2 項中風險屬「整合性/隱私」性質，非傳統可被利用漏洞）

---

## 執行摘要

此擴充功能安全基礎良好：
- 僅申請 `storage` 一項權限，無 `tabs`、`webRequest`、`scripting` 等敏感權限。
- **完全不發送任何網路請求**（無 `fetch` / `XMLHttpRequest`），符合隱私權政策「不與伺服器通訊」的宣稱。
- **無 `eval` / `new Function` / `document.write` / `innerHTML` 注入**，不存在 DOM-based XSS。
- 所有文字寫入皆使用 `.value` / `.textContent` / `.innerText` / `.nodeValue`（純文字指定，不會解析 HTML）。
- 不收集、不儲存使用者輸入內容；`chrome.storage` 只存兩個布林開關。

發現 **0 個高風險**、**2 個中風險（整合性/最小權限）**、**3 個低風險/建議事項**。

---

## 發現與建議

### 🟡 中風險 1：輸入監聽未排除密碼等敏感欄位

**檔案**: `content.js:1347-1354`、`content.js:1205-1256`

`input` 事件監聽只判斷 `tagName === 'INPUT' || 'TEXTAREA'`，**未排除**
`type="password"`、`email`、`tel`、`number`、`url`，以及 OTP／驗證碼／信用卡欄位。
`processText()` 會讀取 `element.value`，套用修正後**靜默寫回**欄位。

**影響**:
- 若使用者在密碼／驗證碼欄位輸入的內容恰好命中修正規則，內容會被無聲改寫，使用者不會察覺 → 可能導致登入失敗、帳號鎖定。
- 敏感欄位內容雖然只在本機記憶體處理、不外傳，但仍被讀取與改寫，屬於不必要的接觸面。

**建議修復**（在 `processText` 入口與 input 監聽加白/黑名單）:
```javascript
const SENSITIVE_TYPES = ['password', 'email', 'tel', 'number', 'url', 'search'];
function isSensitive(el) {
  if (el.tagName === 'INPUT') {
    const t = (el.type || 'text').toLowerCase();
    if (SENSITIVE_TYPES.includes(t)) return true;
  }
  // 常見的密碼/OTP 屬性
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (ac.includes('password') || ac.includes('one-time-code') || ac.includes('cc-number')) return true;
  return false;
}
// processText 開頭：
function processText(element) {
  if (isSensitive(element)) return;
  ...
}
```
最保守的做法：只修正 `input[type="text"]` 與 `textarea`，其餘一律略過。

---

### 🟡 中風險 2：`<all_urls>` + 「修正我看到的」全站靜默改寫顯示文字

**檔案**: `manifest.json:9`（`"matches": ["<all_urls>"]`）、`content.js:1277-1314`（`processPageContent`）

`fixPage` 預設開啟，會在**每一個網站**（含銀行、醫療、法律、政府網站）用 `TreeWalker`
掃描所有文字節點並直接改寫 `nodeValue`（同音字對照表，如 候/侯、訂/定、券/卷…）。

**影響**:
- 這是整合性風險：擴充功能會靜默更動使用者看到的內容。在金額、藥品名稱、法律條文、姓名等對「字」敏感的頁面上，改寫可能扭曲原意，且使用者以為是網站原文。
- `<all_urls>` 讓此擴充功能對所有頁面內容具備讀寫能力。目前程式碼未濫用，但一旦未來版本被入侵或惡意更新（供應鏈風險），影響面即為「所有網站的全部文字」。

**建議**:
1. 考慮將預設值改為「修正我看到的」預設**關閉**，讓使用者主動開啟。
2. 若要維持功能，於 popup 明確提示此模式會改寫網頁顯示文字。
3. 長期可評估用 host 白名單或 `activeTab` 模式，取代 `<all_urls>` 常駐注入，落實最小權限。

---

### 🟢 低風險 3：manifest 未明確宣告 Content Security Policy

**檔案**: `manifest.json`

MV3 對擴充頁面已有安全預設 CSP（禁止 inline script／遠端腳本），且 `popup.html`
以 `<script src="popup.js">` 外部載入、無 inline 事件處理器，故實務上**目前無漏洞**。
建議仍明確加上，避免日後改動時退化：
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

---

### 🟢 低風險 4：`AtAgain.log` 被納入版本控制

**檔案**: `AtAgain.log`（已提交於 repo）

開發用 log 隨原始碼一起提交。雖不影響已上架的擴充功能封裝（Chrome 只打包 manifest 指定檔案），
但建議加入 `.gitignore` 並從 repo 移除，避免無意間洩漏開發環境路徑或除錯資訊。

---

### 🟢 低風險 5：正則由對照表動態產生（已妥善處理，僅記錄）

**檔案**: `content.js:1004`

`new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')` 有正確做 regex escaping，
且 `wrong` 來源為內建靜態對照表、非使用者輸入，**無 ReDoS 或注入風險**。此處為正面確認。

---

## 已檢查且未發現問題的項目

| 項目 | 結果 |
|------|------|
| 網路請求 / 資料外洩（fetch、XHR、beacon、`.src=`） | ✅ 無 |
| 程式碼注入（eval、Function、document.write、setTimeout 字串） | ✅ 無 |
| DOM XSS（innerHTML、outerHTML、insertAdjacentHTML） | ✅ 無 |
| 敏感資料儲存（cookie、localStorage、token、密碼落地） | ✅ 無 |
| 權限過度（tabs、host_permissions 濫用、webRequest） | ✅ 僅 `storage` |
| Prototype pollution（使用者可控 key 寫入物件） | ✅ 無 |
| 隱私政策與實際行為一致性 | ✅ 相符（不外傳） |
| popup / privacy 頁面 inline script | ✅ 無 inline，符合 CSP |

---

## 部署前建議清單（優先順序）

1. **（中）** `content.js`：在 `processText` 與 input 監聽排除 password/email/OTP 等敏感欄位。
2. **（中）** 評估「修正我看到的」預設關閉，或於 UI 明確告知會改寫網頁文字。
3. **（低）** manifest 明確加上 `content_security_policy.extension_pages`。
4. **（低）** 將 `AtAgain.log` 加入 `.gitignore` 並從版本庫移除。

---

## 結論

「再啦讚！」是一個設計克制、隱私友善的本機端擴充功能——最小權限、零網路通訊、無程式碼注入面。
**無傳統可被遠端利用的高風險漏洞。** 主要待改進點屬「整合性與最小權限」層面：
避免靜默改動敏感輸入欄位，以及縮小 `<all_urls>` 全站改寫的接觸面。修正上述中風險兩項後，
即可視為安全狀態良好。
