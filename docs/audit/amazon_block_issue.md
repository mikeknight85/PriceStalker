# Issue: Standard HTTP Scraper Blocked on Amazon (User-Agent / Client Hint Mismatch & Defective Bot Fallback)

## 1. Symptoms
* Programmatic Axios (HTTP) requests to `amazon.com.au` are instantly blocked, returning a `200 OK` response with a **2860-byte, 32-node "Server Busy" CAPTCHA challenge page**.
* The scraper fails to extract product prices, and the AI Auto-Mapping rejects the empty configuration because no valid selectors can be found on the CAPTCHA page, resulting in a `400 Bad Request` when adding products.
* Deleting the retailer configuration (`domainConfig = null`) does not resolve the issue, and the system still fails to trigger the remote browser scraper fallback.

---

## 2. Root Cause Analysis

### A. Mismatch Between User-Agent and Client Hints (`Sec-Ch-Ua`)
Under modern **User-Agent Reduction** rules, Chrome freezes minor/patch version numbers at `.0.0.0` in the legacy `User-Agent` string (meaning Chrome 146 legitimately reports as `Chrome/146.0.0.0`).
* **The Bug:** The `default_user_agent` database setting is seeded with `Chrome/146.0.0.0` via migration `006_seed_generic_selectors.ts`. However, in [`headers.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/transport/headers.ts#L9), the newer `Sec-Ch-Ua` Client Hint header is **hardcoded to version 121**:
  ```typescript
  'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  ```
* **The Block:** Amazon's WAF checks for consistency between the `User-Agent` version and the `Sec-Ch-Ua` version. Since the legacy header claimed **Chrome 146** while the client hints claimed **Chrome 121**, the mismatch was flagged as an automated bot, triggering the CAPTCHA challenge.
* **Verification:** Changing the database UA to `Chrome/121.0.0.0` aligns both headers to version `121` and bypasses the WAF block immediately.

### B. Defective Bot Detection (`detection.ts`)
Amazon's CAPTCHA page uses the title `<title>Server Busy</title>` and carries the path `/errors_page/validateCaptcha` (Capital **C**).
* **Problem:** The `detectBotChallenge` function in `detection.ts` checks:
  ```typescript
  if (html.length < 15000 && (html.includes('captcha') || title.includes('captcha') || html.includes('Prove you are human') || html.includes('Are you a robot')))
  ```
  Because `html.includes('captcha')` is case-sensitive, it fails to match `/errors_page/validateCaptcha`. The page title `"Server Busy"` also misses all checks.
* **Impact:** The block goes undetected, and `challengeReason` remains `null`.

### C. Missed Remote Scraper Fallback
In the scraping orchestrator (`backend/src/services/scraper/acquisition/index.ts`):
* **Problem:** The fallback to the remote browser scraper is gated behind:
  ```typescript
  if (challengeReason && !usedRemoteFallback && !domainConfig)
  ```
  Since `challengeReason` was set to `null` by the defective bot check, the system never triggers the remote browser scraper fallback—even when the retailer configuration is deleted and `domainConfig` is `null`.

---

## 3. Proposed Fixes

### 1. Fix Mismatch/Sync User-Agent and Client Hints
Sync the legay User-Agent and the `Sec-Ch-Ua` Client Hints to use the same matching version (e.g. updating the seeded database UA and constants UI presets to `Chrome/121.0.0.0` to match the hardcoded `Sec-Ch-Ua` value).

### 2. Make Bot Detection Case-Insensitive
Modify `detectBotChallenge` in `detection.ts` to perform case-insensitive checks and explicitly catch `"server busy"` titles:
```typescript
const titleLower = $('title').text().toLowerCase();
const htmlLower = html.toLowerCase();

if (html.length < 15000 && (
  htmlLower.includes('captcha') || 
  titleLower.includes('captcha') || 
  titleLower.includes('server busy') || 
  htmlLower.includes('prove you are human') || 
  htmlLower.includes('are you a robot')
)) {
  return 'Generic Bot Challenge';
}
```

### 3. Allow Browser Fallback on Blocked Requests
Update the dynamic fallback condition in `acquisition/index.ts` to trigger if blocked, regardless of whether a configuration exists (or at least if the existing configuration is a shell config with no selectors):
```typescript
if (challengeReason && !usedRemoteFallback) { ... }
```
