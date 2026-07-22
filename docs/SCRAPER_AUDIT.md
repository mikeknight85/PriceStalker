# PriceStalker — Backend Scraper Audit (Issue Register)

> **Provenance & status:** this is the upstream engine's backend audit, imported
> as our landmine reference. `[COMPLETED]` markers reflect **the upstream author's
> codebase at the time of writing** — NOT necessarily this repo. We transplanted
> at one point in his history, so a fix marked completed here may or may not be
> present in our code. **Before acting on any issue, verify it against our actual
> source.** Issue IDs (S-1, P-2, C-3, V-1, X-2, …) are referenced from
> docs/SCRAPER_LIFECYCLE.md. Infrastructure specifics removed.


**Date:** 2026-07-01  
**Auditor:** Claude Sonnet 4.6 (Thinking)  
**Scope:** `backend/src/` — Full read-only codebase audit  
**Focus Areas:** Scrape orchestration pipeline · stock extraction · price candidate selection · consensus weighting · voting/learning loop

---

## 1. Pipeline Overview (As-Implemented)

The full retrieval pipeline is split across **six phases** inside `scrapeProductWithVoting` (orchestration/index.ts):

```
Phase 0: initScrapeSession        → Load domain config, AI settings, currency/locale hints
Phase 1: acquireHtml              → HTTP fetch or browser fallback via acquisition stack
Phase 2: runExtractionPhase       → DOM denoise → metadata (stock/title/image) → price candidates
Phase 3: Validation               → Success-first: ignore bot challenge if price data found
         handleRetailerMaintenance → Flag/restore blocked retailer
Phase 4: handleAutoMapping        → AI auto-generates retailer config if none exists
Phase 5: runConsensusPhase        → findPriceConsensus → weighted arbitration → OOS guardrails
         handleRestoreStatus      → Restore retailer blocked state on success
Phase 6: runVerificationPhase     → Optional AI cross-verification of selected price
         → Result returned to caller (ProductRefreshService / ProductDiscoveryService)
```

---

## 2. Stock Extraction Audit

### 2.1 Extraction Order
**File:** extractors/stock/index.ts

The stock extraction runs **four layers** in sequence, all candidates pooled and sorted by confidence:

| # | Method | Confidence | Source |
|---|--------|-----------|--------|
| 1 | Pre-order price selectors (`pre_order_price_selectors`) | Implicit high | `pre-order.ts` |
| 2 | Custom stock selectors (`stock_selectors`) | 0.95 | `custom.ts` |
| 3 | Schema.org `[itemprop="availability"]` | 0.90 | `schema.ts` |
| 3b | Global system stock selectors | 0.85 | `custom.ts` (isGlobal=true) |
| 4 | Generic phrase matching (main/body text) | 0.50 | `generic.ts` |

Winner = highest-confidence candidate where `value !== 'unknown'`.

### 2.2 Issue S-1: Schema.org May Override More Reliable Global Stock Selectors Without Logging [COMPLETED]

> **Severity: Medium**

In stock/index.ts L38-L47, schema.org (step 3) is extracted before global system stock selectors (step 3b). Both are added to the same `candidates[]` pool and the final sort runs by confidence descending.

- Schema.org candidates receive confidence **0.90**.
- Global selectors receive confidence **0.85**.

So schema.org correctly outranks global selectors. **However:** when an admin's global stock selector points to a more reliable element than a stale schema.org tag, the schema.org tag silently overrides it with no conflict logged.

**Recommendation:** Add a `debug`-level log line when a schema.org candidate overrides a global-selector candidate with a conflicting value.

---

### 2.3 Issue S-2: JSON-LD Multi-Offer Stock Resolution Optimistically Prefers `in_stock` [COMPLETED]

> **Severity: Medium — Logic Bug**

**File:** extractors/stock/schema.ts L104-L116

When multiple JSON-LD `availability` values are found (e.g. a product page with multiple `Offer` nodes), conflict resolution uses a preference order of `in_stock > pre_order > out_of_stock`:

```typescript
if (hasInStock) resolvedValue = 'in_stock';
else if (hasPreOrder) resolvedValue = 'pre_order';
else if (hasOos) resolvedValue = 'out_of_stock';
```

This means: if a page has **both** an `in_stock` offer and an `out_of_stock` offer (e.g. two sellers, one sold out), the system will **always resolve to `in_stock`**, even if the primary/buybox offer is OOS.

**Recommendation:** Instead of optimistic resolution, favour the **first** `Offer` node (which typically represents the buybox/primary seller) rather than performing a boolean reduce. Alternatively, require **all** JSON-LD offers to agree on `in_stock` before trusting it.

---

### 2.4 Issue S-3: `'unknown'` Stock Candidates Pollute Frontend Voting Data

> **Severity: Low**

**File:** extractors/stock/custom.ts L71-L79

When a custom stock selector matches text but no phrase maps to a known status, it pushes an `'unknown'` candidate with confidence 0.10. These are silently included in the `candidates[]` array. The `find(c => c.value !== 'unknown')` logic filters them out at the end, but they still accumulate in `result.stockCandidates` returned to the frontend voting modal, introducing noise.

**Recommendation:** Skip `unknown` candidates from being pushed into `result.stockCandidates`, or filter them out before building the final candidates list.

---

### 2.5 Issue S-4: Generic Phrase Matching Falls Back to Full `body` Text [COMPLETED]

> **Severity: Medium**

**File:** extractors/stock/generic.ts L14-L18

```typescript
let targetedArea = $('main, [role="main"], ...').first();
if (targetedArea.length === 0) {
  targetedArea = $('body');
}
```

When no `<main>` is found, the full `<body>` text is searched. On pages with recommendation widgets or multi-product sections containing "In Stock" text for other products, this produces **false positives**. The DOM denoiser mitigates this by stripping `<footer>`, `<nav>`, etc., but elements custom-preserved by retailer config selectors bypass the denoiser.

**Recommendation:** Add a final fallback to `$('article, [class*="product"], [data-product]')` before falling back to `$('body')`.

---

## 3. Price Selection Audit

### 3.1 Extraction Order
**File:** services/scraper/prices.ts

Price candidates are collected in this order:

```
1. JSON-LD       → extractJsonLdCandidates   (confidence 0.95, method: 'json-ld')
2. Deal          → deal_price_selectors       (confidence 0.95, method: 'deal-price')
3. Member        → member_price_selectors     (confidence 0.95, method: 'member-price')
4. Pre-order     → pre_order_price_selectors  (confidence 0.95, method: 'pre-order-price')
5. Original      → original_price_selectors   (confidence 0.95, method: 'original-price')
6. Custom CSS    → price_selectors            (confidence 0.90, method: 'custom-css')
7. Generic CSS   → global price selectors     (confidence 0.60, method: 'generic-css')
```

### 3.2 Issue P-1: Extraction Pass Method Override Produces No Selector-Level Debug Log [COMPLETED]

> **Severity: Medium — Debuggability**

**File:** prices.ts L78-L88

`extractCustomCandidates` internally calls `evaluatePriceSelectors` with `methodName: 'custom-css'`. Then immediately after, the code mutates each `c.method` to the pass method (e.g. `'deal-price'`). This works correctly — but the extraction step log shows only `Extract | Deals | Found N candidates` without surfacing **which selector** matched. Debugging a deal-price misconfiguration requires guessing which selector fired.

**Recommendation:** Add individual selector match logging at `debug` level inside the extraction pass loop.

---

### 3.3 Issue P-2: JSON-LD Price Key Has Dual-Path Resolution (Ambiguous Fallback) [COMPLETED]

> **Severity: Low**

**File:** prices.ts L63-L65

```typescript
const jsonLdPriceKey = domainConfig?.jsonld_price_key || settings?.jsonld_price_key || 'price';
```

`extractJsonLdCandidates` also checks `obj.lowPrice` as a fallback **independently** of `jsonLdPriceKey` (line 46 of `price-extraction.ts`). This creates a dual-path extraction: both the specified key and `lowPrice` may yield candidates with different values simultaneously.

**Recommendation:** Clarify in code comments that `jsonLdPriceKey` controls only the primary key path, and `lowPrice` is always checked as a secondary path, or unify both into the key resolution config.

---

### 3.4 Issue P-3: JSON-LD Recursive Extraction Produces Duplicate Candidates [COMPLETED]

> **Severity: Medium — Voting UI Noise**

**File:** price-extraction.ts L96-L107

The `findData` recursive function in `extractJsonLdCandidates` recurses into ALL object keys except `offers` and `priceSpecification`. A page with nested schema structures (e.g. a `Product` inside a `BreadcrumbList` inside a `WebPage`) may have its price extracted **multiple times** from different nesting paths, producing duplicate `json-ld` candidates.

The consensus engine correctly de-dupes by `sourceKey = 'json-ld:'` (no selector), preventing weight inflation. However, the raw `candidates` array returned still has duplicates, and the voting modal exposes `priceCandidates` directly to the frontend, creating confusing duplicate rows.

**Recommendation:** Deduplicate JSON-LD candidates by `(price, currency)` before adding to `allCandidates`.

---

### 3.5 Issue P-4: Custom CSS Extraction Has No Candidate Count Limit [COMPLETED]

> **Severity: Low — Weight Skew Risk**

**File:** prices.ts L94-L102

Generic CSS (Step 7) uses `evaluatePriceSelectors` with `limit: 40`. However the custom CSS path (Step 6) calls `extractCustomCandidates` with no limit (`limit: 0`). A poorly written custom selector matching 100 elements generates 100 `custom-css` candidates (weight 1.5 each), significantly inflating that group's weight compared to the cap-limited generic path.

**Recommendation:** Apply a reasonable per-selector candidate limit (e.g. 20) in `extractCustomCandidates` to prevent runaway weight accumulation from misconfigured custom selectors.

---

## 4. Consensus & Weight Audit

### 4.1 Weight Table
**File:** arbitrators/consensus.ts L57-L65

| Method | Weight |
|--------|--------|
| `expert-*` | 5.0 |
| `json-ld` | 2.0 |
| `custom-regex` | 1.6 |
| `custom-css` | 1.5 |
| `generic-css` | 0.2 |
| All others (default) | 1.0 |

### 4.2 Issue C-1: `deal-price` and `pre-order-price` Bypass the Weight System With No Drift Check [COMPLETED]

> **Severity: Low — By Design, But Undocumented Risk**

**File:** arbitrators/consensus.ts L37-L55

`deal-price` and `pre-order-price` candidates are short-circuited before the weighted fallback. A single `deal-price` candidate will always beat a group of 5 corroborated `json-ld` candidates. If `deal_price_selectors` is misconfigured and matches a promotional banner price, it silently overrides the correct buybox price. No `anchorPrice` drift check is applied at this stage.

**Recommendation:** Apply a basic `anchorPrice` drift check before accepting deal-price short-circuit results. If the deal price differs from the anchor by more than 40%, flag `needsReview = true` before returning.

---

### 4.3 Issue C-2: `pricesMatch` 5% Tolerance Can Group Distinct Low-Value Prices

> **Severity: Low**  
> **Status: Completed — resolved in v1.8.7**

**File:** arbitrators/utils.ts L6-L8

```typescript
return Math.abs(p1 - p2) / ((p1 + p2) / 2) < 0.05; // 5% tolerance
```

For items under ~$20, two genuinely different prices could be grouped:
- `$5.00` vs `$5.24` are grouped together (4.8% diff < 5%)
- `$10.00` vs `$10.48` are grouped together

This is risky with fractional pricing (e.g. per-unit vs per-pack prices on a grocery site).

**Recommendation:** Use an **absolute floor** in addition to the percentage: require `Math.abs(p1 - p2) < 0.10` (10 cents) AND `< 5%` relative, i.e. both conditions must be true for a match.

---

### 4.4 Issue C-3: Tie-Breaking Fallback Selects Lowest Price — Business Risk [COMPLETED]

> **Severity: Medium**

**File:** arbitration.ts L52-L58

```typescript
const best = [...candidatesToSelect].sort((a, b) => {
  if (Math.abs(a.confidence - b.confidence) > 0.001) return b.confidence - a.confidence;
  return a.price - b.price;  // lowest price wins on equal confidence
})[0];
```

When confidence is tied (e.g. a real $30 buybox price vs a $5 coupon price both have `custom-css` confidence 0.90), the promotional/lowest price always wins. This will consistently misreport prices.

**Recommendation:** On equal confidence, prefer the candidate closest to `anchorPrice` if available. If no anchor exists, pick the **median** candidate price and flag `needsReview = true` rather than selecting the lowest.

---

### 4.5 Issue C-4: OOS `highConfidenceMethods` List Has Undocumented Gaps [COMPLETED]

> **Severity: Low**

**File:** orchestration/consensus.ts L66-L79

The `highConfidenceMethods` array hardcodes method string literals. Any future method not prefixed with `expert-` and not explicitly in the list would be incorrectly nullified by the OOS guardrail. There is no compile-time enforcement.

**Recommendation:** Document the expected method string enum in a comment adjacent to `highConfidenceMethods`, and consider replacing the raw string array with a reference to a shared `ExtractionMethod` enum/const to prevent future omissions.

---

## 5. Voting & Learning Loop Audit

### 5.1 Flow

```
User votes in frontend Voting Modal
  → POST /products/:id/confirm OR POST /products (new)
  → ProductConfirmationService.confirmProductSelection / confirmNewProduct
  → productPersistenceService.saveScrapeResult (source: 'manual-confirm' | 'manual-add')
  → runAutoRetailerConfig → resolveWinningSelector → unshift selector to priority 0
  → configCache.invalidate()
```

### 5.2 Issue V-1: `runAutoRetailerConfig` Runs Outside the Persistence Transaction

> **Severity: HIGH — Data Consistency**

**File:** ProductPersistenceService.ts L55-L63

```typescript
await client.query('BEGIN');
// ... advisory lock, metadata update, stock, prices ...
await runAutoRetailerConfig({ ... });  // Opens its OWN pool connection + transaction
await productRepository.updateLastChecked(productId, product.refresh_interval);
await client.query('COMMIT');
```

`runAutoRetailerConfig` opens its **own** separate `pool.connect()` and its own `BEGIN/COMMIT` transaction. This creates a **split-brain scenario**:

1. If `runAutoRetailerConfig` fails, the price is **already committed** but the retailer config selector is **not saved** — silent partial failure.
2. If the outer transaction rolls back after `runAutoRetailerConfig` succeeds (e.g. `updateLastChecked` fails), the retailer config **has already been updated** with a selector that was never officially confirmed.
3. `configCache.invalidate()` fires inside `runAutoRetailerConfig`, **before** the outer `COMMIT` — the cache reloads the old config before the new price is even committed.

**Recommendation:** Pass the outer `PoolClient` into `runAutoRetailerConfig` and run the upsert within the existing transaction. Move `configCache.invalidate()` to **after** the outer `COMMIT`.

---

### 5.3 Issue V-2: `resolveWinningSelector` Falls Through to First-Price-Match When `selectedMethod` Is Null

> **Severity: Medium**

**File:** auto-config.helpers.ts L32-L41

```typescript
const winner = candidates.find(
  (c) => scrapedData.price && c.price === scrapedData.price.price && c.method === (scrapedData.selectedMethod || c.method)
);
```

If `scrapedData.selectedMethod` is `null` or `undefined`, the condition `c.method === (scrapedData.selectedMethod || c.method)` simplifies to `c.method === c.method` — **always true**. The **first** candidate with a matching price wins regardless of method, potentially incorrectly routing a `generic-css` selector into `price_selectors` when it should be ignored.

**Recommendation:** Add a null guard: if `scrapedData.selectedMethod` is null, skip the config update entirely (return `{ selector: undefined, method: undefined }`) rather than risking a wrong-method assignment.

---

### 5.4 Issue V-3: Selector Array Cap Is FIFO — No Staleness Tracking

> **Severity: Low**

**File:** auto-config.ts L116-L120

```typescript
price_selectors: priceSelectors.slice(0, 10),
```

Each confirmed vote `unshift`s a new winner to index 0, but when the array hits 10, the oldest (index 9) is silently dropped. There is **no eviction tracking** — the system cannot distinguish stale (failing) selectors from still-valid ones. A selector confirmed 10 votes ago (now broken because the site changed HTML) remains in the array until pushed out.

**Recommendation:** Add a `selector_last_matched_at` JSON map (or a `retailer_selector_stats` table) to track the last time each selector produced a match. Stale selectors (unmatched for > N days) can be deprioritized or evicted automatically.

---

### 5.5 Issue V-4: `confirmProductSelection` Does Not Clear `needs_price_review` on the Product Row

> **Severity: Medium**

**File:** confirmation.ts

When a user manually confirms a product via `confirmProductSelection`, `productPersistenceService.saveScrapeResult` is called. The persistence service saves price/stock but **does not clear `needs_price_review`** on the `products` table row. There is no call to `productRepository.update(productId, userId, { needs_price_review: false })` anywhere in the confirmation flow.

This means after a user successfully votes/confirms, the product may still appear in the review queue on subsequent scheduler runs.

**Recommendation:** After a successful `confirmProductSelection`, explicitly call `productRepository.update(productId, userId, { needs_price_review: false })` or add a `productRepository.clearNeedsReview(productId)` helper.

---

### 5.6 Issue V-5: `getAllGenericSelectors` Uses Raw `JSON.parse` Without Error Handling

> **Severity: Low — Inconsistency**

**File:** auto-config.helpers.ts L13-L14

```typescript
const rawOriginal = await settingsCache.get('generic_original_price_selectors');
const genericOriginal = rawOriginal ? JSON.parse(rawOriginal) : [];
```

All other generic selectors use dedicated typed `settingsCache.get*()` methods, but `generic_original_price_selectors` falls back to raw `settingsCache.get()` with manual `JSON.parse`. If the cache key changes or the JSON is malformed, this throws at runtime without type safety and no error handling.

**Recommendation:** Add a dedicated `settingsCache.getOriginalPriceSelectors()` typed method consistent with the other accessor patterns, and use it here with appropriate fallback.

---

## 6. Product Refresh Flow Audit

### 6.1 Flow
**File:** ProductRefreshService.ts

### 6.2 Issue R-1: Notification Logic Compares Pre-Scrape Price Captured Outside Advisory Lock [COMPLETED]

> **Severity: Medium — Race Condition**

**File:** ProductRefreshService.ts L27-L83

```typescript
const preScrapePrice = await priceHistoryRepository.getLatest(productId, 'standard'); // Captured here
const scrapedData = await scrapeProductWithVoting(...);                               // Takes seconds
await productPersistenceService.saveScrapeResult(productId, userId, scrapedData, 'refresh');
// ...
if (!preScrapePrice || preScrapePrice.price !== scrapedData.price.price) {
  await productNotificationService.notifyPriceDrop(...);  // Compares against stale preScrapePrice
```

`preScrapePrice` is captured before the scrape. In a concurrent scheduler environment, another worker could update the same product's price **during** the scrape. The advisory lock in `saveScrapeResult` prevents concurrent DB writes, but the notification check runs **after** the lock is released, allowing a second worker to update between `saveScrapeResult` and the notification comparison.

**Recommendation:** Capture `preScrapePrice` **inside** the persistence transaction (after acquiring the advisory lock) using the locked client, then pass it out for comparison.

---

### 6.3 Issue R-2: `checking_paused` Unpause Condition Uses Stale Product Object

> **Severity: Low**  
> **Status: Completed — resolved in v1.8.7**

**File:** ProductRefreshService.ts L44-L49

The `product` object is fetched once at the start of `refreshProduct`. If another concurrent request modifies `checking_paused` during the scrape (which can take many seconds), the stale `product.checking_paused` value leads to an incorrect unpause decision.

---

## 7. Cross-Cutting Issues

### 7.1 Issue X-1: Auto-Mapping Re-Runs Full Extraction Phase Including Metadata [COMPLETED]

> **Severity: Low — Redundant Work + Metadata Regression Risk**

**File:** orchestration/index.ts L138-L155

When auto-mapping generates a new retailer config, the code creates a fresh Cheerio parse and re-runs the entire `runExtractionPhase`. The DOM denoiser runs **twice** on the same HTML. Metadata (name, image, stock) is extracted **twice**, with the second pass overwriting the first. If the first extraction already found metadata using generic selectors, the second pass with the new config's selectors may find different or fewer results, degrading metadata quality.

**Recommendation:** Preserve non-null metadata fields from the first extraction and only re-run price candidate extraction with the new config.

---

### 7.2 Issue X-2: `isShellConfig` Excludes `pre_order_price_selectors` and `original_price_selectors`

> **Severity: Low**

**File:** orchestration/index.ts L113-L120

```typescript
const isShellConfig = domainConfig &&
  (!domainConfig.price_selectors || ...) &&
  (!domainConfig.deal_price_selectors || ...) &&
  (!domainConfig.member_price_selectors || ...) &&
  (!domainConfig.name_selectors || ...) &&
  (!domainConfig.image_selectors || ...) &&
  (!domainConfig.stock_selectors || ...);
  // pre_order_price_selectors and original_price_selectors NOT checked
```

A retailer config with **only** `pre_order_price_selectors` or `original_price_selectors` set would be classified as a "shell config" and trigger an unnecessary (and potentially destructive) AI auto-mapping call that overwrites the existing config.

**Recommendation:** Include `pre_order_price_selectors` and `original_price_selectors` in the `isShellConfig` guard.

---

### 7.3 Issue X-3: `HTML | Metadata | Length` Log Pushed After Metadata Extraction

> **Severity: Very Low — Log Ordering**

**File:** orchestration/extraction.ts L62

```typescript
await extractMetadata($, domainConfig || undefined, extractionSteps, result);
extractionSteps.push(`HTML | Metadata | Length: ${html.length} chars`);  // Should be BEFORE
```

The HTML length log line is pushed **after** metadata extraction, giving the misleading impression in debug traces that the length is a separator between metadata and price extraction phases.

**Recommendation:** Move this log push to before the `extractMetadata` call, or rename it to `HTML | Price Extraction | Starting | HTML Length: ...`.

---

## 8. Summary Table

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| S-1 | Medium | Stock | Schema.org silently overrides global stock selectors without logging | FIXED in fix-audit-issues |
| S-2 | Medium | Stock | JSON-LD multi-offer resolution optimistically prefers `in_stock` | FIXED in v1.9.2 |
| S-3 | Low | Stock | `unknown` stock candidates pollute frontend voting data | FIXED in easy-audit-fixes |
| S-4 | Medium | Stock | Generic phrase scan falls back to full `body` if no `<main>` | FIXED in fix-audit-issues |
| P-1 | Medium | Price | Deal/member/pre-order pass method override produces no selector-level log | FIXED in v1.9.2 |
| P-2 | Low | Price | JSON-LD price key has ambiguous dual-path `lowPrice` fallback | FIXED in fix-audit-issues |
| P-3 | Medium | Price | JSON-LD recursion yields duplicate candidates in voting UI | FIXED in fix-audit-issues |
| P-4 | Low | Price | Custom CSS extraction has no candidate count limit unlike generic | FIXED in fix-audit-issues |
| C-1 | Low | Consensus | `deal-price` short-circuit bypasses anchor drift check | FIXED in fix-audit-issues |
| C-2 | Low | Consensus | 5% price tolerance groups distinct low-value prices | FIXED in 1.8.7 |
| C-3 | Medium | Consensus | Tie-break fallback selects lowest price — business risk | FIXED in v1.9.2 |
| C-4 | Low | Consensus | OOS `highConfidenceMethods` list has undocumented method gaps | FIXED in fix-audit-issues |
| V-1 | **HIGH** | Voting | `runAutoRetailerConfig` runs outside persistence transaction | FIXED in 1.8.2 |
| V-2 | Medium | Voting | `resolveWinningSelector` falls through to wrong method when `selectedMethod` is null | FIXED in 1.8.2 |
| V-3 | Low | Voting | Selector array eviction is FIFO — no staleness tracking | FIXED in 1.8.2 / 1.0.55 |
| V-4 | Medium | Voting | `confirmProductSelection` does not clear `needs_price_review` on product row | FIXED in 1.8.2 |
| V-5 | Low | Voting | `original_price_selectors` uses raw `JSON.parse` without typed helper | FIXED in easy-audit-fixes |
| R-1 | Medium | Refresh | Notification compares pre-scrape price captured outside advisory lock | FIXED in fix-audit-issues |
| R-2 | Low | Refresh | `checking_paused` unpause decision uses stale product snapshot | FIXED in 1.8.7 |
| X-1 | Low | General | Auto-map re-runs full extraction phase including metadata (overwrite risk) | FIXED in fix-audit-issues |
| X-2 | Low | General | `isShellConfig` excludes `pre_order_price_selectors` and `original_price_selectors` | FIXED in easy-audit-fixes |
| X-3 | Very Low | General | `HTML | Metadata | Length` log push is out of sequence | FIXED in easy-audit-fixes |

---

## 9. Priority Recommendations

### Immediate (High Severity)
1. **V-1** — Move `runAutoRetailerConfig` inside the persistence transaction and defer `configCache.invalidate()` to post-commit. ✅ **FIXED in 1.8.2**

### Short-Term (Medium Severity)
2. **S-2** — Fix JSON-LD multi-offer stock resolution to use first-offer precedence, not optimistic `in_stock` preference. ✅ **FIXED in v1.9.2**
3. **C-3** — Replace "lowest price" tie-breaker with "closest to anchor" or "median" selection. ✅ **FIXED in v1.9.2**
4. **V-2** — Add null-guard to `resolveWinningSelector` for null `selectedMethod`. ✅ **FIXED in 1.8.2** (method whitelist now implicitly prevents null-method promotion)
5. **V-4** — Add explicit `needs_price_review = false` clear after user confirmation. ✅ **FIXED in 1.8.2**
6. **R-1** — Capture `preScrapePrice` inside the advisory lock scope for notification comparison. ✅ **FIXED in fix-audit-issues**
7. **P-3** — Deduplicate JSON-LD candidates by `(price, currency)` before adding to `allCandidates`. ✅ **FIXED in fix-audit-issues**
8. **VM-1** — Write `needs_price_review = true` to the DB during refresh when the scraper sets `needsReview=true` in-memory. ✅ **FIXED in 1.8.2 / 1.0.55**
9. **VM-2** — Show the CSS selector used for each candidate in the Voting Modal UI. ✅ **FIXED in 1.8.2 / 1.0.55**
10. **VM-6** — Add `json-ld` to the method whitelist in `resolveWinningSelector` so users confirming structured-data prices promote the selector. (N/A — structured JSON-LD data resolves dynamically and is omitted from whitelisted CSS-config promotion by design)

### Long-Term (Low Severity / Improvements)
11. **V-3** — Implement selector staleness tracking (e.g. `selector_last_matched_at` JSON map). ✅ **FIXED in 1.8.2 / 1.0.55**
12. **P-4** — Add per-selector candidate limit (e.g. 20) to `extractCustomCandidates`. ✅ **FIXED in fix-audit-issues**
13. **C-2** — Apply an absolute 10-cent floor condition to `pricesMatch` for low-value items. ✅ **FIXED in 1.8.7**
14. **X-1** — Refactor auto-map re-extraction to preserve first-pass metadata and re-run only price extraction. ✅ **FIXED in fix-audit-issues**
15. **X-2** — Add `pre_order_price_selectors` and `original_price_selectors` to `isShellConfig` check. ✅ **FIXED in easy-audit-fixes**
16. **V-5** — Add `settingsCache.getOriginalPriceSelectors()` typed accessor. ✅ **FIXED in easy-audit-fixes**
17. **VM-3** — Add visual badge/icon differentiation for `deal-price` and `member-price` candidates in the Voting Modal. ✅ **FIXED in 1.8.2 / 1.0.55**
18. **VM-4** — Add a "None of these are correct / Enter manually" escape hatch to the Voting Modal. ✅ **FIXED in 1.8.2 / 1.0.55**
19. **VM-5** — Fix the `originalPrice` asymmetry between `discovery.ts` and `rescan.ts` blobs. ✅ **FIXED in 1.8.2 / 1.0.55**

---

## 10. Voting Modal Audit — Frontend & Backend

**Scope:** Full end-to-end analysis of the price selection/voting flow presented to users.  
**Audited:** `PriceSelectionModal.tsx`, `useProductActions.ts`, `useDashboardState.ts`, `ProductService.ts`, `discovery.ts`, `rescan.ts`, `confirmation.ts`, `ProductPersistenceService.ts`, `auto-config.helpers.ts`

---

### 10.1 Architecture Overview

The voting/price-selection flow has **two entry points** that converge on the same modal:

```
New Product Add (POST /products/)
  └─ productDiscoveryService.initiateProductDiscovery()
       └─ if needsReview=true → returns PriceReviewResponse to client (nothing written to DB)
            └─ Client shows PriceSelectionModal
                 └─ User confirms → POST /products/ with selectedPrice + selectedMethod

Re-scan (POST /products/:id/scan)
  └─ ProductRescanService.scanProduct()
       └─ ALWAYS returns needsReview=true + full voting blob
            └─ Client shows PriceSelectionModal
                 └─ User confirms → POST /products/:id/confirm
                      └─ confirmation.ts → saveScrapeResult('manual-confirm') → runAutoRetailerConfig
```

The key behavioural difference: **new-product add** writes nothing until confirmed. **Re-scan** always gates on user review, even for automatic refreshes that don't need it.

---

### 10.2 Frontend Voting Modal

**File:** `PriceSelectionModal.tsx`

#### What Works Well ✅

| Feature | Detail |
|---------|--------|
| De-duplication | Candidates de-duped by price before display (lines 62–80) |
| Auto-selection | `suggestedPrice` candidate pre-selected automatically |
| Method labels | Human-readable labels via `METHOD_LABELS` map (e.g. `deal-price` → "Limited Deal") |
| Method descriptions | `METHOD_DESCRIPTIONS` map + `candidate.context` fallback |
| Confidence badges | Colour-coded: green ≥0.8, amber ≥0.6, grey <0.6 |
| Submit guard | Button disabled + spinner shown while submitting |
| Selector passthrough | `candidate.selector` flows correctly through `onSelect` → API payload |

#### Issues Found ❌

**VM-UI-1 (Medium): CSS Selector Not Shown to User**

`candidate.selector` is present in the data but **never rendered in the modal card**. Users cannot see which DOM element was targeted, making it impossible to judge correctness for ambiguous situations (e.g., generic `.price` vs a deal-specific `span.flash-price`).

> **File:** `PriceSelectionModal.tsx` lines 174–179  
> **Fix:** Render selector in a monospace `<code>` block beneath the method description, truncated with ellipsis if > 60 chars.

**VM-UI-2 (Low): No Visual Distinction for Special Price Types**

While `METHOD_LABELS` strings differ (`"Limited Deal"` vs `"Member Price"`), there is no icon, colour badge, or visual indicator differentiating special price types from standard retail prices. Given that `deal-price` is the system's highest-priority method and is auto-pre-selected, users get no visual cue explaining *why* one option is recommended over another.

> **Fix:** Add coloured left-border or badge icon for `deal-price` (e.g. 🏷️ orange) and `member-price` (e.g. 🔑 blue).

**VM-UI-3 (Low): No "None of These / Enter Manually" Escape Hatch**

If every candidate represents an incorrect price (e.g. accessory or shipping cost scraped instead of product price), the user has no option except **Cancel** — which aborts the entire product-add flow. There is no path to enter a price manually or skip to auto-tracking.

> **Fix:** Add a text link "I'll enter the price manually" below the candidates list, opening a simple `<input>` for manual price entry.

**VM-UI-4 (Low): No Validation on Selected Price**

`handleSelect()` only guards `selectedIndex === null || selectedIndex < 0`. Zero-confidence candidates and `$0.00` prices are submitted as-is without any warning.

> **Fix:** Warn (but don't block) if `selectedCandidate.confidence < 0.3` or `selectedCandidate.price <= 0`.

**VM-UI-5 (Low): Category Silently Discarded**

The `_category` parameter is prefixed with `_` in both `useDashboardState.ts` (line ~135) and `useProductDetailState.ts`, indicating it is intentionally discarded. It is never included in the confirm payload.

> **Fix:** Either remove `category` from `PriceSelectionModalProps` entirely, or correctly pass it through to the confirmation API.

**VM-UI-6 (Very Low): Modal Has No Awareness of Why It Was Triggered**

The modal has no `reason` or `reviewType` prop distinguishing "AI was unsure" from "no consensus found" from "OOS guardrail fired". All triggers render identical UI copy: "Select the correct price".

> **Fix:** Pass a `reviewReason` string from the backend voting blob (e.g. `"no_consensus"`, `"ai_correction"`, `"oos_guardrail"`) and display context-appropriate helper text in the modal header.

---

### 10.3 Backend Voting Flow

#### Confirmation Service (`confirmation.ts`)

The confirm flow is well-structured: it fetches the product, persists via `saveScrapeResult('manual-confirm')`, clears `needs_price_review`, unpauses checking, and returns the updated product. As of v1.8.2, `needs_price_review` is explicitly cleared and `ai_status` set to `'confirmed'` at `confirmation.ts` L78–81.

#### Issues Found ❌

**VM-1 (Medium): `needs_price_review` Is Never Written `true` to the DB During Refresh**

`needsReview` is an in-memory flag set on the scraper result object in several places:

| Location | Trigger |
|----------|---------|
| `arbitration.ts` L61 | No consensus found |
| `arbitration.ts` L72 | AI result pending review |
| `consensus.ts` L94, L101 | OOS guardrail fired |
| `verification.ts` L29 | AI corrected the extracted price |

However, **none of these in-memory flags are ever persisted to `products.needs_price_review = true`** during a scheduled refresh. `ProductRefreshService` calls `saveScrapeResult()` regardless of `needsReview`, and `saveScrapeResult` has no branch that writes `needs_price_review = true` to the DB.

The column can only be *cleared* — it is never *set* after the initial product add. This means:

- The UI's "needs review" badge/state relies on a DB column that is never triggered during scheduled monitoring.
- If a product that was previously confirmed suddenly starts failing consensus (e.g., retailer restructured their page), the user is never notified via the review queue.

> **Files:** `ProductRefreshService.ts`, `ProductPersistenceService.ts`  
> **Fix:** In `saveScrapeResult`, if `source === 'refresh'` and `scrapedData.needsReview === true`, call `productRepository.update(productId, userId, { needs_price_review: true })` before returning.

**VM-2 (Medium): `json-ld` and `generic-css` Confirmations Don't Promote Selectors**

`resolveWinningSelector` in `auto-config.helpers.ts` only promotes selectors from whitelisted methods: `custom-css`, `deal-price`, `member-price`, `pre-order-price`, `original-price`, `custom-regex`.

If a user confirms a **`json-ld` price** (the most reliable structured-data source), no selector is written to the retailer config. The retailer config learns nothing from this interaction — future scrapes still depend on generic JSON-LD parsing rather than the specific `priceSpecification` key or the particular `<script>` tag.

> **File:** `auto-config.helpers.ts` L37 (`allowedMethods` array)  
> **Fix:** Assess whether `json-ld` confirmations should write the `jsonld_price_key` to `retailer_configs` rather than a CSS selector.

**VM-3 (Low): `rescan.ts` Missing `originalPrice` in Voting Blob**

`discovery.ts` L51 includes `originalPrice` in the voting blob returned to the client. `rescan.ts` L19–37 omits it. This means:

- On a re-scan of a product that previously had an original/RRP price, the modal has no `originalPrice` to pass back in the confirmation payload.
- If the user's selection was intended to update the original price context, it silently drops.

> **File:** `rescan.ts` L19–37  
> **Fix:** Add `originalPrice: scrapedData.memberPrice || null` to the rescan voting blob (mirroring `discovery.ts`).

**VM-4 (Low): `html` Payload in Voting Blob Is Unguarded**

The full page HTML (`html`) is included in the `PriceReviewResponse` sent to the client at `discovery.ts` L54 and `rescan.ts` L36. For JS-heavy retailer pages rendered by Puppeteer (e.g. Amazon, JB Hi-Fi), this can be a **1–5 MB** JSON response. There is no size limit, truncation, or compression.

> **Fix:** Either strip `html` from the client response entirely (it's only used by the confirmation payload to pass back to `saveScrapeResult`, but `saveScrapeResult` uses it for metadata updates which have already been performed during the scan), or implement a hard 100KB limit with truncation.

**VM-5 (Very Low): `suggestedPrice` Not Linked to a Candidate Object**

The voting blob returns `suggestedPrice: { price, currency }` and `priceCandidates: [...]` separately. The frontend pre-selects the candidate matching `suggestedPrice.price` by price value comparison (de-dupe logic). If two candidates share the same price (e.g., a JSON-LD result and a CSS result both find `$99.99`), the "wrong" candidate could be pre-selected.

> **Fix:** Add a `suggestedCandidateIndex` field to the blob pointing directly to the recommended candidate index, eliminating ambiguous price-matching.

---

### 10.4 Data Flow Summary

```
Scraper                    Backend API              Frontend Modal          User Action
───────                    ───────────              ──────────────          ───────────
scrapeProductWithVoting()
  → priceCandidates[]      POST /products/scan      PriceSelectionModal
  → suggestedPrice         ←─ PriceReviewResponse   ← candidates[]
  → needsReview=true            (including html)     ← suggestedPrice       ← pre-selected
  → selectedMethod                                   ← confidence badges
  → selector (per cand.)                             ← method labels
                                                     ✗ selector NOT shown   ← user picks
                           POST /products/:id/confirm
                           → selectedPrice
                           → selectedMethod
                           → selector (CSS string)
                           → html (echoed back)
                            ↓
                           confirmation.ts
                           → saveScrapeResult('manual-confirm')
                             → updateExtractionMethod()   → clears needs_price_review
                             → runAutoRetailerConfig()    → promotes selector to DB
                           → productRepository.update({ needs_price_review: false, ai_status: 'confirmed' })
```

---

### 10.5 Voting Modal Issue Register

| ID | Severity | Layer | Issue | Status |
|----|----------|-------|-------|--------|
| VM-1 | Medium | Backend | `needs_price_review` never set `true` in DB during refresh; users never notified of ongoing monitoring failures | FIXED in v1.0.55 |
| VM-2 | Medium | Backend | `json-ld` confirmations do not promote selectors to retailer config; structured-data learnings are lost | CLOSED (structured data resolved dynamically) |
| VM-UI-1 | Medium | Frontend | CSS selector not shown in modal; users can't judge which DOM element found each price | FIXED in v1.0.46 |
| VM-3 | Low | Backend | `originalPrice` missing from `rescan.ts` voting blob (asymmetry with `discovery.ts`) | FIXED in v1.0.55 |
| VM-4 | Low | Backend | Full page `html` sent to client in voting blob; unguarded, can be 1–5 MB on JS-heavy pages | FIXED in denoised-html-payload (Denoised $.html() returned, hard truncation removed) |
| VM-UI-2 | Low | Frontend | No visual differentiation (badge/icon/colour) between `deal-price`, `member-price`, and standard prices | FIXED in v1.0.46 (Zone A Summary Context Layout) |
| VM-UI-3 | Low | Frontend | No "None of these / Enter manually" escape hatch; only Cancel available if all candidates are wrong | FIXED in v1.0.46 (Manual entry link + input form) |
| VM-UI-4 | Low | Frontend | No validation of selected price; zero-confidence and `$0.00` candidates submitted without warning | FIXED in v1.0.46 (Warn banner verification) |
| VM-UI-5 | Low | Frontend | `category` prop received by modal is silently discarded in both dashboard and detail confirm handlers | FIXED in v1.0.46 |
| VM-5 | Very Low | Backend | `suggestedPrice` not linked by index to candidate; ambiguous if two candidates share same price value | FIXED in v1.0.55 (Indexed hybrid sorted default) |
| VM-UI-6 | Very Low | Frontend | Modal has no awareness of review trigger reason; generic UI copy for all trigger conditions | FIXED in v1.0.46 (reviewReason subtitle copy) |
| VM-UI-7 | Low | Frontend | Scraper Workstation (debug page) Target Input card sidebar clipped at the bottom due to viewport height constraints | FIXED in v1.0.46 (Removed layout height restrictions for natural scrolling) |

---

## 11. Voting Modal Redesign Recommendation

> **Status:** Completed — fully implemented in v1.8.2 / v1.0.55 / v1.0.46  
> **Implementation Plan:** `plans/votingmodal1.md` (Completed)

---

### 11.1 Candidate Ordering — Method Tier + Confidence Hybrid

**Current behaviour:** Flat sort by `confidence desc → price asc`.

**Problem:** Confidence scores are method-agnostic numeric outputs. A generic CSS selector finding `$99.99` cleanly can score `0.95` while a retailer-specific deal-price selector scores `0.88` — but the deal selector is structurally more meaningful and should rank higher regardless.

**Recommendation — two-key sort:**

| Priority | Sort Key | Rationale |
|----------|----------|-----------|
| 1st | Method tier (ascending) | Structural priority: domain-specific selectors above generic fallbacks |
| 2nd | Confidence (descending) | Within same tier, higher confidence wins |

**Proposed tier table:**

| Tier | Methods | Rationale |
|------|---------|-----------|
| 1 | `deal-price`, `member-price`, `pre-order-price`, `original-price` | Domain-specific custom selectors — highest signal |
| 2 | `custom-css`, `custom-regex` | Admin-configured retailer selectors |
| 3 | `json-ld` | Structured schema data — reliable but generic |
| 4 | `ai`, `standard-css` | Heuristic extraction |
| 5 | `generic-css` | Broadest match, most ambiguous |

**Pre-selection:** Always the first entry in the sorted list. The `suggestedPrice` field should be retired from the blob — the sort order makes the recommendation structurally self-evident.

**De-duplication:** Change from `(price)` to `(price, tier)`. If `deal-price` and `json-ld` both independently found `$99.99`, show both cards. The "2 sources agree" signal is valuable information for the user.

---

### 11.2 Price Display — Two-Zone Split Layout

**Current behaviour:** `memberPrice` and `originalPrice` are returned in the voting blob as separate top-level fields but never surfaced to the user. The modal shows a flat list of standard-price candidates only.

**Problem:** A user seeing four candidates at `$99.99`, `$99.99`, `$89.99`, `$149.99` has no idea which represents the deal price, the member price, or the RRP without carefully reading small method-label text.

**Recommendation — two-zone modal layout:**

**Zone A — Price Context Panel (read-only, top):**

A structured summary of all extracted prices, shown for context before the user selects:

```
┌─────────────────────────────────────────────────────┐
│  Standard Price:   $99.99                           │
│  Deal Price:       $89.99   🏷 Flash Sale           │
│  Member Price:     $79.99   🔑 Login required       │
│  Original / RRP:  $149.99   ~~strikethrough~~       │
└─────────────────────────────────────────────────────┘
```

Only rows where a price was found are rendered.

**Zone B — Candidate Selection (interactive, bottom):**

The existing card-based list, filtered by a pill-tab type selector:

```
[ Standard (4) ]  [ Deal (1) ]  [ Member (1) ]  [ RRP (1) ]
```

Users select the **price type** to track first, then select **which candidate** within that type. This makes intent explicit — the system knows the user wants to track the deal price, not the standard price.

**Backend change required:** Promote `memberPrice` and `originalPrice` into `priceCandidates[]` with appropriate method identifiers (`member-price`, `original-price`) rather than as separate top-level fields. The confirmation payload already handles these as separate named fields, so no DB schema change is needed.

---

### 11.3 Minor UX Hardening

| # | Change | Priority |
|---|--------|----------|
| 1 | Show CSS selector per candidate in `<code>` block beneath method description | Medium |
| 2 | Add "None of these / Enter price manually" text link below candidate list | Low |
| 3 | Show warning toast if `$0.00` or `confidence < 0.3` candidate is submitted | Low |
| 4 | Remove `category` from `PriceSelectionModalProps` or wire it through confirm payload | Low |
| 5 | Add `reviewReason` field to voting blob; display contextual header copy in modal | Very Low |

---

### 11.4 Backend Blob Restructure (Summary)

```diff
// PriceReviewResponse — proposed changes
{
  needsReview: true,
  name: string | null,
  imageUrl: string | null,
  stockStatus: string,
- suggestedPrice: { price, currency } | null,   // REMOVE — sort order makes this redundant
+ reviewReason: 'no_consensus' | 'ai_correction' | 'oos_guardrail' | 'manual_rescan',
  priceCandidates: PriceCandidate[],             // NOW INCLUDES member-price, original-price entries
- memberPrice: { price, currency } | null,       // REMOVE — surfaced via priceCandidates tier
- originalPrice: { price, currency } | null,     // REMOVE — surfaced via priceCandidates tier
  url: string,
- html: string | null,                           // REMOVE or cap at 100KB — not needed client-side
}
```

---

## 12. Bugs Discovered During Unit Test Session — 2026-07-02

The following bugs were uncovered while writing and running new Vitest unit tests for `urlHelper.ts` and `price/parser.ts`. Both are documented in their respective test files with `TODO` comments.

---

### 12.1 Issue U-1: `cleanUrl` Hash Fragment Stripping Has False-Positive Matches via Single-Char KEEP_LIST Entries

> **Severity: Low — Incorrect URL Normalisation**  
> **Discovered:** 2026-07-02 (unit test session — `url-helper.test.ts`)  
> **Status: Completed — resolved in v1.8.6**

**File:** `src/utils/scraping/urlHelper.ts` L64

```typescript
const hasEssentialHash = KEEP_LIST.some(k => hashLower.includes(k)) || hashLower.includes('pid');
if (!hasEssentialHash) {
  urlObj.hash = '';
}
```

The `KEEP_LIST` contains single-character entries like `'v'` (intended to match the `?v=` query parameter for YouTube/versioned URLs). However, the hash-stripping guard uses `.includes(k)` against the full hash content — meaning the letter `'v'` will match **any fragment containing the letter v**, including `#reviews`, `#overview`, `#nav`, `#saved`, etc.

**Example:**
```
https://example.com/product#reviews
→ '#reviews'.includes('v') === true   ← KEEP_LIST 'v' causes false match
→ Hash is NOT stripped (incorrect behaviour)
```

**Impact:** URLs with common hash fragments (`#reviews`, `#overview`, `#availability`) are not cleaned, meaning duplicate product entries could be created if users add the same product URL with different hash fragments.

**Recommendation:** Restrict hash matching to multi-character KEEP_LIST entries, or replace `.includes(k)` with a word-boundary regex that avoids single-char false positives:

```typescript
const hasEssentialHash = KEEP_LIST
  .filter(k => k.length > 1)   // Exclude single-char entries for hash matching
  .some(k => hashLower.includes(k)) || hashLower.includes('pid');
```

Alternatively, maintain a separate `HASH_KEEP_LIST` distinct from the query-param KEEP_LIST.

---

### 12.2 Issue U-2: `parsePrice` Incorrectly Resolves `Fr.` (Swiss Franc Short Form) to `'FR.'` Instead of `'CHF'`

> **Severity: Low — Wrong Currency Code Returned**  
> **Discovered:** 2026-07-02 (unit test session — `price-parser.test.ts`)  
> **Status: Completed — resolved in v1.8.6**

**File:** `src/utils/scraping/price/parser.ts` L46–48

```typescript
const resolved = currencyHelper.getCurrencyFromSymbolSync(currencySymbol, localeHint);
currency = resolved || CURRENCY_MAP[currencySymbol.toUpperCase()] || currencySymbol.toUpperCase() || 'USD';
//                     ↑ CURRENCY_MAP lookup happens AFTER .toUpperCase()
```

`CURRENCY_MAP` contains the key `'Fr.'` mapped to `'CHF'`. However, the map lookup is performed on `currencySymbol.toUpperCase()`, which transforms `'Fr.'` into `'FR.'` before the lookup — so `CURRENCY_MAP['FR.']` is `undefined`, and the fallback `currencySymbol.toUpperCase()` returns the raw string `'FR.'` as the currency code instead of `'CHF'`.

**Impact:** Any scraper extraction that parses Swiss price strings like `Fr. 49.90` will store `'FR.'` as the currency code rather than the ISO 4217 `'CHF'`. Downstream currency conversion via `currencyConversionService` will fail silently because `'FR.'` is not a recognised ISO code, causing CHF prices to be treated as unknown currency.

**Recommendation:** Either:
- Perform the `CURRENCY_MAP` lookup **before** calling `.toUpperCase()`:
  ```typescript
  currency = resolved || CURRENCY_MAP[currencySymbol] || CURRENCY_MAP[currencySymbol.toUpperCase()] || currencySymbol.toUpperCase() || 'USD';
  ```
- Or add `'FR.'` as an additional key in `CURRENCY_MAP` alongside `'Fr.'`:
  ```typescript
  // In constants.ts
  'Fr.': 'CHF',
  'FR.': 'CHF',   // Add this line
  ```

The second option is a one-line fix and requires no logic change.

---

### 12.3 Issue Register Addendum

| ID | Severity | Area | Description | Status |
|----|----------|------|-------------|--------|
| U-1 | Low | URL Normalisation | `cleanUrl` hash stripping false-positive via single-char `'v'` in KEEP_LIST — fragments like `#reviews` not stripped | Completed |
| U-2 | Low | Price Parsing | `Fr.` (Swiss franc short form) resolved to `'FR.'` instead of `'CHF'` due to uppercase-before-map-lookup ordering | Completed |

---

## 13. Round 2 Deep Audit — Full Stack Analysis — 2026-07-16

**Auditor:** Claude Sonnet 4.6 (Thinking) — 5-agent parallel audit  
**Scope:** Full read of all backend layers: orchestration, acquisition, transport, extractors, arbitration, product services, system services, routes  
**Files Audited:** 40+ source files across all service domains  

---

### 13.1 Orchestration Layer (`scraper/orchestration/`)

---

#### Issue O-1 — CRITICAL: `priceCandidates` Overwritten (Not Merged) on Auto-Map Re-Extraction

> **Severity: Critical — Data Loss**

**File:** orchestration/extraction.ts L74  
**Also:** orchestration/index.ts L144–154

```typescript
// extraction.ts
result.priceCandidates = allCandidates; // ← full overwrite, not merge
```

When auto-mapping triggers a second `runExtractionPhase` call (`priceOnly: true`), the assignment blindly overwrites all price candidates from the first pass. If the new AI-generated config returns fewer or zero candidates, the first-pass candidates — which may have been valid — are permanently lost before consensus runs. The arbitration phase then operates on a depleted pool.

**Recommendation:** Merge instead of overwrite:
```typescript
result.priceCandidates = [...(result.priceCandidates || []), ...allCandidates];
```

---

#### Issue O-2 — HIGH: `isCorroborated` Null-Guard Is Logically Inverted

> **Severity: High — OOS Guardrail Bypass**

**File:** orchestration/consensus.ts L75

```typescript
const isCorroborated = !winningGroupSources || winningGroupSources.size > 1;
```

`!winningGroupSources` is `true` when sources are `null/undefined` — meaning "no source info" is treated as corroborated. In practice `winningGroupSources` is always a `Set` (never null), so the guard is dead code, but if the upstream ever changes to return null, uncorroborated json-ld prices would pass the OOS guardrail silently.

**Recommendation:** Invert the guard to be safe-by-default:
```typescript
const isCorroborated = !!winningGroupSources && winningGroupSources.size > 1;
```

---

#### Issue O-3 — HIGH: OOS Extreme Drift Guardrail Only Catches Downward Price Spikes

> **Severity: High — Logic Bug**

**File:** orchestration/consensus.ts L78

```typescript
const isExtremeDrift = anchorPrice && resolvedPrice < (anchorPrice * 0.5);
```

An upward spike (e.g. `$200 → $2000` due to currency parsing error or wrong element) passes this check entirely. A 10× price increase is as suspicious as a 50% drop.

**Recommendation:**
```typescript
const isExtremeDrift = anchorPrice && (
  resolvedPrice < (anchorPrice * 0.5) ||
  resolvedPrice > (anchorPrice * 2.5)
);
```

---

#### Issue O-4 — HIGH: `configCache.invalidate()` Nukes Entire Cache on Every Auto-Map and Status Restore

> **Severity: High — Performance / Thundering Herd**

**File:** orchestration/maintenance.ts L93, L131

```typescript
configCache.invalidate(); // ← no domain argument — clears ALL cached configs
```

Called on every `handleAutoMapping` and `handleRestoreStatus`. Under concurrent load, a config upsert for domain A evicts all other domains, forcing DB re-fetches from every in-flight scrape. Other callers (e.g. `RetailerMutationService`) correctly pass a domain key.

**Recommendation:**
```typescript
configCache.invalidate(domain);              // in handleAutoMapping
configCache.invalidate(domainConfig.domain); // in handleRestoreStatus
```

---

#### Issue O-5 — HIGH: `handleRestoreStatus` Logs Wrong Step Message for Status-Restore vs Engine-Upgrade

> **Severity: High — Observability**

**File:** orchestration/maintenance.ts L115–132

A single `needsUpdate` flag merges two distinct cases (status restore and remote-scraper engine upgrade) under one extraction step message: `"Auto-upgraded config in DB to Remote Scraper"`. This is logged even when only the status was restored with no engine upgrade.

**Recommendation:** Branch the log message based on which condition fired.

---

#### Issue O-6 — MEDIUM: `requestId` Has Only 1,000 Possible Values — Collisions Under Concurrency

> **Severity: Medium — Observability**

**File:** orchestration/index.ts L49

```typescript
const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
```

Multiple scrapes dispatched within the same millisecond (common in batch refresh) share the same `Date.now()`. With only 1,000 random values, log trace collisions are likely.

**Recommendation:** Use `crypto.randomUUID()` or increase entropy to `1_000_000`.

---

#### Issue O-7 — MEDIUM: `isShellConfig` Ignores `jsonld_price_key` — Triggers False Auto-Map for JSON-LD-Only Configs

> **Severity: Medium — Correctness**

**File:** orchestration/index.ts L114–122

A config relying solely on `jsonld_price_key` (no CSS selectors) is classified as a shell, triggering unnecessary AI auto-mapping that could overwrite a valid JSON-LD-only config.

**Recommendation:** Add `jsonld_price_key` and `jsonld_name_key` to the `isShellConfig` guard check.

---

#### Issue O-8 — MEDIUM: Arbitrated Prices Wrongly Treated as Uncorroborated in OOS Guardrail

> **Severity: Medium — Logic Bug**

**File:** orchestration/consensus.ts L47–94

When `findPriceConsensus` fails and `performArbitration` runs, `winningGroupSources` retains an empty `Set` from the failed consensus call. The OOS guardrail then evaluates `isCorroborated = false`, causing even AI-selected json-ld prices to be nullified.

**Recommendation:** Add a `wasArbitrated: boolean` flag to the result and skip the corroboration check when set.

---

#### Issue O-9 — MEDIUM: `scrapeProduct()` Wrapper Silently Drops `retailerName` Field

> **Severity: Medium — Data Loss**

**File:** orchestration/index.ts L22–34

The simplified `scrapeProduct()` wrapper maps fields from `scrapeProductWithVoting()` but omits `retailerName` from the returned object, losing extracted retailer name data for all callers.

**Recommendation:** Add `retailerName: res.retailerName` to the return object.

---

#### Issue O-10 — MEDIUM: AI Arbitration/Verification Errors Swallowed Silently — No `logger.error` Call

> **Severity: Medium — Observability**

**Files:** arbitration.ts L38–40, orchestration/verification.ts L32–34

AI failures (rate limits, network timeouts, invalid API key) produce only a trace entry in `extractionSteps` — no server-side `logger.error` call. Systemic AI provider failures are invisible to monitoring.

**Recommendation:** Add `logger.error(...)` with the full error object before the `extractionSteps.push`.

---

#### Issue O-11 — MEDIUM: `resolveScrapeContext` Called Twice on Auto-Map Re-Extraction

> **Severity: Medium — Performance**

**File:** orchestration/extraction.ts L29–36

Same URL, HTML, and userId across both extraction passes — `resolveScrapeContext` produces identical results but re-executes cache/DB lookups on the re-extract.

**Recommendation:** Skip `resolveScrapeContext` when `options.priceOnly` is set; reuse values from the first pass.

---

#### Issue O-12 — LOW: `ReviewReason` Local Type in `arbitration.ts` Missing `'price_drift'`

> **Severity: Low — Type Safety**

**File:** arbitration.ts L19

The locally-declared union type omits `'price_drift'` which exists in the canonical `types/scraper.ts`. A DRY violation that requires two places to update.

**Recommendation:** Import and use the canonical `ReviewReason` type from `types/scraper.ts`.

---

#### Issue O-13 — LOW: `globalAiSettings` Typed as `any` in `ScrapeSessionContext`

> **Severity: Low — Type Safety**

**File:** orchestration/init.ts L11

`settingsCache.getAISettings()` returns `Promise<AISettings>` but the context interface uses `any`, preventing TypeScript from catching property misspellings.

**Recommendation:** Use the `AISettings` type for this field.

---

### 13.2 Acquisition & Transport Layer

---

#### Issue A-1 — CRITICAL: `transport/remote.ts` Off-by-One Retry Loop — Max Retries Sentinel Is Dead Code

> **Severity: Critical — Logic Bug**

**File:** transport/remote.ts L9–89

```typescript
const maxRetries = 3;
let retryCount = 0;
while (retryCount <= maxRetries) {   // 4 iterations: 0,1,2,3
  ...
  if (status === 503 && retryCount < maxRetries) { // retries at 0→1,1→2,2→3 only
    retryCount++;
    continue;
  }
  throw new Error(`Remote Scraper Failed (${status}): ${msg}`); // fires on 4th iter
}
throw new Error('Remote Scraper Failed: Max retries exceeded'); // ← DEAD CODE
```

On the 4th iteration `retryCount < maxRetries` is `false`. The code throws the first error, never the sentinel. The "max retries exceeded" error is unreachable, making it impossible to distinguish "max retries hit" from "non-retryable error."

**Recommendation:** Refactor to a `for` loop with `MAX_ATTEMPTS` and distinct error messages per exit path.

---

#### Issue A-2 — HIGH: `usedRemoteFallback` Set Before Remote Attempt Succeeds — Blocks Attempt 3

> **Severity: High — Logic Bug**

**File:** acquisition/index.ts L38–44

```typescript
if (useRemoteScraper || requiresBrowser) {
  usedRemoteFallback = true;         // ← set before success check
  const remoteHtml = await acquireRemoteHtml(options);
  if (remoteHtml) { html = remoteHtml; }
}
```

If `acquireRemoteHtml()` returns `null`, `usedRemoteFallback` is already `true`. Attempt 3's guard `!usedRemoteFallback` permanently blocks the dynamic fallback, leaving the scraper in a silent dead end.

**Recommendation:** Move `usedRemoteFallback = true` inside the `if (remoteHtml)` block.

---

#### Issue A-3 — HIGH: Challenged Remote HTML Prevents Attempt 3 With No Recovery

> **Severity: High — Logic Bug**

**File:** acquisition/index.ts L67–77

If the remote scraper returns a bot-challenged page, `challengeReason` is set but `usedRemoteFallback` is already `true`, permanently blocking Attempt 3. The challenged HTML is returned to the extraction pipeline as if valid.

**Recommendation:** Decouple "remote was the primary strategy" from "fallback was exhausted" using a separate `fallbackWasAttempted` flag.

---

#### Issue A-4 — HIGH: Fallback Result Never Checked for Challenge Before Acceptance

> **Severity: High — Data Integrity**

**Files:** acquisition/index.ts L86–91, acquisition/fallback.ts

```typescript
if (fallbackResult) {
  return { ...fallbackResult, usedRemoteFallback: true };
  // ← no check that fallbackResult.challengeReason is null
}
```

If the remote fallback itself returns a Cloudflare-challenged page, this is returned as-is to the extraction pipeline.

**Recommendation:**
```typescript
if (fallbackResult && !fallbackResult.challengeReason) {
  return { ...fallbackResult, usedRemoteFallback: true };
}
```

---

#### Issue A-5 — HIGH: Proxy URL With Credentials Logged in Plaintext

> **Severity: High — Security / Credential Leak**

**File:** acquisition/standard.ts L32

```typescript
extractionSteps.push(`Request | Proxy | Using: ${currentProxy}`);
```

`currentProxy` is a full `user:password@host:port` URL. Stored in the database inside `extractionSteps` for every scrape — a direct violation of the project's sensitive-data scrubbing mandate.

**Recommendation:**
```typescript
const safeProxy = currentProxy ? new URL(currentProxy).hostname : 'None';
extractionSteps.push(`Request | Proxy | Using host: ${safeProxy}`);
```

---

#### Issue A-6 — HIGH: Hardcoded Chrome 121 UA and `Sec-Ch-Ua` Client Hints — Stale and Fingerprintable

> **Severity: High — Bot Detection Risk**

**File:** transport/headers.ts L20–25

```typescript
'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
'Sec-Ch-Ua-Platform': '"Windows"',
```

Chrome 121 was released January 2024. Static values from a 2+ year old browser version are an immediate bot detection signal for modern WAFs. The UA version and `Sec-Ch-Ua` version must also be internally consistent.

**Recommendation:** Update to current Chrome version. Consider a database-backed pool of consistent UA + client-hint pairs rotated per-request.

---

#### Issue A-7 — HIGH: Axios 1.x Uses `CanceledError` Not `AbortError` — Abort Safety Net Is Broken

> **Severity: High — Logic Bug**

**File:** transport/remote.ts L61

```typescript
if (axios.isCancel(error) || error.name === 'AbortError') { ... }
```

Axios `1.14.0` (project pin) names cancellation errors `'CanceledError'`. The 65s `AbortController` safety net's error path is never triggered correctly.

**Recommendation:** Add `|| error.name === 'CanceledError'`, or rely solely on `axios.isCancel(error)`.

---

#### Issue A-8 — HIGH: Inconsistent Retry Budget — Worst-Case 150s Per URL

> **Severity: High — Performance**

**File:** acquisition/standard.ts L39–76

Primary: `maxRetries: 1`. Proxy fallback: `maxRetries: 2`. With 30s timeouts: `(30×2) + (30×3) = 150s` worst-case for a single URL.

**Recommendation:** Standardise to `maxRetries: 1` for the fallback path.

---

#### Issue A-9 — MEDIUM: `Sec-Fetch-Site: none` Conflicts With Referrer Header

> **Severity: Medium — Bot Detection Risk**

**File:** transport/headers.ts L28

Sending `Sec-Fetch-Site: none` while including a Google referrer is contradictory. Real browsers send `Sec-Fetch-Site: cross-site` when a referrer is present. Cloudflare validates `Sec-Fetch-*` consistency.

**Recommendation:** Set `'Sec-Fetch-Site'` dynamically: `'cross-site'` when referrer is set, `'none'` for direct navigation.

---

#### Issue A-10 — MEDIUM: Missing `Accept-Encoding` Header — Detectable Bot Signal

> **Severity: Medium — Bot Detection Risk**

**File:** transport/headers.ts

Real browsers always include `Accept-Encoding: gzip, deflate, br`. Its absence is a detectable signal.

**Recommendation:** Explicitly add `'Accept-Encoding': 'gzip, deflate, br'` to `getHeaders()`.

---

#### Issue A-11 — MEDIUM: HTTP 407/401 Proxy Auth Errors Not Handled — Propagate as Unhandled Crashes

> **Severity: Medium — Error Handling**

**File:** acquisition/standard.ts L116–125

`handleAxiosError` handles 403/404/410/429 but not 407 or 401. These fall to a raw `throw err`, propagating as unhandled AxiosErrors that crash the outer scrape cycle.

**Recommendation:** Treat 407/401 as a `BotChallengeError` and log appropriately.

---

#### Issue A-12 — MEDIUM: Empty Remote HTML Body Silently Treated as Successful Extraction

> **Severity: Medium — Data Integrity**

**File:** transport/remote.ts L58

```typescript
return response.data.html || '';
```

If the remote scraper returns `{ "error": "timeout", "html": null }`, an empty string is returned. `detectBotChallenge('')` returns null (no challenge), and the pipeline proceeds as if extraction succeeded with an empty DOM.

**Recommendation:** Validate: if `!response.data.html`, throw an error rather than returning `''`.

---

#### Issue A-13 — MEDIUM: Case-Sensitive WAF Marker Detection

> **Severity: Medium — Bot Detection Accuracy**

**File:** transport/detection.ts L25–31

WAF markers like `'Incapsula incident ID'` and `'perimeterx'` are case-sensitive. Vendors may alter casing without notice.

**Recommendation:** Use a cached `htmlLower = html.toLowerCase()` and match against lowercase patterns throughout.

---

#### Issue A-14 — LOW: Akamai Reference ID Pattern Too Specific

> **Severity: Low — Bot Detection Accuracy**

**File:** transport/detection.ts L10

```typescript
html.includes('Reference #18.')  // misses Reference #1., #22., etc.
```

**Recommendation:** Use regex: `/Reference #\d+\./.test(html)`.

---

#### Issue A-15 — LOW: `withRetry` Logs Under `'AI'` Category for HTTP Scraper Calls

> **Severity: Low — Observability**

**File:** acquisition/standard.ts L39

`withRetry` hardcodes `'AI |'` as the log prefix. HTTP scraper retry failures appear under the AI subsystem — misleading.

**Recommendation:** Generalise `withRetry` to accept a log category parameter.

---

### 13.3 Extractor & Arbitration Layer

---

#### Issue E-1 — HIGH: `denoiseHtmlForRegex` Uses Nested-Quantifier Regex — ReDoS Vulnerability

> **Severity: High — Security / Performance**

**File:** extractors/dom-denoiser.ts L149–153

```typescript
.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
```

Nested quantifiers on large HTML exhibit catastrophic backtracking on malformed input (missing `</script>` tag). A ReDoS attack vector — O(2ⁿ) regex engine time.

**Recommendation:** Replace with lazy match `/<script[\s\S]*?<\/script>/gi` or use Cheerio DOM removal: `$('script:not([type="application/ld+json"]), style, noscript').remove(); $.html()`.

---

#### Issue E-2 — HIGH: `stock/schema.ts` — `walk()` Has No Depth Guard — Infinite Recursion on Malformed JSON-LD

> **Severity: High — Stack Safety**

**File:** extractors/stock/schema.ts L96–98

```typescript
} else if (typeof obj === 'object') {
  Object.values(obj).forEach(walk);
}
```

No depth limit. Deeply nested or circular-reference JSON-LD can exhaust the call stack. `obj.offers` is also visited twice — by the explicit `if (obj.offers)` branch and again via `Object.values(obj)`, producing duplicate availability candidates.

**Recommendation:** Add a depth counter (`if (depth > 20) return`). Skip `offers` and `priceSpecification` keys during the generic traversal.

---

#### Issue E-3 — HIGH: AI Arbitration Receives `allCandidates` Including Member/Original Prices

> **Severity: High — Logic Bug**

**File:** arbitration.ts L28

```typescript
const aiResult = await tryAIArbitration(url, html, allCandidates, userId, productId);
```

`allCandidates` includes `member-price` and `original-price` candidates. The AI disambiguation prompt may select a member-only or strikethrough price as the "best" standard price.

**Recommendation:** Pass `standardCandidates` (filtered at line 23) instead.

---

#### Issue E-4 — MEDIUM: `extractJsonLdCandidates` Double-Processes `priceSpecification` Nodes

> **Severity: Medium — Duplicate Candidates**

**File:** extractors/price-extraction.ts L73–118

`priceSpecification` items are handled in Block A (direct extraction) and then visited again during the general `Object.keys` recursion in Block B, producing duplicate candidates.

**Recommendation:** Skip `priceSpecification` in the general recursion loop as is already done for `offers`.

---

#### Issue E-5 — MEDIUM: `dom-denoiser.ts` — JSON-LD Blocks Duplicated in DOM After Re-Append

> **Severity: Medium — Duplicate Candidates**

**File:** extractors/dom-denoiser.ts L116–141

JSON-LD scripts are cloned before noise removal, then clones are re-appended. If the original JSON-LD was not inside a removed noise container, the original survives AND the clone is added — two copies in the DOM.

**Recommendation:** Explicitly remove original JSON-LD scripts before re-appending clones:
```typescript
$('script[type="application/ld+json"]').remove();
// ... then re-append clones
```

---

#### Issue E-6 — MEDIUM: `normalizeSelector` Splits on `|` Inside CSS Attribute Selectors — Corrupts Selectors

> **Severity: Medium — Logic Bug / Selector Corruption**

**File:** core/selectors.ts L13–18

```typescript
if (trimmed.includes('|')) {
  const parts = trimmed.split('|');
```

`div[lang|="en"]` (CSS language-subcode attribute selector) would be incorrectly split into `div[lang::attr(="en"])` — a completely invalid selector.

**Recommendation:** Only apply the `|` → `::attr()` normalization when the `|` appears after the last `]` in the string.

---

#### Issue E-7 — MEDIUM: No Maximum Price Sanity Guard — Barcodes/SKUs Enter Candidate Pool as Valid Prices

> **Severity: Medium — Data Integrity**

**Files:** extractors/price-extraction.ts, extractors/price-utils.ts

If a CSS selector accidentally picks up an EAN barcode (`4901234567890`) that `parsePrice` interprets numerically, it enters the candidate pool with 0.9 confidence. Consensus can propagate a multi-trillion dollar "price" to the DB.

**Recommendation:** Reject candidates where `price > 100000` (unless product has a known high-value anchor). Log rejections as debug extraction steps.

---

#### Issue E-8 — MEDIUM: Member/Original Price Consensus Uses Array Position, Not Confidence Score

> **Severity: Medium — Logic Bug**

**File:** arbitrators/consensus.ts L19–30

```typescript
groups.sort((a, b) => b.length - a.length);
memberPrice = groups[0][0]; // ← first candidate, not highest confidence
```

A 0.6-confidence generic CSS candidate inserted before a 0.95-confidence JSON-LD candidate returns the wrong value.

**Recommendation:** Pick the highest-confidence candidate within the winning group:
```typescript
memberPrice = groups[0].sort((a, b) => b.confidence - a.confidence)[0];
```

---

#### Issue E-9 — MEDIUM: `hasConsensus` Weight Threshold `>= 1.0` — Single JSON-LD Source Reaches Consensus

> **Severity: Medium — Logic Bug**

**File:** arbitrators/consensus.ts L94

```typescript
let hasConsensus = topGroup.totalWeight >= 1.0;
```

A single `json-ld` candidate (weight 2.0) or `custom-regex` (weight 1.6) reaches consensus with zero corroborating evidence from any other source.

**Recommendation:** Consider requiring `totalWeight >= 2.0` for single-source consensus or `topGroup.sources.size > 1`.

---

#### Issue E-10 — MEDIUM: `pricesMatch` Absolute Tolerance `< 1.00` Causes Grouping Failures for High-Value Items

> **Severity: Medium — Logic Bug**

**File:** arbitrators/utils.ts L12

```typescript
return (absDiff / ((p1 + p2) / 2) < 0.05) && (absDiff < 1.00);
```

For a $2500 item: `$2500.00` vs `$2501.00` has 0.04% relative diff (within 5%) but $1.00 absolute diff — fails the strict `< 1.00` check and lands in separate groups, splitting consensus weight.

**Recommendation:** Scale the absolute floor: `absDiff < Math.max(1.00, mid * 0.01)`.

---

#### Issue E-11 — MEDIUM: Anchor-Price Fallback Sets `aiStatus = 'confirmed'` Without AI Involvement

> **Severity: Medium — Metadata Integrity**

**File:** arbitration.ts L49–50

The anchor-price nearest-candidate selection sets `aiStatus = 'confirmed'` even though no AI was involved. DB records and logs will show AI-confirmed prices that were algorithmically selected.

**Recommendation:** Use `aiStatus = null` or a distinct `'anchor-confirmed'` status for this path.

---

#### Issue E-12 — MEDIUM: `add to trolley` Hardcoded In-Stock Phrase in Generic Stock Extractor

> **Severity: Medium — Hardcoding**

**File:** extractors/stock/generic.ts L39–43

```typescript
textToSearch.includes('add to trolley')
```

AU/UK locale-specific phrase hardcoded in the generic detector — unmanageable without a code deploy.

**Recommendation:** Move to the default `in_stock_phrases` setting in `system_settings`.

---

#### Issue E-13 — MEDIUM: Add-to-Cart Button Detection Too Broad — False In-Stock Positives

> **Severity: Medium — Logic Bug**

**File:** extractors/stock/generic.ts L31–36

Using `in_stock_phrases` (words like "buy", "add", "cart") to scan all `button, a, .btn` elements produces false positives from navigation links and promotional banners.

**Recommendation:** Restrict to specific selectors: `button[class*="add" i], form[action*="cart"] button` with `not([disabled])`.

---

#### Issue E-14 — MEDIUM: Silent Exception Swallowing in Stock Selector Evaluation

> **Severity: Medium — Error Handling**

**File:** extractors/stock/custom.ts L32–74

```typescript
} catch (e) {}
```

Broken retailer selectors fail silently with zero candidates and zero diagnostic trace.

**Recommendation:** Log at debug level: `logger.debug('Stock selector failed: ' + s + ' - ' + e, 'Scraper')`.

---

#### Issue E-15 — MEDIUM: DOM Ancestor Traversal Not Short-Circuited in `getPreservedElements`

> **Severity: Medium — Performance**

**File:** extractors/dom-denoiser.ts L71–78

For each preserved element, all ancestors up to `<html>` are traversed unconditionally. 20 selectors × 3 matches × 30 DOM depth = 1,800 lookups per scrape. Early termination when an ancestor is already preserved would cut this significantly.

**Recommendation:** Check `preserved.has(cur)` before traversing upward and break on first already-preserved ancestor.

---

#### Issue E-16 — MEDIUM: XPath Re-Serializes Full DOM on Every XPath Selector Evaluation

> **Severity: Medium — Performance**

**File:** `core/engine.ts L37–38`

```typescript
const wellFormedHtml = $.xml();
const doc = new DOMParser().parseFromString(wellFormedHtml, 'text/xml');
```

Each XPath selector causes a full DOM serialize + re-parse. 5 XPath selectors on a 200KB page = 5 unnecessary full DOM round-trips per scrape.

**Recommendation:** Cache the `xmldom` document in the scrape context, constructing it once per session.

---

#### Issue E-17 — MEDIUM: JSON-LD `"$"` Currency Defaults to `'USD'` Without Locale Awareness

> **Severity: Medium — Currency Resolution**

**File:** extractors/price-extraction.ts L51–56

```typescript
if (currency === "$") {
  currency = currencyHint || 'USD';
}
```

Australian, Canadian, or NZ retailers using `"$"` in JSON-LD without a `currencyHint` have all candidates recorded as USD.

**Recommendation:** Route through `currencyHelper` resolution instead of hardcoding `'USD'`.

---

#### Issue E-18 — LOW: Invalid Regex Patterns Swallowed Silently

> **Severity: Low — Observability**

**File:** extractors/price-extraction.ts L12–24

```typescript
try { const regex = new RegExp(finalPattern, flags); ... } catch (e) {}
```

Broken retailer regex patterns fail silently. Operators cannot distinguish "selector found nothing" from "selector threw."

**Recommendation:** Log at debug level: `logger.debug('Invalid regex pattern: ' + pattern, 'Scraper')`.

---

#### Issue E-19 — LOW: `isNoiseElement` Runs All 10 Ancestor Iterations on Detached Nodes

> **Severity: Low — Robustness**

**File:** core/selectors.ts L138–143

In some Cheerio edge cases with detached/orphaned nodes, the `parent.length` check never terminates the loop early.

**Recommendation:** Add `if (!parent[0] || parent.is('html, body')) break;`.

---

### 13.4 Product Services Layer

---

#### Issue PS-1 — CRITICAL: `updateMetadata` and `updateStockState` Accept a `PoolClient` But Never Use It — Writes Escape the Outer Transaction

> **Severity: Critical — Data Consistency**

**File:** ProductPersistenceService.ts L100–142

```typescript
private async updateMetadata(
  _client: PoolClient, // "Reserved for future transactional needs" — never used
  ...
) {
  await productRepository.update(productId, userId, metadataUpdates); // ← uses pool
}
```

Both methods accept `_client` but ignore it. All writes use the global pool, committing independently of the advisory-locked outer transaction. A rollback leaves metadata/stock changes already committed — partial inconsistent DB state.

**Recommendation:** Rename `_client` → `client` and thread it through every repository call. Repository methods must accept an optional `PoolClient` parameter.

---

#### Issue PS-2 — CRITICAL: `recordPrices` Performs a Second `getLatest()` Outside the Locked Client — TOCTOU Race

> **Severity: Critical — Race Condition**

**File:** ProductPersistenceService.ts L36, L156

`preScrapePrice` is correctly fetched inside the advisory lock. However, `recordPrices()` performs its own `getLatest()` call using the default pool. Under concurrent scheduling, a second worker can update the same product's price between these two reads, producing TOCTOU duplicate price insertions.

**Recommendation:** Pass the `client` into `recordPrices()` and issue all reads through it.

---

#### Issue PS-3 — HIGH: `notifyPriceDrop` Fires on Price Increases When `threshold = 0`

> **Severity: High — Logic Bug / Notification Spam**

**File:** notifications/alerts.ts L61–62

```typescript
const priceDrop = oldPrice - newPriceObj.price;
if (priceDrop < (product.price_drop_threshold || 0)) return;
```

When `threshold = 0`, guard becomes `priceDrop < 0`. A price increase produces negative `priceDrop`, which passes — triggering a "price drop" notification on a price rise.

**Recommendation:**
```typescript
if (priceDrop <= 0) return; // price didn't drop
if (priceDrop < (product.price_drop_threshold || 0)) return;
```

---

#### Issue PS-4 — HIGH: `notifyTargetHit` Fires on Every Price Change While Below Target — No Dedup

> **Severity: High — Notification Spam**

**File:** notifications/alerts.ts L96–98

```typescript
if (newPriceObj.price > targetPrice || (oldPrice !== null && oldPrice <= targetPrice)) return;
```

If price fluctuates while staying below target (e.g. $49.99 → $48.99), `oldPrice !== newPrice` means a new target-hit notification fires on every price change.

**Recommendation:** Track `target_notified_at` or `target_last_notified_price` on the product. Only fire on transition from above-target to at-or-below-target.

---

#### Issue PS-5 — HIGH: `notifyPriceAnnounced` Fires Spuriously on First-Ever Add of Pre-Order Product

> **Severity: High — Spurious Notification**

**File:** ProductRefreshService.ts L74–78

`freshProduct` is fetched after persistence (post-save). If a product is just added with `stock_status = 'pre_order'` and no prior price, `isPreOrderNoPrice` is `true` — firing a "price announced" notification on first-ever add.

**Recommendation:** Capture `oldStockStatus` before `saveScrapeResult` and base the check on pre-save status.

---

#### Issue PS-6 — HIGH: Image Permanently Blocked From Update Once Any Non-Placeholder URL Is Set

> **Severity: High — Stale Data**

**File:** `utils/metadata.ts L40`

```typescript
if (currentImageUrl && !currentImageUrl.includes('placeholder')) return null;
```

Broken CDN paths, outdated thumbnails, or 404'd images can never be replaced through normal scraping once set.

**Recommendation:** Remove the unconditional block or add a URL validity check. Consider a `forceUpdate` flag for manual re-scans.

---

#### Issue PS-7 — HIGH: Product Name Never Corrected Once Set to a Bad-But-Not-Blacklisted Value

> **Severity: High — Stale Data**

**File:** ProductPersistenceService.ts L111–115

`sanitizeProductName` only blacklists ~8 specific names. A garbled, truncated, or locale-placeholder name not in the blacklist can never be corrected by subsequent scrapes.

**Recommendation:** Add a minimum length check (`name.length < 5`) and consider allowing updates when a higher-confidence name is found.

---

#### Issue PS-8 — HIGH: `auto-config.ts` Outer `catch` Silently Swallows All Errors — Outer Transaction Not Rolled Back

> **Severity: High — Data Consistency**

**File:** utils/auto-config.ts L210–212

When `runAutoRetailerConfig` is called within an existing transaction (`ownClient = false`) and fails, the error is logged and swallowed. The outer `saveScrapeResult` transaction is never notified and proceeds to `COMMIT` with partial results.

**Recommendation:**
```typescript
} catch (err) {
  logger.error(`Retailer | Config Auto-Update Failed | ...`, 'Products');
  if (!ownClient) throw err; // propagate so outer TX can roll back
}
```

---

#### Issue PS-9 — MEDIUM: `syncUserCategories` Runs Outside the Transaction

> **Severity: Medium — Data Consistency**

**File:** ProductPersistenceService.ts L57–60

`syncUserCategories` uses the global pool, committing independently. If the outer transaction rolls back, a dangling category reference persists for a product that was never saved.

**Recommendation:** Thread the transaction client through to `syncUserCategories` → `userRepository.addCategories`.

---

#### Issue PS-10 — MEDIUM: `resolveWinningSelector` Method Filter Is Always True When `selectedMethod` Is Null

> **Severity: Medium — Logic Bug**

**File:** utils/auto-config.helpers.ts L38–44

```typescript
c.method === (scrapedData.selectedMethod || c.method)
// When selectedMethod is null: c.method === c.method → always true
```

Any price-matching candidate wins regardless of method — potentially routing a `generic-css` selector into `price_selectors`.

**Recommendation:**
```typescript
(!scrapedData.selectedMethod || c.method === scrapedData.selectedMethod)
```

---

#### Issue PS-11 — MEDIUM: `confirmation.ts` — `...options` Spread Passes Untrusted Client Data to Persistence Service

> **Severity: Medium — Security**

**File:** add/confirmation.ts L36–49

```typescript
{ ...options, price: ..., selectedMethod, html } as any
```

`options` is raw `req.body`. A client could inject `needsReview: false`, `aiStatus: 'confirmed'`, or crafted `priceCandidates` to bypass review flags.

**Recommendation:** Explicitly whitelist known-safe fields rather than spreading the entire `options` object.

---

#### Issue PS-12 — MEDIUM: 4 Sequential Pre-Scrape DB Queries — Should Be Parallelised

> **Severity: Medium — Performance**

**File:** ProductRefreshService.ts L21–24

```typescript
const preferredMethod = await productRepository.getPreferredExtractionMethod(productId);
const anchorPrice = await productRepository.getAnchorPrice(productId);
const skipAiVerification = await productRepository.isAiVerificationDisabled(productId);
const skipAiExtraction = await productRepository.isAiExtractionDisabled(productId);
```

Four independent sequential DB calls add unnecessary latency before every scrape.

**Recommendation:** `Promise.all([...])` or consolidate into a single `getScrapeSettings(productId)` query.

---

#### Issue PS-13 — MEDIUM: All Selector Failure Counters Incremented Even When No Custom Match Was Attempted

> **Severity: Medium — Logic Bug**

**File:** utils/auto-config.ts L126–145

When `winningSelector` is undefined (generic/json-ld fallback used), ALL stored custom selectors have `consecutive_failures` incremented — even though they were never tested. Legitimate selectors may be evicted prematurely.

**Recommendation:** Only increment `consecutive_failures` when the selector was actually evaluated against the page.

---

#### Issue PS-14 — MEDIUM: Hardcoded `'USD'` Currency Fallback in Notification Alerts

> **Severity: Medium — Currency Integrity**

**File:** notifications/alerts.ts L40, L46, L54

```typescript
currency: scrapedData.price?.currency || 'USD',
```

Contradicts the multi-currency resolution architecture. Australian store products show "Back in stock at $X USD."

**Recommendation:** Fall back to the product's stored currency from the DB, not a hardcoded `'USD'`.

---

### 13.5 System Services & Routes Layer

---

#### Issue SYS-1 — CRITICAL: `DatabaseHealthMonitor.getStatus()` Exposes Admin Email in API Response

> **Severity: Critical — Security / Data Exposure**

**File:** DatabaseHealthMonitor.ts L54–62

```typescript
getStatus() {
  return {
    ...
    cachedAdminEmail: this.cachedAdminEmail,  // ← exposed
    ...
  };
}
```

Called from `GET /api/admin/debug/db-health`. Admin email address is returned in every status poll response.

**Recommendation:** Remove `cachedAdminEmail` from `getStatus()` entirely.

---

#### Issue SYS-2 — HIGH: Gemini API Key Passed in URL Query String — Leaks to Server Logs

> **Severity: High — Security / Credential Leak**

**File:** `settings/ai.ts L139`

```typescript
const response = await axios.get(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
```

URL query parameters are captured in proxy logs, access logs, and error tracking tools.

**Recommendation:** Pass as header: `{ headers: { 'x-goog-api-key': apiKey } }`.

---

#### Issue SYS-3 — HIGH: `warmCache()` Hardcodes `WHERE id = 1` as Admin User

> **Severity: High — Logic Bug**

**File:** DatabaseHealthMonitor.ts L29–37

```typescript
const result = await pool.query("SELECT email FROM users WHERE id = 1");
```

Will cache the wrong email if user 1 is deleted, recreated, or another user is promoted to admin.

**Recommendation:** `SELECT email FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1`

---

#### Issue SYS-4 — HIGH: `SettingsListenerService` Reconnect Loop Has No Backoff — Hammers Pool During Outages

> **Severity: High — Performance / Availability**

**File:** SettingsListenerService.ts L59–74

```typescript
reconnectTimeout = setTimeout(() => connectAndListen(), 5000); // flat 5s forever
```

360 failed `pool.connect()` attempts per hour during a DB outage, combined with `DatabaseHealthMonitor`'s retry cycle.

**Recommendation:** Exponential backoff: `Math.min(initialDelay * Math.pow(2, retryCount), 60000)`.

---

#### Issue SYS-5 — HIGH: Spurious "Outage Resolved" Email Without Prior Alert Sent

> **Severity: High — Logic Bug**

**File:** DatabaseHealthMonitor.ts L82–89

`markHealthy()` sends "Outage Resolved" whenever `currentState === 'FAILED'`. But the "Outage Started" email only fires when `failureCount >= 3`. A monitor restart while in FAILED state sends "resolved" without a corresponding "started."

**Recommendation:** Track `private alertSent = false`. Only send "resolved" if `alertSent` is `true`.

---

#### Issue SYS-6 — HIGH: SSRF via Unchecked URL in Retailer Test Endpoint

> **Severity: High — Security**

**Files:** RetailerTestingService.ts L8–23, `routes/admin/debug.ts L32`

`url` from `req.body` is passed directly to `scrapeProductWithVoting()` / `axios.get()` with no validation. An admin could probe `http://169.254.169.254/metadata` (AWS IMDS), `file:///etc/passwd`, or internal services.

**Recommendation:** Validate URL protocol (`https:`/`http:` only) and reject known internal IP ranges.

---

#### Issue SYS-7 — HIGH: `products/scan.ts` and `products/bulk.ts` Use Raw `async` Handlers

> **Severity: High — Error Handling**

**Files:** `routes/products/scan.ts`, `routes/products/bulk.ts`

Unlike all other routes in the project, these bypass the project-standard `asyncHandler` wrapper. `error.message` stringification produces `[object Object]` for non-Error throws.

**Recommendation:** Refactor to use `asyncHandler` for consistent error propagation.

---

#### Issue SYS-8 — HIGH: `deleteRetailer()` TOCTOU — Non-Atomic Fetch-Then-Delete

> **Severity: High — Data Integrity**

**File:** RetailerMutationService.ts L65–69

Between `getAllRetailers()` and `retailerRepository.delete(id)`, another request could mutate the target record. The wrong cache key is then invalidated.

**Recommendation:** Use `RETURNING domain` on the DELETE query for atomic domain retrieval.

---

#### Issue SYS-9 — MEDIUM: `sendAlertEmail` Fire-and-Forget — Duplicate Alert Email Risk

> **Severity: Medium — Reliability**

**File:** DatabaseHealthMonitor.ts L86, L110

`sendAlertEmail` is `async` but called without `await`. A second `checkHealth` firing before the first send completes can queue duplicate alerts.

**Recommendation:** Add a `private alertInFlight = false` guard inside `sendAlertEmail`.

---

#### Issue SYS-10 — MEDIUM: TLS Certificate Verification Disabled for SMTP

> **Severity: Medium — Security**

**File:** DatabaseHealthMonitor.ts L135–137

```typescript
tls: { rejectUnauthorized: false }
```

Blanket TLS verification bypass allows MITM interception of critical system alert emails.

**Recommendation:** Remove and use system CA certs by default. Load self-signed certs explicitly via `ca:` if required.

---

#### Issue SYS-11 — MEDIUM: `computeFallbacksForModels` Catch-All Condition Matches Almost Every OpenAI Model

> **Severity: Medium — Logic Bug**

**File:** `settings/ai.ts L36–42`

```typescript
(!id.includes('gpt-4o-mini') && !id.includes('gpt-3.5-turbo'))
```

This negative condition is true for virtually any model string that isn't exactly those two — a tautological catch-all.

**Recommendation:** Use explicit positive matching: `if (id.includes('gpt-4') || id.startsWith('o1') || id.startsWith('o3'))`.

---

#### Issue SYS-12 — MEDIUM: Settings Update Loop Has No Transaction — Partial Save Risk

> **Severity: Medium — Data Consistency**

**File:** `settings/system.ts L45–50`

10 settings submitted = 10 sequential non-transactional writes. A crash mid-loop leaves settings partially saved with no rollback.

**Recommendation:** Wrap the loop in a PostgreSQL transaction.

---

#### Issue SYS-13 — MEDIUM: `SettingsListenerService` — Stale Debounce Closure Not Cancelled on Reconnect

> **Severity: Medium — Resource Leak**

**File:** SettingsListenerService.ts L20–21

Old `debounceTimeout` closure is never cleared on reconnect. A dangling timer from the old connection may fire `configCache.invalidate()` on stale state.

**Recommendation:** Promote `debounceTimeout` to the outer scope alongside `reconnectTimeout`.

---

#### Issue SYS-14 — MEDIUM: API Key Masking Detection Fragile — `"..."` Pattern Can Match Real Keys

> **Severity: Medium — Logic Bug**

**File:** `settings/ai.ts L100–111`

```typescript
const isMasked = (val: any) => typeof val === 'string' && val.includes('...');
```

A real API key containing `...` would be silently skipped and not saved.

**Recommendation:** Use an explicit sentinel: return `'__MASKED__'` when redacting; check for that exact string on update.

---

#### Issue SYS-15 — LOW: `CurrencyConversionService` — No Timeout on Frankfurter API Call

> **Severity: Low — Reliability**

**File:** CurrencyConversionService.ts L17–19

No `timeout` option on the external Frankfurter request — a hung call blocks the 4 AM cron job indefinitely.

**Recommendation:** Add `timeout: 10000`.

---

#### Issue SYS-16 — LOW: AUD→AUD Self-Rate Never Written to DB

> **Severity: Low — Correctness**

**File:** CurrencyConversionService.ts L23–32

Frankfurter does not return the base currency's self-rate. `getRate('AUD', 'AUD')` returns `null` instead of `1.0`, potentially triggering a nonsensical triangulation.

**Recommendation:** Explicitly upsert `(base, base, 1.0)` after fetching rates.

---

#### Issue SYS-17 — LOW: `PUT /admin/users/:id` Passes Raw `req.body` to Service Without Field Whitelist

> **Severity: Low — Security**

**File:** routes/admin/users.ts L74–86`

`req.body` is passed raw to `adminUpdateUser`. If a `password` field is included without triggering the hashing flow, it could be stored in plaintext depending on service implementation.

**Recommendation:** Explicitly destructure allowed fields at the route level before passing to the service.

---

### 13.6 Issue Register — Round 2

| ID | Severity | Layer | Area | Description | Status |
|----|----------|-------|------|-------------|--------|
| O-1 | **Critical** | Orchestration | `extraction.ts` | `priceCandidates` overwritten on auto-map re-extract — first-pass candidates permanently lost | Pending |
| O-2 | **High** | Orchestration | `consensus.ts` | `isCorroborated` null-guard inverted — uncorroborated sources bypass OOS guardrail | Completed |
| O-3 | **High** | Orchestration | `consensus.ts` | OOS drift only checks downward spikes — upward spikes (e.g. $200→$2000) pass unchallenged | Completed |
| O-4 | **High** | Orchestration | `maintenance.ts` | `configCache.invalidate()` with no domain key — nukes entire cache, thundering herd | Pending |
| O-5 | **High** | Orchestration | `maintenance.ts` | Wrong extraction step logged for status-restore vs engine-upgrade | Pending |
| O-6 | **Medium** | Orchestration | `index.ts` | `requestId` only 1,000 entropy values — collisions in concurrent batch runs | Pending |
| O-7 | **Medium** | Orchestration | `index.ts` | `isShellConfig` ignores `jsonld_price_key` — JSON-LD-only configs trigger spurious AI auto-mapping | Pending |
| O-8 | **Medium** | Orchestration | `consensus.ts` | Arbitrated prices wrongly treated as uncorroborated in OOS guardrail | Pending |
| O-9 | **Medium** | Orchestration | `index.ts` | `scrapeProduct()` silently drops `retailerName` from return value | Completed |
| O-10 | **Medium** | Orchestration | `arbitration.ts` / `verification.ts` | AI arbitration/verification errors swallowed — no `logger.error` call | Pending |
| O-11 | **Medium** | Orchestration | `extraction.ts` | `resolveScrapeContext` called twice on auto-map re-extract — redundant DB/cache hits | Pending |
| O-12 | **Low** | Orchestration | `arbitration.ts` | Local `ReviewReason` type missing `'price_drift'` — diverges from canonical type | Completed |
| O-13 | **Low** | Orchestration | `init.ts` | `globalAiSettings` typed as `any` — loses TypeScript safety | Completed |
| A-1 | **Critical** | Transport | `transport/remote.ts` | Off-by-one retry loop — max retries sentinel is dead code; attempts miscounted | Pending |
| A-2 | **High** | Acquisition | `acquisition/index.ts` | `usedRemoteFallback` set before success — blocks Attempt 3 on remote failure | Pending |
| A-3 | **High** | Acquisition | `acquisition/index.ts` | Challenged remote HTML blocks fallback via flag — no recovery path | Pending |
| A-4 | **High** | Acquisition | `acquisition/index.ts` | Fallback result never checked for challenge — challenged HTML sent to extraction pipeline | Pending |
| A-5 | **High** | Acquisition | `standard.ts` | Proxy credentials (`user:password@host`) logged in plaintext to `extractionSteps` DB column | Pending |
| A-6 | **High** | Transport | `headers.ts` | Hardcoded Chrome 121 UA + `Sec-Ch-Ua` — stale (Jan 2024), immediately fingerprintable | Pending |
| A-7 | **High** | Transport | `transport/remote.ts` | Axios 1.x uses `CanceledError` not `AbortError` — abort safety net broken | Pending |
| A-8 | **High** | Acquisition | `standard.ts` | Inconsistent retry budget — fallback retries 2×; worst-case 150s per URL | Pending |
| A-9 | **Medium** | Transport | `headers.ts` | `Sec-Fetch-Site: none` conflicts with referrer header — WAF fingerprint mismatch | Pending |
| A-10 | **Medium** | Transport | `headers.ts` | Missing `Accept-Encoding` header — detectable bot signal | Pending |
| A-11 | **Medium** | Acquisition | `standard.ts` | HTTP 407/401 proxy auth errors unhandled — propagate as crashes | Pending |
| A-12 | **Medium** | Transport | `transport/remote.ts` | Empty remote HTML body silently treated as successful extraction | Pending |
| A-13 | **Medium** | Transport | `detection.ts` | Case-sensitive WAF marker detection — misses capitalization variants | Pending |
| A-14 | **Low** | Transport | `detection.ts` | Akamai `Reference #18.` pattern too specific — misses other reference numbers | Pending |
| A-15 | **Low** | Acquisition | `standard.ts` | `withRetry` logs under `'AI'` category for HTTP scraper calls | Pending |
| E-1 | **High** | Extractor | `dom-denoiser.ts` | `denoiseHtmlForRegex` nested-quantifier regex — ReDoS vulnerability | Pending |
| E-2 | **High** | Extractor | `stock/schema.ts` | `walk()` no depth guard — infinite recursion on malformed JSON-LD; `offers` visited twice | Pending |
| E-3 | **High** | Extractor | `arbitration.ts` | AI arbitration passed `allCandidates` including member/original prices | Pending |
| E-4 | **Medium** | Extractor | `price-extraction.ts` | `priceSpecification` double-processed — duplicate JSON-LD candidates | Pending |
| E-5 | **Medium** | Extractor | `dom-denoiser.ts` | JSON-LD blocks duplicated in DOM after clone re-append (originals not removed first) | Pending |
| E-6 | **Medium** | Extractor | `core/selectors.ts` | `normalizeSelector` corrupts CSS attribute selectors containing `\|` (e.g. `[lang\|="en"]`) | Pending |
| E-7 | **Medium** | Extractor | `price-utils.ts` | No max price sanity guard — barcodes/SKUs enter candidate pool as valid prices | Pending |
| E-8 | **Medium** | Extractor | `arbitrators/consensus.ts` | Member/original price group winner is first inserted, not highest-confidence | Pending |
| E-9 | **Medium** | Extractor | `arbitrators/consensus.ts` | `hasConsensus >= 1.0` — single json-ld source reaches consensus without corroboration | Pending |
| E-10 | **Medium** | Extractor | `arbitrators/utils.ts` | Absolute tolerance `< 1.00` causes grouping failures for high-value items | Pending |
| E-11 | **Medium** | Extractor | `arbitration.ts` | Anchor-price fallback sets `aiStatus = 'confirmed'` — no AI was involved | Pending |
| E-12 | **Medium** | Extractor | `stock/generic.ts` | `add to trolley` hardcoded in-stock phrase — locale-specific, requires code deploy to change | Pending |
| E-13 | **Medium** | Extractor | `stock/generic.ts` | Add-to-cart button detection too broad — false in-stock positives from nav/banners | Pending |
| E-14 | **Medium** | Extractor | `stock/custom.ts` | Silent exception swallowing in stock selector evaluation — no debug trace | Pending |
| E-15 | **Medium** | Extractor | `dom-denoiser.ts` | DOM ancestor traversal not short-circuited — O(D×N) walks per scrape | Pending |
| E-16 | **Medium** | Extractor | `core/engine.ts` | XPath re-serializes full DOM on every XPath selector — no caching | Pending |
| E-17 | **Medium** | Extractor | `price-extraction.ts` | JSON-LD `"$"` currency defaults to `'USD'` without locale awareness | Pending |
| E-18 | **Low** | Extractor | `price-extraction.ts` | Invalid regex patterns swallowed silently — no debug log | Pending |
| E-19 | **Low** | Extractor | `core/selectors.ts` | `isNoiseElement` runs all 10 ancestor iterations on detached/orphaned nodes | Pending |
| PS-1 | **Critical** | Product | `ProductPersistenceService.ts` | `updateMetadata`/`updateStockState` ignore `_client` — writes escape advisory-locked transaction | Pending |
| PS-2 | **Critical** | Product | `ProductPersistenceService.ts` | `recordPrices` second `getLatest()` outside locked client — TOCTOU duplicate price inserts | Pending |
| PS-3 | **High** | Product | `notifications/alerts.ts` | `notifyPriceDrop` fires on price **increases** when `price_drop_threshold = 0` | Pending |
| PS-4 | **High** | Product | `notifications/alerts.ts` | `notifyTargetHit` fires on every price change while below target — no dedup tracking | Pending |
| PS-5 | **High** | Product | `ProductRefreshService.ts` | `notifyPriceAnnounced` fires spuriously on first-ever add of a pre-order product | Pending |
| PS-6 | **High** | Product | `utils/metadata.ts` | Product image permanently blocked from update once any non-placeholder URL is set | Pending |
| PS-7 | **High** | Product | `ProductPersistenceService.ts` | Product name never corrected once set to a bad-but-not-blacklisted value | Pending |
| PS-8 | **High** | Product | `utils/auto-config.ts` | Outer `catch` swallows all errors — outer transaction not rolled back on inner failure | Pending |
| PS-9 | **Medium** | Product | `ProductPersistenceService.ts` | `syncUserCategories` runs outside transaction — persists on outer TX rollback | Pending |
| PS-10 | **Medium** | Product | `auto-config.helpers.ts` | `resolveWinningSelector` method filter is always-true when `selectedMethod` is null | Pending |
| PS-11 | **Medium** | Product | `add/confirmation.ts` | `...options` spread passes untrusted client data to persistence service | Pending |
| PS-12 | **Medium** | Product | `ProductRefreshService.ts` | 4 sequential pre-scrape DB queries — should be parallelised | Pending |
| PS-13 | **Medium** | Product | `utils/auto-config.ts` | All selector failure counters incremented even when no custom match was attempted | Pending |
| PS-14 | **Medium** | Product | `notifications/alerts.ts` | `'USD'` hardcoded currency fallback — contradicts system currency resolution architecture | Pending |
| SYS-1 | **Critical** | System | `DatabaseHealthMonitor.ts` | Admin email address exposed in `getStatus()` API response | Completed |
| SYS-2 | **High** | System | `settings/ai.ts` | Gemini API key in URL query string — leaks to server/proxy access logs | Pending |
| SYS-3 | **High** | System | `DatabaseHealthMonitor.ts` | `warmCache()` hardcodes `WHERE id = 1` — wrong admin on non-default installs | Pending |
| SYS-4 | **High** | System | `SettingsListenerService.ts` | Reconnect loop flat 5s retry — hammers DB pool (360 attempts/hour during outage) | Pending |
| SYS-5 | **High** | System | `DatabaseHealthMonitor.ts` | "Outage Resolved" email sent without prior "Outage Started" alert | Pending |
| SYS-6 | **High** | Routes | `RetailerTestingService.ts` / `admin/debug.ts` | SSRF — unchecked URL passed to scraper / axios with no protocol or IP validation | Pending |
| SYS-7 | **High** | Routes | `products/scan.ts` / `bulk.ts` | Raw `async` handlers without `asyncHandler` — inconsistent error propagation | Pending |
| SYS-8 | **High** | Routes | `RetailerMutationService.ts` | `deleteRetailer()` TOCTOU — non-atomic fetch-then-delete, wrong cache key invalidated | Pending |
| SYS-9 | **Medium** | System | `DatabaseHealthMonitor.ts` | `sendAlertEmail` fire-and-forget — duplicate alert email risk | Pending |
| SYS-10 | **Medium** | System | `DatabaseHealthMonitor.ts` | TLS cert verification disabled for SMTP (`rejectUnauthorized: false`) | Pending |
| SYS-11 | **Medium** | System | `settings/ai.ts` | `computeFallbacksForModels` catch-all condition matches virtually every OpenAI model | Pending |
| SYS-12 | **Medium** | System | `settings/system.ts` | Settings update loop has no transaction — partial save risk on crash | Pending |
| SYS-13 | **Medium** | System | `SettingsListenerService.ts` | Stale debounce closure not cancelled on reconnect — dangling timer | Pending |
| SYS-14 | **Medium** | System | `settings/ai.ts` | API key mask detection based on `"..."` substring — fragile, collides with real keys | Pending |
| SYS-15 | **Low** | System | `CurrencyConversionService.ts` | No timeout on Frankfurter API call — can hang 4 AM cron indefinitely | Pending |
| SYS-16 | **Low** | System | `CurrencyConversionService.ts` | AUD→AUD self-rate never written to DB — `getRate('AUD','AUD')` returns null | Pending |
| SYS-17 | **Low** | Routes | `admin/users.ts` | `PUT /:id` passes raw `req.body` to service — no field whitelist at route layer | Pending |

---

### 13.7 Priority Recommendations — Round 2

#### Immediate — Critical (Fix Before Next Deploy)

1. **PS-1** — `updateMetadata`/`updateStockState`: rename `_client` → `client`, thread to all repository calls.
2. **PS-2** — Route `recordPrices` reads through the locked `client` to eliminate TOCTOU price duplicates.
3. **O-1** — Merge (not overwrite) `priceCandidates` on auto-map re-extraction.
4. **A-1** — Fix off-by-one retry loop in `transport/remote.ts`; ensure sentinel is reachable.
5. **SYS-1** — Remove `cachedAdminEmail` from `getStatus()` immediately.

#### High — Security Fixes

6. **A-5** — Scrub proxy credentials before logging to `extractionSteps`.
7. **SYS-2** — Move Gemini API key from URL query param to `x-goog-api-key` header.
8. **SYS-6** — Add SSRF protection (URL protocol + IP range check) to retailer test and admin debug endpoints.
9. **PS-11** — Whitelist fields explicitly in `confirmation.ts` instead of spreading `...options`.

#### High — Logic & Notification Bugs

10. **PS-3** — Guard `priceDrop <= 0` before threshold check — prevent price-increase notifications.
11. **PS-4** — Add `target_notified_at` tracking to suppress repeated target-hit alerts.
12. **O-2** — Fix `isCorroborated` inversion: `!!winningGroupSources && winningGroupSources.size > 1`.
13. **O-3** — Add upward drift check to OOS extreme-drift guardrail (`> anchor * 2.5`).
14. **O-4** — Pass domain key to `configCache.invalidate()` in both orchestration maintenance functions.
15. **A-2 / A-3 / A-4** — Fix `usedRemoteFallback` flag placement; add challenge check on fallback result.
16. **E-1** — Replace nested-quantifier regex in `denoiseHtmlForRegex` with lazy match or Cheerio-based removal.
17. **E-2** — Add depth limit to `walk()` in `stock/schema.ts`; skip already-handled keys in generic traversal.
18. **E-3** — Pass `standardCandidates` not `allCandidates` to `tryAIArbitration`.
19. **SYS-3** — Fix admin email query to filter by `is_admin = true ORDER BY id ASC LIMIT 1`.
20. **SYS-4** — Add exponential backoff to `SettingsListenerService` reconnect loop.
21. **A-6** — Update Chrome 121 UA + client hints to current version; consider per-request rotation pool.
22. **A-7** — Add `error.name === 'CanceledError'` check to abort path in `transport/remote.ts`.
23. **PS-8** — Re-throw errors from `auto-config.ts` when `ownClient = false` so outer TX can roll back.
24. **SYS-7** — Refactor `scan.ts` and `bulk.ts` to use project-standard `asyncHandler`.
25. **SYS-8** — Make `deleteRetailer` atomic with `RETURNING domain` on DELETE.

#### Medium — Correctness & Performance

26. **E-5** — Remove original JSON-LD scripts before re-appending clones in `dom-denoiser.ts`.
27. **E-6** — Fix `normalizeSelector` to only split on `|` outside square brackets.
28. **E-7** — Add max price sanity guard (reject `price > 100000` without anchor confirmation).
29. **E-4** — Skip `priceSpecification` in JSON-LD general recursion to prevent double-processing.
30. **O-7** — Add `jsonld_price_key` check to `isShellConfig` guard.
31. **O-10** — Add `logger.error` calls in arbitration and verification catch blocks.
32. **A-9 / A-10** — Fix `Sec-Fetch-Site` dynamic setting; add explicit `Accept-Encoding` header.
33. **PS-13** — Only increment selector failure counters when the selector was actually evaluated.
34. **SYS-12** — Wrap settings update loop in a transaction.
35. **O-8** — Add `wasArbitrated` flag to skip corroboration check for AI-selected prices.

---

## 14. Round 3 Deep Audit — Frontend & Full-Stack Mappings — 2026-07-16

**Auditor:** Claude Sonnet 4.6 (Thinking)  
**Scope:** Frontend feature layers (`products`, `notifications`, `settings`, `admin`, `debug`, `auth`) & service worker caching  
**Focus Areas:** UI state handling · caching validation · pagination conflict · validation · full-stack architectural mappings

---

### 14.1 Caching & Caching Gaps

#### Issue FE-1 — HIGH: Service Worker Cache-Poisoning Bug (Error Caching) [COMPLETED]
* **Severity: High — Caching/Stability**
* **File:** sw.js L43–52
* **Description:** The Service Worker implements a "Network First" strategy but caches all returned responses, including HTTP errors (e.g. 500, 502, 404). If a user experiences a transient server outage, the SW will serve the cached 500 error page even when they are back online or the server is healthy.
* **Recommendation:** Wrap `cache.put` to verify the response was successful (`response.ok && response.status === 200`):
  ```javascript
  if (response.ok && response.status === 200) {
    const responseClone = response.clone();
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(event.request, responseClone);
    });
  }
  ```

---

### 14.2 Notification System (`notifications/`)

#### Issue FE-2 — HIGH: Notification Toast Suppression Bug [COMPLETED]
* **Severity: High — UX Bug**
* **File:** NotificationBell.tsx L35
* **Description:** Toast notifications for new alerts are skipped when the unread count transitions from `0` to `1` because of the `lastCountRef.current !== 0` check. Users with empty inboxes will never see a popup toast on their first new alert.
* **Recommendation:** Track the first-load state with a `useRef(true)` and trigger the toast on any count increase after the initial fetch.

#### Issue FE-3 — HIGH: Misleading Price Change Sign Representation (Forced Minus Sign) [COMPLETED]
* **Severity: High — Logic Bug**
* **File:** NotificationTable.tsx L97–101
* **Description:** The table forces a minus (`-`) sign prefix on all price change percentages via `-Math.abs(...)`. If a product's price increases, the notification table displays it as a price drop (e.g., `-15%` instead of `+15%`), misleading the user.
* **Recommendation:** Render the sign dynamically based on whether the percentage is positive or negative.

#### Issue FE-4 — HIGH: Server-Side Pagination & Client-Side Filtering Conflict [COMPLETED]
* **Severity: High — Architecture Mismatch**
* **Files:** NotificationHistoryPage.tsx L39–41, L73–76
* **Description:** 
  1. The API returns paginated results (limit 20). The frontend filters out `session_activity` and `system_info` client-side, causing pages to have fewer than 20 items and leaving trailing empty pages.
  2. Search filters ("Drops", "Targets", "Stock") filter loaded alerts *only client-side on the current page*. If the loaded 20 items are all stock events, selecting the "Drops" tab will render an empty page, even if thousands of drop events exist on later pages.
* **Recommendation:** Implement server-side filtering by passing the category/type to the backend history API, and resetting the page index to `1` on filter change.

#### Issue FE-5 — MEDIUM: Notification Bell Stale Closures (Missing Dependencies) [COMPLETED]
* **Severity: Medium — React State Sync**
* **File:** NotificationBell.tsx L12–26
* **Description:** The polling effect has an empty dependency array `[]`. If the `showToast` or `setDrawerOpen` context hooks change, the polling loop remains bound to the stale closures from the first mount.
* **Recommendation:** Wrap `fetchStatus` in `useCallback` with proper dependencies, and add it to the `useEffect` array.

---

### 14.3 Product Feature Gaps & Voting (`products/`)

#### Issue FE-6 — MEDIUM: Division by Zero & Unstable Sorting in Product Filters [COMPLETED]
* **Severity: Medium — Logic Bug**
* **File:** useProductFilters.ts L111–120
* **Description:** If a product experiences a `-100%` price change, `aPct` evaluates to `-1.0`, resulting in division by zero (`1 + aPct = 0`). This produces `NaN` or `Infinity`, causing unstable array sorting across browser engines.
* **Recommendation:** Guard the denominator against zero: `Math.abs(1 + aPct) < 0.0001 ? 0 : ...`.

#### Issue FE-7 — MEDIUM: Price Selection Modal State Leak across Product Toggles [COMPLETED]
* **Severity: Medium — React State Sync**
* **File:** PriceSelectionModal.tsx L95–100
* **Description:** Modal local states (manual inputs, warnings, submissions) are not reset when the modal is closed and re-opened. When opening the modal for a new product, users will see the dirty state, manual entry, or warning messages from the previous product.
* **Recommendation:** Add a `useEffect` watching the `isOpen` prop, resetting all state fields when it transitions to `true`.

#### Issue FE-8 — MEDIUM: Incomplete Scraper Method Prioritization (`site-specific` omitted) [COMPLETED]
* **Severity: Medium — Scraper Arbitration Mismatch**
* **File:** PriceSelectionModal.tsx L50–61
* **Description:** The `'site-specific'` scraper extraction method is completely missing from the modal's priority mapping (`METHOD_TIERS`), falling back to priority `99`. This pushes highly reliable site-specific scraper configs to the absolute bottom of the candidate list in the Voting Modal.
* **Recommendation:** Add `'site-specific': 2` to the `METHOD_TIERS` priority configuration.

#### Issue FE-9 — MEDIUM: Settings Form Input Validation Bypass [COMPLETED]
* **Severity: Medium — Input Validation**
* **File:** useProductDetailState.ts L158–171
* **Description:** Entering non-numeric strings (like `"abc"`) into the target price or price threshold settings fields resolves to `NaN` in `parseFloat()`. When serialized to JSON, this converts to `null`, silently clearing (disabling) the thresholds in the database with no validation feedback.
* **Recommendation:** Add an explicit number format validation check before submitting.

---

### 14.4 Administration & Auth Gaps (`admin/` & `auth/`)

#### Issue FE-10 — MEDIUM: Silent API Gaps (No User Feedback) in System Toggles [COMPLETED]
* **Severity: Medium — UX Bug**
* **File:** SystemSection.tsx L186–206
* **Description:** When toggling the "Disable Global Scheduler" or "Disable Auto Retailer Updates" settings, the component calls the API but misses any success toast (`showToast`) or error catching, leaving the user with zero visual confirmation.
* **Recommendation:** Add standard try-catch blocks with `showToast` notifications for both toggles.

#### Issue FE-11 — MEDIUM: Open Redirect / Phishing Vulnerability in Login Redirect [COMPLETED]
* **Severity: Medium — Security**
* **File:** Login.tsx L14–29
* **Description:** The `redirect` query parameter from the URL is decoded and navigated to raw via React Router (`navigate(fromPath)`). If an attacker passes an external absolute URL (e.g. `redirect=http://attacker.com`), it could lead to phishing redirection.
* **Recommendation:** Verify that the decoded URL begins with a single slash `/` and not double slashes `//` or absolute protocols, redirecting to `/?tab=products` as a fallback.

---

### 14.5 Low-Severity Gaps & Typing Gaps

#### Issue FE-12 — LOW: Mismatched Regex Filter & Missing Method Labels [COMPLETED]
* **Severity: Low — UI Polish**
* **File:** PriceSelectionModal.tsx L28–37, L74–80
* **Description:** `'custom-regex'` is missing from the modal's standard price filter tabs (omitted from `FILTER_METHODS.standard`). Furthermore, friendly labels for `'custom-css'`, `'custom-regex'`, and `'standard-css'` are missing from `METHOD_LABELS`, displaying raw keys in the UI.
* **Recommendation:** Add `'custom-regex'` to the standard filter category and map friendly labels in `METHOD_LABELS`.

#### Issue FE-13 — LOW: Toast Context Parameter Type Violation [COMPLETED]
* **Severity: Low — Typing Gaps**
* **File:** useProductActions.ts L143–145
* **Description:** A raw string is passed to `showToast`'s third parameter (`details?: any`). While the Activity Log Table handles string fallbacks, passing a raw string prevents the detailed error text from rendering inside the popup toast notification.
* **Recommendation:** Include the detailed error message inside the primary toast string argument or pass a structured object.

#### Issue FE-14 — LOW: Missing Password Validation in Admin User Actions [COMPLETED]
* **Severity: Low — Validation**
* **File:** UsersSection.tsx L48–69
* **Description:** When an admin adds or edits users, the frontend enforces no password strength or length limits (such as the minimum 8-character limit required on the registration and profile pages).
* **Recommendation:** Enforce standard password length check on admin user management fields.

---

## 15. Architectural & Full-Stack Mappings

Here we link frontend vulnerabilities to their corresponding backend counterparts to highlight the full-stack impact.

### 15.1 Map FE-2 (Misleading Signs) ↔ PS-3 (Price Drop Notification Gaps)
* **Frontend Counterpart:** `NotificationTable.tsx` forces a minus sign on price changes.
* **Backend Counterpart:** `notifications/alerts.ts` fires drop notifications on price increases when `price_drop_threshold = 0`.
* **Full-Stack Impact:** If a product increases in price (e.g. $100 -> $115), the backend incorrectly dispatches a price drop notification, and the frontend notification table displays it with a minus sign as `-15%`. Together, they present a price hike as a successful discount to the end-user.

### 15.2 Map FE-6 (Site-Specific Omitted) ↔ E-8 / E-9 (Priority Sorting Mismatch)
* **Frontend Counterpart:** `PriceSelectionModal.tsx` fails to prioritize `'site-specific'` scraper methods.
* **Backend Counterpart:** `consensus.ts` and `arbitrators/consensus.ts` prioritize different method weights (and fallbacks).
* **Full-Stack Impact:** Custom domain-specific configurations are placed at the lowest tier of importance on the client-side voting list, confusing users about which price option matches the scraper engine's actual output.

### 15.3 Map FE-9 (Target Validation Gaps) ↔ PS-11 (Spread Options Write Risk)
* **Frontend Counterpart:** `useProductDetailState.ts` does not validate target inputs, sending `NaN` which serializes to `null`.
* **Backend Counterpart:** `add/confirmation.ts` spreads untrusted client payload options directly to database updates.
* **Full-Stack Impact:** Invalid frontend user inputs bypass API type-safety, silently wiping thresholds or fields in the database as `null` with no feedback loops or validation errors in logs.

### 15.4 Map FE-10 (Silent Toggle API Calls) ↔ SYS-12 (No Transaction on Settings Update)
* **Frontend Counterpart:** `SystemSection.tsx` misses try-catch blocks and success toasts for key toggles.
* **Backend Counterpart:** `settings/system.ts` updates settings sequentially without transaction protection.
* **Full-Stack Impact:** A crash during a settings toggle write will fail silently on the frontend (giving the user the impression it worked) while leaving the system database in a corrupt, half-saved configuration.

### 15.5 Map FE-11 (Login Redirect SSRF) ↔ SYS-6 (SSRF & Redirection Gaps)
* **Frontend Counterpart:** `Login.tsx` decodes redirect parameters raw and passes them to React Router.
* **Backend Counterpart:** `RetailerTestingService.ts` executes arbitrary URL requests.
* **Full-Stack Impact:** Together they represent a complete SSRF/Open Redirect security surface, where users can be manipulated into clicking credentials-harvesting links.

### 15.6 Map FE-15 (CRITICAL ARCHITECTURAL MISMATCH): Preferred Extraction Method Ignored by Scraper [COMPLETED]
* **Frontend Counterpart:** `PriceSelectionModal.tsx` / `useProductActions.ts` (Selecting a specific price type candidate in the Voting Modal).
* **Backend Counterpart:** `consensus.ts` / `ProductRefreshService.ts` / `confirmation.ts` (Ignore user preferences during scheduled runs).
* **Full-Stack Impact:** Although users select their preferred price type (standard, deal, member) in the frontend Voting Modal, the backend scraper completely ignores `preferred_extraction_method` during automatic product updates. The scraper runs weighted consensus, flipping the price type back to standard and triggering price-drift review warnings, completely invalidating user voting.

### 15.7 Map SEL-1 (returnHtml Off by Default) ↔ VM-4 (html Payload Unguarded)
* **Frontend Counterpart:** `useDebugScraper.ts` — `returnHtml` defaults to `false`, so `result.html` is always undefined; Live Selector Lab never has DOM to query. (→ **SEL-1**)
* **Backend Counterpart:** `debug.ts` — `delete response.html` runs unconditionally when `returnHtml` is falsy. Also relates to VM-4: full raw page HTML was previously sent unguarded in the voting blob too (fixed with denoised payload).
* **Full-Stack Impact:** The only tool admins have to validate selectors against real page HTML is completely blind by default. The backend gate was introduced to limit payload size, but without defaulting the debug workstation to `returnHtml: true`, the entire Live Selector Lab feature is permanently broken for new users who never discover the toggle.

### 15.8 Map SEL-2 (Extended Selector Syntax Crashes Browser) ↔ P-1 (No Selector-Level Debug Log)
* **Frontend Counterpart:** `useDebugScraper.ts` — raw `querySelectorAll` throws `SyntaxError` for all PriceStalker extended selectors (`::attr`, `~regex~`, `!html`, stock modifiers). (→ **SEL-2**)
* **Backend Counterpart:** `prices.ts` — extraction pass method override produces no selector-level debug log (P-1), so even when the backend succeeds with these selectors, neither the frontend lab nor the backend logs surface which selector fired.
* **Full-Stack Impact:** An admin configuring `span.price::attr(content)` gets "Invalid selector expression" in the Live Lab and silence in the backend logs. They have no confirmation the selector works, and no debug path to discover that the syntax is valid on the backend but unsupported in a browser context.

### 15.9 Map SEL-3 (Attribute Values Not Surfaced) ↔ Issue B (Empty Nested/Offscreen Elements)
* **Frontend Counterpart:** `SelectorTester.tsx` — match cards show only `textContent`; `content`, `data-price`, `value`, `itemprop` attributes are invisible to the user. (→ **SEL-3**)
* **Backend Counterpart:** Audit Issue B (Empty Nested Elements / Offscreen Spans) — the backend's `parsePrice` handles offscreen spans and `::attr()` extraction correctly, but the frontend Live Lab gives the exact opposite impression by showing `Text: (empty)` for the same elements.
* **Full-Stack Impact:** An admin testing `span.a-offscreen::attr(content)` sees `Text: (empty)` in the Live Lab and concludes the selector is wrong — discarding a selector that would actually work perfectly in the backend's Cheerio engine.

### 15.10 Map SEL-4 (No CSS Validation in Selector Manager) ↔ FE-9 (Input Validation Bypass)
* **Frontend Counterpart:** `UnifiedSelectorManager.tsx` — accepts any string without CSS validity check; typos are silently stored. (→ **SEL-4**) Also relates to FE-9: `useProductDetailState.ts` similarly passes raw unvalidated values to the API.
* **Backend Counterpart:** `retailer-mutation.repository.ts` — the upsert stores whatever selector strings are passed without server-side CSS syntax validation.
* **Full-Stack Impact:** An invalid selector like `span..price` silently enters the retailer config, is stored in the database, and causes the backend extraction to return 0 candidates for that selector pass — with no log message identifying the bad selector as the root cause.

---

## 16. CSS Selector Picker & Debug Workstation Audit

**Date:** 2026-07-16  
**Auditor:** Claude Sonnet 4.6 (Thinking)  
**Scope:** `frontend/src/features/debug/pages/` · `frontend/src/features/admin/components/UnifiedSelectorManager.tsx` · `backend/src/routes/admin/debug.ts`  
**Reference:** `other-apps/changedetection/changedetectionio/static/js/visual-selector.js`

---

### 16.1 Architecture Overview

The selector picking and debug HTML features are split across two surfaces:

```
Debug Workstation (DebugPage.tsx)
  ├── useDebugScraper.ts       → Calls POST /api/admin/debug/extract
  ├── SelectorTester.tsx       → Live selector lab (runs querySelectorAll in browser)
  └── ResultDisplay.tsx        → Shows debug results, "Open Debug HTML" link

Retailer Config Editor (RetailerConfigEditor.tsx)
  ├── UnifiedSelectorManager.tsx → CSS/Regex/Attr/HTML selector list management
  └── ScrapeValidationHub.tsx    → Test URL + Extract button, shows extraction result
```

The Live Selector Lab runs entirely client-side via the browser `DOMParser` + `querySelectorAll`. The "Open Debug HTML" link points to a file saved on the backend server disk. Neither feature works reliably by default.

---

### 16.2 Issue SEL-1 — CRITICAL: Live Selector Lab Has No HTML to Query Against [COMPLETED]

> **Severity: CRITICAL — Feature Non-Functional by Default**

**File:** `useDebugScraper.ts` L14, L78–140

```typescript
const [returnHtml, setReturnHtml] = useState(false);  // Default: false
// ...
useEffect(() => {
  if (!liveSelector || !result?.html) {   // result.html is always undefined
    setLiveMatches([]);
    return;
  }
  // ... querySelectorAll logic that never runs
}, [liveSelector, result?.html]);
```

`returnHtml` defaults to `false`. The backend unconditionally strips `html` from the response when this flag is false (`debug.ts` L70–72):

```typescript
if (!returnHtml) {
  delete response.html;   // html always deleted unless user manually toggles the switch
}
```

**Result:** The Live Selector Lab always shows "No elements matching..." regardless of what the user types, because `result.html` is always `undefined`. The entire Live Selector Lab is non-functional by default.

**Recommendation:** Default `returnHtml` to `true` in `useDebugScraper.ts`. The HTML is already saved to disk (`saveDebugHtml`) unconditionally, so there is no backend overhead concern. For the debug workstation, returning denoised HTML is essential for the tool to function.

> **Cross-references:** → [§15.7 Map SEL-1 ↔ VM-4](#157-map-sel-1-returnhtml-off-by-default--vm-4-html-payload-unguarded) · VM-4 (html payload unguarded in voting blob, resolved with denoised payload)

---

### 16.3 Issue SEL-2 — HIGH: Live Lab Crashes on Any PriceStalker Extended Selector Syntax [COMPLETED]

> **Severity: HIGH — UX Bug / Silent Failure**

**File:** `useDebugScraper.ts` L122–133

```typescript
} else {
  const elements = doc.querySelectorAll(liveSelector);  // Raw browser call — no pre-processing
```

PriceStalker's selector engine supports extended syntax that the browser's native `querySelectorAll` will **always throw a `SyntaxError` for**:

| Syntax | Example | Browser Result |
|--------|---------|---------------|
| `::attr(x)` | `span.price::attr(content)` | `SyntaxError` |
| `~regex~` | `~\$[0-9]+~` | `SyntaxError` |
| `!selector` | `!div.price` | `SyntaxError` (invalid CSS) |
| `::equals(v)->status` | `div::equals(In Stock)->in_stock` | `SyntaxError` |

All of these are caught silently by the `try/catch` and displayed as **"Invalid selector expression"**, giving the user no indication that the selector is _valid for the backend_ but unsupported in a browser context.

> **Cross-references:** → [§15.8 Map SEL-2 ↔ P-1](#158-map-sel-2-extended-selector-syntax-crashes-browser--p-1-no-selector-level-debug-log) · P-1 (no selector-level debug log in backend extraction passes)

**Recommendation:** Pre-process the selector before calling `querySelectorAll`:

```typescript
function parseExtendedSelector(sel: string): { base: string; attr?: string; mode: 'css' | 'attr' | 'regex' | 'html' | 'stock' } {
  if (!sel) return { base: '', mode: 'css' };
  if (sel.startsWith('~') && sel.endsWith('~')) return { base: sel.slice(1, -1), mode: 'regex' };
  if (sel.startsWith('!')) return { base: sel.slice(1), mode: 'html' };
  const stockMatch = sel.match(/^(.+?)::(equals|contains)\((.+?)\)->(.+)$/);
  if (stockMatch) return { base: stockMatch[1].replace(/::attr\(.+?\)$/, ''), mode: 'stock' };
  const attrMatch = sel.match(/^(.+?)::attr\((.+?)\)$/);
  if (attrMatch) return { base: attrMatch[1], attr: attrMatch[2], mode: 'attr' };
  return { base: sel, mode: 'css' };
}
```

For `mode: 'attr'`, run `querySelectorAll(base)` and extract `element.getAttribute(attr)` as the match text. For `mode: 'regex'`, run a text scan across all text nodes. Display the detected mode in a badge so users understand which evaluation path would fire on the backend.

---

### 16.4 Issue SEL-3 — HIGH: Match Card Shows Text Only, Misses Attribute Values [COMPLETED]

> **Severity: HIGH — Debug Tool Provides False Negative Results**

**File:** `SelectorTester.tsx` L54–65

```tsx
<div className="match-content">
  <strong>Text:</strong> <code>{match.text || '(empty)'}</code>
</div>
```

Many price elements store their value in **attributes**, not `textContent`. For example:
- Amazon `span.a-offscreen` → text content is empty in pre-rendered HTML; price is in screen-reader-only span
- `<meta itemprop="price" content="29.99">` → `content` attribute, empty text
- `<input type="hidden" name="price" value="29.99">` → `value` attribute
- JSON-LD `<script>` → `textContent` is a JSON string, not a price

When a selector matches one of these elements, the live lab shows `Text: (empty)` and appears to have found nothing — even when `::attr(content)` would work perfectly on the backend.

> **Cross-references:** → [§15.9 Map SEL-3 ↔ Issue B](#159-map-sel-3-attribute-values-not-surfaced--issue-b-empty-nestedoffscreen-elements) · Audit Issue B (Empty Nested Elements / Offscreen Spans in backend `parsePrice`)

**Recommendation:** In `useDebugScraper.ts` L124–133, extract key attributes when gathering match data:

```typescript
const PRICE_ATTRS = ['content', 'data-price', 'value', 'data-value', 'itemprop', 'data-attr', 'href'];
matches = Array.from(elements).slice(0, 10).map(el => ({
  tagName: el.tagName.toLowerCase(),
  text: el.textContent?.trim().substring(0, 100),
  html: el.innerHTML.substring(0, 200),
  suggestedAttr: PRICE_ATTRS.find(a => el.getAttribute(a)),
  suggestedAttrValue: PRICE_ATTRS.map(a => el.getAttribute(a)).find(Boolean),
  attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
    acc[attr.name] = attr.value;
    return acc;
  }, {})
}));
```

In `SelectorTester.tsx`, display a highlighted "Suggested: `::attr(content)` = `29.99`" row when `suggestedAttr` is populated.

---

### 16.5 Issue SEL-4 — MEDIUM: `UnifiedSelectorManager` Accepts Invalid CSS Without Validation [COMPLETED]

> **Severity: MEDIUM — Silent Misconfiguration**

**File:** `UnifiedSelectorManager.tsx` L42–61

When a user enters a CSS selector and presses "Add", the value is appended directly to the array with no validation. A typo like `span..price`, `div[data-id`, or `#price>` will be saved to the retailer config without error. The backend will silently return 0 candidates for that selector.

> **Cross-references:** → [§15.10 Map SEL-4 ↔ FE-9](#1510-map-sel-4-no-css-validation-in-selector-manager--fe-9-input-validation-bypass) · FE-9 (Settings Form Input Validation Bypass in `useProductDetailState.ts`)

**Recommendation:** Add browser-side CSS validation for `type === 'css'` before appending:

```typescript
const handleAdd = () => {
  let finalValue = inputValue.trim();
  if (!finalValue) return;
  
  if (type === 'css') {
    try {
      document.querySelectorAll(finalValue);  // throws if invalid
    } catch {
      setCssValidationError(`Invalid CSS selector: "${finalValue}"`);
      return;
    }
  }
  // ... rest of add logic
};
```

Add a `cssValidationError` state and render it as a red inline error beneath the input field.

---

### 16.6 Issue SEL-5 — MEDIUM: "Open Debug HTML" Requires `returnHtml = true` AND Backend Disk Access [COMPLETED]

> **Severity: MEDIUM — Feature Only Partially Functional**

**File:** `debug.ts` L64–77

```typescript
let debugFileUrl = null;
if (result.html) {
  debugFileUrl = systemService.saveDebugHtml(url, result.html);
}
// ...
if (!returnHtml) { delete response.html; }
res.json({ ...response, debugFileUrl });
```

The `debugFileUrl` is always returned (even when `returnHtml = false`), because `saveDebugHtml` runs unconditionally on `result.html` — but `result.html` may itself be `undefined` if the scraper didn't return HTML in that path.

Additionally, the `debugFileUrl` points to a static file on the backend server's filesystem. This file is served by the backend's static file middleware, so it works — but the HTML is the raw (or denoised) page HTML, not interactive. There is no CSS selector testing capability from within the debug HTML view.

**Recommendation (Short-term):** Ensure `saveDebugHtml` always runs regardless of `returnHtml` flag — it already does save unconditionally if `result.html` exists, so the real fix is ensuring `result.html` is populated from `scrapeProductWithVoting`.

**Recommendation (Long-term):** Replace the "Open Debug HTML" static file link with an embedded `<iframe>` inside the Debug Workstation that:
1. Renders the denoised HTML in a sandboxed iframe
2. Injects a click-interceptor script that highlights elements and generates CSS selectors
3. Auto-populates the Live Selector Lab input when an element is clicked

This mirrors how `changedetection`'s `visual-selector.js` works (canvas overlay + click-to-XPath), adapted for Cheerio-compatible CSS selectors.

---

### 16.7 Issue SEL-6 — LOW: Selector Lab `+ Price` / `+ Name` Buttons Don't Reach `UnifiedSelectorManager` State [COMPLETED]

> **Severity: LOW — UX / Disconnected Feature**

**File:** `SelectorTester.tsx` L48–52

```tsx
<button onClick={() => addToSelectors('price', liveSelector)}>+ Price</button>
<button onClick={() => addToSelectors('name', liveSelector)}>+ Name</button>
<button onClick={() => addToSelectors('image', liveSelector)}>+ Image</button>
```

These buttons call `addToSelectors` from the `actions` prop. In the Debug Workstation, these add to the **temporary override selector arrays** in `useDebugScraper.ts` state — which only last for the current session and are not persisted to the retailer config.

There is no pathway from the Debug Workstation to the Retailer Config Editor to save a tested selector permanently. The user must manually copy-paste the selector string from the Live Lab into the Admin → Retailer Config → Extraction Parameters form.

**Recommendation:** Add a "Save to Retailer Config →" button that opens the retailer config editor pre-populated with the domain from the current test URL. Alternatively, a "Copy to clipboard" button would significantly reduce friction.

---

### 16.8 Comparison: changedetection Visual Selector Approach

`other-apps/changedetection/changedetectionio/static/js/visual-selector.js` implements a more sophisticated approach:

| Feature | changedetection | PriceStalker (current) |
|---------|----------------|----------------------|
| DOM element discovery | Backend provides `size_pos[]` with XPath + bounding boxes | Client-side `querySelectorAll` on returned HTML |
| Visual highlighting | Canvas overlay drawn on a screenshot | None |
| Click-to-select | Click on canvas → XPath auto-generated | No click-to-select |
| Selector output | XPath written to filter field | User types manually |
| Multi-select | Shift+click to add to filter list | No multi-select |
| Validation | Backend validates selector against actual element tree | Client-side browser CSS validation only |

For PriceStalker, a practical intermediate approach (without a full screenshot-based canvas system) would be:

1. Return the denoised HTML in the API response (fix SEL-1)
2. Render it in a sandboxed `<iframe srcdoc={result.html}>` with `sandbox="allow-scripts"`
3. Inject a `postMessage`-based click interceptor that generates an optimal CSS selector from the clicked element's DOM path (using a library like `optimal-select` or `css-selector-generator`)
4. On click → auto-populate the Live Selector Lab input and run the match immediately

---

### 16.9 CSS Selector Picker Issue Register

| ID | Severity | Layer | Issue | Status |
|----|----------|-------|-------|--------|
| SEL-1 | **CRITICAL** | Frontend/Backend | Live Selector Lab non-functional by default: `returnHtml` defaults to `false`, so `result.html` is always absent | FIXED in v1.9.2 |
| SEL-2 | **HIGH** | Frontend | `querySelectorAll` crashes on all PriceStalker extended selector syntax (`::attr`, `~regex~`, `!html`, stock modifiers) | FIXED in v1.9.2 |
| SEL-3 | **HIGH** | Frontend | Match cards show `Text: (empty)` for attribute-stored prices; `content`, `data-price`, `value` attributes never surfaced | FIXED in v1.9.2 |
| SEL-4 | **MEDIUM** | Frontend | `UnifiedSelectorManager` accepts invalid CSS without validation; typos silently save and produce 0 backend matches | FIXED in v1.9.2 |
| SEL-5 | **MEDIUM** | Frontend/Backend | "Open Debug HTML" works but is static read-only; no interactive selector testing from the HTML view | FIXED in v1.9.2 |
| SEL-6 | **LOW** | Frontend | `+ Price` / `+ Name` buttons in Live Lab add to temporary session state only; no path to persist to retailer config | FIXED in v1.9.2 |




