# Master Refix Plan for PriceStalker

Because **PriceStalker** was branched from an earlier release of the upstream code, many of the issues that were marked as "Completed" in the upstream `priceghost` audit (`audits/all.md` / `claude3.md`) are still open and broken in the current codebase.

This plan details all outstanding issues, references their exact file paths in the `pricestalker` source tree, and provides specific refix steps for each.

---

## 🗺️ Master Issue Register & Refix Steps

### 1. Transport & Acquisition Layer

#### 🟢 Issue A-1: Off-by-one retry loop in remote scraper
* **File:** [`backend/src/services/scraper/transport/remote.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/transport/remote.ts#L17-L89)
* **Description:** The retry loop for the remote scraper uses `while (retryCount <= maxRetries)` (max 3 retries). However, inside the `catch` block for 503 errors, it checks `if (status === 503 && retryCount < maxRetries)`. Once `retryCount` hits 3, this condition is false, and it throws the error instead of returning to the loop. The `throw new Error('Remote Scraper Failed: Max retries exceeded')` at the end of the function is unreachable dead code.
* **Refix Plan:** Change the catch check to allow retry on the final attempt, or simplify the loop so that the loop condition itself handles the iteration budget and the final throw is reachable.

#### 🟢 Issue A-2: `usedRemoteFallback` set before success
* **File:** [`backend/src/services/scraper/acquisition/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/index.ts#L38)
* **Description:** At the start of `acquireHtml`, if a site has `useBrowserScraper` configured, `usedRemoteFallback` is immediately set to `true` *before* the attempt completes. If this initial attempt fails, standard HTTP (Attempt 2) is tried. If standard HTTP then encounters a block, the fallback block is skipped because `!usedRemoteFallback` evaluates to `false`.
* **Refix Plan:** Only set `usedRemoteFallback = true` when a fallback scraper attempt actually succeeds or when attempting Attempt 3.

#### 🟢 Issue A-3: Challenged remote HTML blocks fallback
* **File:** [`backend/src/services/scraper/acquisition/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/index.ts#L36-L43)
* **Description:** If Attempt 1 (remote scraper) is executed and returns HTML that is blocked (e.g. a Cloudflare captcha page), `challengeReason` is correctly detected. However, because `usedRemoteFallback` was set to `true`, the system cannot execute the fallback scraper to recover.
* **Refix Plan:** If Attempt 1 returns a challenged page, reset `usedRemoteFallback = false` or flag it to allow a recovery retry.

#### 🟢 Issue A-4: Fallback result never checked for challenges
* **File:** [`backend/src/services/scraper/acquisition/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/index.ts#L76-L91)
* **Description:** When the fallback to the remote scraper (Attempt 3) runs, it returns `fallbackResult`. The HTML returned by this fallback is never run through `detectBotChallenge()`, so if the fallback *also* gets blocked, the system sends the CAPTCHA page straight to the price extractor.
* **Refix Plan:** Run `detectBotChallenge` on the fallback HTML result and throw a `BotChallengeError` or flag it for review if it remains blocked.

#### 🟢 Issue A-5: Proxy credentials logged in plaintext
* **File:** [`backend/src/services/scraper/acquisition/standard.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/standard.ts#L32)
* **Description:** The system logs `extractionSteps.push(`Request | Proxy | Using: ${currentProxy}`)`. If the proxy URL contains authentication details (e.g. `http://user:password@host:port`), they are stored in plaintext in the database logs.
* **Refix Plan:** Sanitize the proxy URL (strip out `user:password` credentials) before pushing it to `extractionSteps`.

#### 🟢 Issue A-6: Stale hardcoded User-Agent & Client Hints
* **File:** [`backend/src/services/scraper/transport/headers.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/transport/headers.ts#L20-L25)
* **Description:** The default User-Agent and the `Sec-Ch-Ua` headers are hardcoded to Chrome 121 (from January 2024), which is stale and easily fingerprinted.
* **Refix Plan:** Update the hardcoded defaults to a current, stable Chrome version (e.g. Chrome 133) and ensure the legacy UA and Client Hint versions match.

#### 🟢 Issue A-13: Case-sensitive WAF marker detection
* **File:** [`backend/src/services/scraper/transport/detection.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/transport/detection.ts#L35)
* **Description:** `detectBotChallenge` checks for `captcha` in a case-sensitive manner on `html` and `title`. This misses variants like `validateCaptcha` or `CAPTCHA`.
* **Refix Plan:** Lowercase the strings before performing checks, or use case-insensitive regular expressions.

---

## 2. Extraction & Parser Layer

#### 🟢 Issue S-1: Schema.org overrides global stock selectors without logging
* **File:** [`backend/src/services/scraper/extractors/stock/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/stock/index.ts#L58-L68)
* **Description:** Schema.org availability candidates are given a confidence of `0.90`, while global selectors receive `0.85`. If the two methods return conflicting statuses, the schema.org tag overrides the global selector silently with no warning log.
* **Refix Plan:** Add a `debug`-level log line if a higher-confidence schema.org candidate overrides a conflicting global selector value.

#### 🟢 Issue S-2: JSON-LD multi-offer stock resolution optimistically prefers `in_stock`
* **File:** [`backend/src/services/scraper/extractors/stock/schema.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/stock/schema.ts#L104-L117)
* **Description:** If a page contains multiple JSON-LD `Offer` blocks, the parser checks if *any* offer is in stock. If it finds one `in_stock` and one `out_of_stock` offer (e.g. secondary marketplace sellers), it resolves the entire page to `in_stock`.
* **Refix Plan:** Prefer the first `Offer` node (usually representing the primary/buybox seller) or require all offers to agree on stock status.

#### 🟢 Issue S-4: Generic phrase matching falls back directly to `body` text
* **File:** [`backend/src/services/scraper/extractors/stock/generic.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/stock/generic.ts#L16-L18)
* **Description:** When no main element is found on the page, the stock phrase matching scans the entire `<body>` text. This leads to false-positive stock statuses from recommendation lists, footer links, or cross-sell sections.
* **Refix Plan:** Add a final fallback to container selectors like `$('article, [class*="product"], [data-product]')` before falling back to `$('body')`.

#### 🟢 Issue E-1: ReDoS vulnerability in DOM denoiser regex
* **File:** [`backend/src/services/scraper/extractors/dom-denoiser.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/dom-denoiser.ts#L147-L153)
* **Description:** The regular expressions used to strip script, style, and noscript blocks contain nested-star quantifiers (`[^<]*(?:(?!<\/script>)<[^<]*)*`). Malformed or unclosed script tags on large pages can cause exponential backtracking and CPU denial of service.
* **Refix Plan:** Replace the regex patterns with non-backtracking alternatives or leverage Cheerio's native DOM removal (`$('script, style, noscript').remove()`) instead of raw regex replacement.

#### 🟢 Issue E-2: Stack overflow risk in stock JSON-LD recursion
* **File:** [`backend/src/services/scraper/extractors/stock/schema.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/stock/schema.ts#L75-L100)
* **Description:** The JSON-LD parser recursively traverses object keys using a nested helper function `walk` without keeping track of nesting depth, risking a stack overflow if it encounters a circular structure.
* **Refix Plan:** Add a maximum depth tracking counter (e.g., limit recursion to `depth > 10`) to prevent stack overflow errors.

#### 🟢 Issue P-2: JSON-LD price key dual-path resolution
* **File:** [`backend/src/services/scraper/extractors/price-extraction.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/price-extraction.ts#L44-L46)
* **Description:** The JSON-LD price extraction checks `lowPrice` and `price` fallback values independently from the configured `jsonLdPriceKey`, causing ambiguity during parsing.
* **Refix Plan:** Unify the resolution order under a single property evaluation path.

#### 🟢 Issue P-3: Duplicate candidates returned by JSON-LD price crawler
* **File:** [`backend/src/services/scraper/extractors/price-extraction.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/price-extraction.ts#L115)
* **Description:** Graph traversal structures can cause the same JSON-LD block to be parsed multiple times, generating duplicate price candidates that skew voting results.
* **Refix Plan:** Deduplicate candidates by `price` and `currency` before returning them.

#### 🟢 Issue P-4: Custom CSS extraction has no candidate count limit
* **File:** [`backend/src/services/scraper/extractors/custom-prices.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/custom-prices.ts#L16-L26)
* **Description:** Unlike generic extraction which limits candidates to 40, custom CSS extraction sets the limit to `0` (unlimited). A poorly targeted selector matching hundreds of nodes on a page will flood the voter.
* **Refix Plan:** Apply a reasonable limit (e.g. 20) in the `evaluatePriceSelectors` call in `custom-prices.ts`.

---

## 3. Orchestration & Consensus Layer

#### 🟢 Issue O-1: `priceCandidates` overwritten on auto-map re-extraction
* **File:** [`backend/src/services/scraper/orchestration/extraction.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/extraction.ts#L71)
* **Description:** When auto-mapping generates a new configuration, it re-runs the extraction phase. Doing so overwrites the first-pass `priceCandidates` array entirely, losing any candidates collected during the initial run.
* **Refix Plan:** Merge the new candidates into the existing candidate array rather than doing a raw reassignment.

#### 🟢 Issue O-2: `isCorroborated` null-guard is inverted
* **File:** [`backend/src/services/scraper/orchestration/consensus.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/consensus.ts#L103)
* **Description:** The line `const isCorroborated = !winningGroupSources || winningGroupSources.size > 1` evaluates to `true` when `winningGroupSources` is null (i.e. zero sources). This allows uncorroborated sources to completely bypass the out-of-stock guardrails.
* **Refix Plan:** Correct the null guard to: `const isCorroborated = !!winningGroupSources && winningGroupSources.size > 1;`.

#### 🟢 Issue O-3: OOS extreme drift guardrail ignores upward spikes
* **File:** [`backend/src/services/scraper/orchestration/consensus.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/consensus.ts#L106)
* **Description:** The drift check `const isExtremeDrift = anchorPrice && resolvedPrice < (anchorPrice * 0.5)` only flags downward spikes. An upward spike (e.g. an item price changing from $10 to $1000 due to a bad selector match) will pass unchecked.
* **Refix Plan:** Check both directions: `const isExtremeDrift = anchorPrice && (resolvedPrice < anchorPrice * 0.5 || resolvedPrice > anchorPrice * 2.5);`.

#### 🟢 Issue O-4: Config cache invalidated globally instead of per-domain
* **File:** [`backend/src/services/scraper/orchestration/maintenance.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/maintenance.ts#L92)
* **Description:** In maintenance functions, calling `configCache.invalidate()` without passing a domain key wipes the entire configuration cache, causing a thundering herd when the cache reloads.
* **Refix Plan:** Pass the target domain string to `configCache.invalidate(domain)` so that only the modified retailer config is evicted.

#### 🟢 Issue O-9: `scrapeProduct()` drops `retailerName`
* **File:** [`backend/src/services/scraper/orchestration/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/index.ts#L22-L34)
* **Description:** The simplified wrapper `scrapeProduct` returns fields like name, price, and imageUrl, but omits `retailerName`, preventing callers from seeing which brand was resolved.
* **Refix Plan:** Include `retailerName: res.retailerName` in the return object of `scrapeProduct`.

#### 🟢 Issue X-1: Auto-mapping re-runs full metadata extraction
* **File:** [`backend/src/services/scraper/orchestration/index.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/orchestration/index.ts#L148-L157)
* **Description:** Re-running the extraction phase after auto-mapping re-runs both Cheerio parsing and metadata parsing (name, stock, image). This can overwrite high-quality first-pass metadata with lower-quality generic results.
* **Refix Plan:** Preserve the first-pass metadata results (if non-null) and only re-run the price extraction phase.

---

## 4. Product & Persistence Layer

#### 🟢 Issue PS-1: Transaction bypass in metadata and stock updates
* **File:** [`backend/src/services/domain/product/ProductPersistenceService.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/product/ProductPersistenceService.ts#L118-L134)
* **Description:** Both `updateMetadata` and `updateStockState` take a `_client` transaction client parameter, but ignore it. Instead, they write to the database using default repository methods, which bypasses the database transaction entirely.
* **Refix Plan:** Thread the active transaction client to the repository update calls.

#### 🟢 Issue PS-2: TOCTOU race condition in standard price history records
* **File:** [`backend/src/services/domain/product/ProductPersistenceService.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/product/ProductPersistenceService.ts#L155)
* **Description:** `recordPrices` performs a `priceHistoryRepository.getLatest()` read outside the locked database client, exposing the write to a Time-of-Check to Time-of-Use race condition where duplicate price entries can be inserted.
* **Refix Plan:** Route the read and write operations inside the persistence service through the locked `_client`.

#### 🟢 Issue R-1: Notification triggers run outside locked advisory transaction
* **File:** [`backend/src/services/domain/product/ProductRefreshService.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/product/ProductRefreshService.ts)
* **Description:** The `preScrapePrice` check occurs before the lock is acquired, meaning concurrent refreshes can trigger false alert notifications.
* **Refix Plan:** Capture the baseline price inside the advisory transaction after locks are successfully acquired.

---

## 5. System & Security Layer

#### 🟢 Issue SYS-1: Admin email exposed in API response
* **File:** [`backend/src/services/domain/system/DatabaseHealthMonitor.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/system/DatabaseHealthMonitor.ts#L58)
* **Description:** The `getStatus()` method returns `cachedAdminEmail`, which is exposed on the public `/api/status` or admin debug endpoint.
* **Refix Plan:** Delete the `cachedAdminEmail` property from the return object in `getStatus()`.

#### 🟢 Issue SYS-2: Gemini API Key in query string
* **File:** [`backend/src/services/domain/system/settings/ai.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/system/settings/ai.ts#L76)
* **Description:** The Gemini models refresh method calls Google's API via a GET request with `?key=${apiKey}`, leaking the API credential to outgoing proxy/gateway server access logs.
* **Refix Plan:** Move the API key into the `x-goog-api-key` header configuration.

#### 🟢 Issue SYS-6: Server-Side Request Forgery (SSRF) vulnerability
* **File:** [`backend/src/services/domain/retailer/RetailerTestingService.ts`](file:///home/steven/projects/pricestalker/backend/src/services/domain/retailer/RetailerTestingService.ts#L8)
* **Description:** The retailer test and admin debug endpoints accept arbitrary URLs from the client and pass them directly to axios/scraper without protocol or IP address range validation.
* **Refix Plan:** Implement URL scheme validation (allow only `http`/`https`) and IP resolution checks to block requests targeting local/private loopback networks (e.g. `127.0.0.1`, `192.168.x.x`).
