> **Status: resolved. Kept as a record of the investigation, not as open work.**
>
> All three problems below were real and all three are fixed. Read this for how
> they were diagnosed, not for what to do — in one case the fix that shipped is
> deliberately *not* the one proposed here.
>
> | section | what shipped |
> |---|---|
> | **A** User-Agent / `Sec-Ch-Ua` mismatch | Fixed in **#141**, but **not** by pinning the UA to Chrome 121 as proposed in §3.1. The client hints are now *derived* from whichever User-Agent is in play, so a per-retailer override works too and the pair cannot drift again. Pinning would have frozen every install on a browser version that ages. |
> | **B** Case-sensitive challenge detection | Fixed in **#149**. Worse than described here: `html.includes('perimeterx')` also missed PerimeterX's own casing of its own name, and `title === 'access denied'` missed any title with a suffix. Now regex-based and case-insensitive, with 24 tests where there were none. |
> | **C** Missed browser-scraper fallback | Not changed, and deliberately. The gate on `!domainConfig` is intentional — auto-discover the browser need for *unknown* domains, and expect an admin to set `use_browser_scraper` for a domain that already has a config. With **B** fixed, a challenge is now detected, which is what §C was really describing. |
>
> One correction to §A's verification note: setting the UA to `Chrome/121.0.0.0`
> did fix amazon.com.au, and that is what identified the bug — but it worked
> because 121 happened to match the hardcoded hints, not because 121 is special.
> Any consistent pair works, which is why deriving them was the better fix.
>
> The wider "can we scrape Akamai-protected retailers" question is **#67**,
> where six hypotheses were eliminated by measurement.

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
