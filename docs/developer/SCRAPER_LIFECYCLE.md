# PriceStalker Product Scraper Lifecycle

This document is the canonical reference for the scrape engine and its hand-off into product monitoring. It supersedes all older flow diagrams (see `old_docs/`). Product onboarding, scheduled monitoring, selector learning, and notifications are described as separate concerns below because they do not follow one linear path.

> For the visual end-to-end diagram, see [product_lifecycle_slides.md](product_lifecycle_slides.md). 

> For the extraction system internals, see [SELECTORS.md](SELECTORS.md). 
> For the consensus weighting details and known issues, see the [upstream audit register](../audit/upstream_scraping_consensus_audit.md). The audit contains inherited findings from multiple upstream forks, so its status is checked against the current source below.

---

## Pipeline Overview

`scrapeProductWithVoting()` in `orchestration/index.ts` executes **seven stages, numbered 0–6**:

```
Phase 0: initScrapeSession → Load domain config, AI settings, currency/locale hints
Phase 1: acquireHtml → configured browser/remote attempt → standard HTTP → conditional browser fallback
Phase 2: runExtractionPhase → DOM denoise → metadata (stock/title/image) → price candidates
Phase 3: Validation → success-first challenge handling → retailer maintenance state
Phase 4: handleAutoMapping → active AI provider may generate a retailer config
Phase 5: runConsensusPhase → findPriceConsensus → weighted arbitration → OOS guardrails
Phase 6: runVerificationPhase → Optional AI cross-verification of selected price
 → Result returned to caller (ProductRefreshService / ProductDiscoveryService)
```

---

## Phase 0 — Session Initialisation

**File:** `backend/src/services/scraper/orchestration/init.ts`

- Loads the `retailer_configs` row by canonical lookup domain (normalised URL/domain lookup, including `www.` and trailing-slash normalisation).
- Loads global AI settings, proxy configuration, and currency/locale hints from `settingsCache`.
- Sets `finalSkipAiExtraction` flag based on config and global settings.

---

## Phase 1 — HTML Acquisition

**Files:** `backend/src/services/scraper/acquisition/`, `backend/src/services/scraper/transport/`

1. **Configured browser attempt** — If `use_browser_scraper=true`, request the remote browser/scraper service first.
2. **Standard Axios fetch** — If the browser attempt did not produce HTML, use configured headers, optional proxy, and the Axios retry policy.
3. **Challenge detection** — Detect known bot/challenge pages in returned HTML and selected HTTP errors.
4. **Conditional browser fallback** — If standard HTTP encounters a challenge and there is no existing retailer configuration, use the configured remote scraper or local browser fallback.
5. **Page-unavailable detection** — HTTP 404/410, error/root redirects, soft-404 titles, no-index pages without product evidence, and known error selectors raise `PageNotAvailableError`.

Generic acquisition errors are returned to the orchestration error path. They do not currently create a product-level exponential backoff counter; normal scheduling continues through `next_check_at` and `refresh_interval`.

> **When to use the browser scraper:** Enable `use_browser_scraper` per-retailer (Admin > Retailers) for sites that:
> - Require JavaScript execution to render prices (React/Vue SPAs, lazy-loaded price elements)
> - Are behind CDN bot-protection such as Cloudflare or Imperva that blocks plain HTTP requests
> - Return incomplete or challenge HTML to standard `axios` fetches
>
> The `Browser Scraper URL` system setting (Admin > System) must point to the running `scraper` container before per-retailer flags take effect.

> **URL cleaning:** `cleanUrl()` in `urlHelper.ts` strips UTM/affiliate/tracking parameters before lookup and storage. 
> **Known quirk:** The hash-stripping logic uses `.includes(k)` against KEEP_LIST, meaning single-char entries like `'v'` match fragments like `#reviews` — documented in `url-helper.test.ts`. upstream audit issue **U-1**.

---

## Phase 2 — Data Extraction

**Files:** `backend/src/services/scraper/orchestration/extraction.ts`, `backend/src/services/scraper/extractors/`

Runs in this order:

1. **DOM Denoiser** — `denoiseDomForExtraction()` strips `<script>`, `<style>`, `<noscript>`, `<footer>`, `<nav>`, `<header>`, `<aside>` etc. from the Cheerio DOM. Preserves nodes matching any retailer price/stock/name selector to avoid destroying evidence.
2. **Metadata extraction** — Product name, retailer name, image, stock status, and extraction candidates (see Stock Extraction below).
3. **Price candidate collection** — Seven-layer cascade (see Price Extraction below).

### Stock Extraction Order

| # | Method | Confidence | File |
|---|--------|-----------|------|
| 1 | Pre-order price selectors (`pre_order_price_selectors`) | Implicit high | `stock/pre-order.ts` |
| 2 | Custom stock selectors (`stock_selectors`) | 0.95 | `stock/custom.ts` |
| 3 | Schema.org `[itemprop="availability"]` | 0.90 | `stock/schema.ts` |
| 3b | Global system stock selectors | 0.85 | `stock/custom.ts` |
| 4 | Generic phrase matching (`main`, fallback `body`) | 0.50 | `stock/generic.ts` |

Winner = highest-confidence candidate where `value !== 'unknown'`. Supported final statuses are `in_stock`, `out_of_stock`, `pre_order`, `member_only`, `not_available`, and `unknown`. An `unknown` result does not overwrite an existing known product status during persistence.

### Price Extraction Cascade

| # | Method | Confidence | Weight |
|---|--------|-----------|--------|
| 1 | JSON-LD (`extractJsonLdCandidates`) | 0.95 | 2.0 |
| 2 | Deal price selectors | 0.95 | 1.0* |
| 3 | Member price selectors | 0.95 | 1.0* |
| 4 | Pre-order price selectors | 0.95 | 1.0* |
| 5 | Original price selectors | 0.95 | 1.0* |
| 6 | Custom CSS selectors | 0.90 | 1.5 |
| 7 | Generic CSS selectors (capped at 40 candidates) | 0.60 | 0.2 |

\* Deal and pre-order candidates use a priority path in `findPriceConsensus`; they do not participate in the weighted fallback. Member and original candidates are collected separately as metadata and do not become the primary price through this function.

---

## Phase 3 — Bot/Maintenance Validation

**Files:** `backend/src/services/scraper/orchestration/index.ts`, `backend/src/services/scraper/orchestration/maintenance.ts`

- Checks the acquisition challenge result after extraction.
- **Success-first logic:** If extraction produced price candidates despite a challenge, the challenge is ignored for that scrape.
- Otherwise, flags the retailer configuration as blocked/under maintenance when a configured retailer is affected.
- A page-unavailable error is handled by the top-level orchestration and becomes `stockStatus = not_available`; it does not pass through retailer maintenance handling.

---

## Phase 4 — AI Auto-Mapping

**File:** `backend/src/services/scraper/orchestration/maintenance.ts`

Triggers only when all of these are true:

- no retailer config exists, or the config is considered a shell config;
- there is no active acquisition challenge;
- the result is not definitively unavailable;
- no standard price was resolved; and
- `ai_auto_mapping_enabled = true`.

1. **DOM Pruner** — `cleanHtml()` strips boilerplate to fit within the lightweight AI context window (typically ≤50 KB).
2. **Config Generation** — Sends pruned HTML + meta tags to the active AI provider (`RETAILER_GENERATION_PROMPT`).
3. **Config Save** — Saves generated CSS selectors to `retailer_configs`.
4. **Re-Scrape** — Full extraction re-runs with the new config.

> The shell-config test should remain aligned with every selector category. At present, pre-order and original-price selector fields are not included in that test, so a config containing only those fields may still be treated as a shell configuration.

---

## Phase 5 — Price Consensus & OOS Guardrails

**Files:** `backend/src/services/scraper/arbitrators/consensus.ts`, `backend/src/services/scraper/orchestration/consensus.ts`

### Consensus Algorithm

`findPriceConsensus(candidates)` uses a **priority-plus-weighted** approach. It is important to distinguish a selected candidate from a corroborated consensus: the weighted phase can accept a single sufficiently weighted source.

**Stage A — Separate price types and priority paths:**

1. Member prices (`member-price`) are grouped separately and the largest approximate-price group is retained as `memberPrice`.
2. Original prices (`original-price`) are grouped separately and the largest approximate-price group is retained as `originalPrice`.
3. If any deal-price candidate exists, the largest deal-price group is selected as the primary price and the weighted fallback is skipped.
4. Otherwise, if any pre-order-price candidate exists, the largest pre-order-price group is selected as the primary price and the weighted fallback is skipped.
5. Member/original ties are not currently surfaced as ambiguity, and deal/pre-order selection does not require two agreeing candidates. These are known follow-up issues.

**Stage B — Weighted fallback:**

Standard candidates are grouped by approximate numeric price. Each distinct source key (`method + selector`) contributes its method weight once to the group. Repeated candidates from the same source do not increase the score. The highest-scoring group wins.

The candidate `confidence` value is not multiplied into this score and is not used to break weighted ties.

Weights:

| Method | Weight |
|--------|--------|
| `expert-*` | 5.0 |
| `json-ld` | 2.0 |
| `custom-regex` | 1.6 |
| `custom-css` | 1.5 |
| `generic-css` | 0.2 |
| All others | 1.0 |

If the top two groups have effectively equal scores, `hasConsensus` is false and arbitration may be attempted. The no-AI/no-anchor fallback then sorts by candidate confidence and chooses the lowest price when confidence is tied. This remains a known issue; it is not a median or anchor-aware tie-breaker.

Price grouping currently uses a 5% relative tolerance, compares candidates against the first candidate in each group, and does not include currency in the grouping key. Grouping can therefore depend on candidate order and can combine equal numeric prices expressed in different currencies.

### OOS Guardrails (`runConsensusPhase`)

After `findPriceConsensus` resolves a price, additional checks apply **only when the product is out of stock:**

| Check | Condition | Action |
|-------|-----------|--------|
| Single-source isolation | Only 1 JSON-LD candidate, no corroboration | Nullify price, `needsReview = true` |
| Low-confidence generic | Score < 0.85 and method is generic | Nullify price, `needsReview = true` |
| Anchor drift | Price < 50% of anchor (last known price) | Nullify price, `needsReview = true` |

The current drift guard only detects extreme downward movement. Upward drift is not currently checked. Corroboration metadata is produced by the deterministic consensus phase and is not fully recalculated if AI or anchor arbitration selects a different candidate; see audit item **O-8**.

`highConfidenceMethods` whitelist (retains an out-of-stock price) includes `json-ld`, `custom-css`, `custom-regex`, `deal-price`, `member-price`, `pre-order-price`, `expert-ai`, `ai-extraction`, `manual-selector`, and `ai`, plus any `expert-*` prefix.

---

## Phase 6 — AI Verification

**File:** `backend/src/services/scraper/orchestration/verification.ts`

If a price was resolved, HTML and a user ID are available, no prior AI status exists, and verification has not been skipped:

- Sends the resolved price candidate + denoised HTML to the active AI provider for cross-check.
- If the AI disagrees → `needsReview = true`, `aiStatus = 'corrected'`.
- If the AI agrees → `aiStatus = 'verified'`.

---

## Voting Modal Flow

When `needsReview = true`, the API response includes a `PriceReviewResponse` blob:

```
POST /api/products (new product add)
 └─ productDiscoveryService.initiateProductDiscovery()
 └─ if needsReview=true → returns PriceReviewResponse (no product row is written yet)
 └─ Frontend shows PriceSelectionModal
 └─ User confirms → POST /api/products (with selectedPrice + selectedMethod)

POST /api/products/:id/scan (re-scan existing product)
 └─ productRescanService.scanProduct()
 └─ ALWAYS returns PriceReviewResponse + full voting blob
 └─ Frontend shows PriceSelectionModal
 └─ User confirms → POST /api/products/:id/confirm
 └─ confirmation.ts → saveScrapeResult('manual-confirm')
 → runAutoRetailerConfig() → may promote selector to priority 0 in DB
 → productRepository.update({ needs_price_review: false, ai_status: 'confirmed' })
```

### Candidate Enrichment

Before returning to the client, `memberPrice` and `originalPrice` top-level fields are injected as typed `PriceCandidate` entries into `priceCandidates[]`:

- `method: 'member-price'`, `context: 'Member / loyalty price'`
- `method: 'original-price'`, `context: 'Original / RRP price'`

This gives the frontend a unified candidate list for the modal's tab-based pill UI.

---

## Scheduler & Refresh Monitoring

**Files:** `backend/src/services/domain/product/ProductRefreshService.ts`, `backend/src/services/scheduler/tasks/PriceCheckTask.ts`

- The scheduler finds products due by `next_check_at`, skips paused products, and refreshes up to three products concurrently. A small random delay is added after each refresh.
- Each refresh calls `scrapeProductWithVoting()` and then `saveScrapeResult('refresh')`, which can update metadata, stock history, price history, selector learning, review state, and the next scheduled check.
- Price notifications are evaluated after persistence. The current event types include price drops, target-price hits, price announcements for pre-orders, stock transitions, and product-unavailable alerts.
- A `not_available` result is debounced using three consecutive page-gone results before the product is marked unavailable, paused, and notified. Before the threshold, the previous stock status is retained.
- A paused product is not normally scheduled. If a later manual or forced refresh finds the page available, the refresh flow can clear the pause.
- Generic network, timeout, proxy, and other acquisition errors are not currently represented by a product-level exponential backoff state. They normally preserve a known stock status and leave the product for its next scheduled check.
- On `needsReview = true` from refresh, `products.needs_price_review = true` is written to the database so the product can surface in the review queue.

### Product state transitions

The scraper result and the product monitoring state are separate concerns:

| Scrape result | Product effect |
|---|---|
| `in_stock`, `out_of_stock`, `pre_order`, or `member_only` | Persist a stock transition if it differs from the previous status; evaluate relevant notifications. |
| `unknown` | Preserve a previously known stock status rather than treating uncertainty as a real observation. |
| `not_available` below the page-gone threshold | Increment the page-gone streak and retain the previous status. |
| `not_available` at the threshold | Persist unavailable status, pause checking, and notify the user. |
| Available result after a paused product is manually/forcibly refreshed | Clear the pause and resume monitoring. |

---

## Auto-Config Learning Loop

After persistence of a scrape result (or user confirmation via the Voting Modal), `runAutoRetailerConfig()` may update `retailer_configs`:

1. **`resolveWinningSelector()`** — Finds the candidate whose price matches the saved price and whose method is in the allowed whitelist (`custom-css`, `deal-price`, `member-price`, `pre-order-price`, `original-price`, `custom-regex`).
2. **Selector promotion** — Winning selector is `unshift`ed to index 0 of the relevant selector array in `retailer_configs`.
3. **Staleness tracking** — `selector_metadata.selectors[selector]` is updated: `match_count++`, `consecutive_failures = 0`, `last_matched_at = now()`. Other custom selectors in the array receive `consecutive_failures++`.
4. **Score-based eviction** — If any selector array exceeds 10 entries, the lowest-scoring selectors are evicted. Score = `match_count - (consecutive_failures × 2)`.
5. **Generic selector cleaning** — `cleanSelectorArray()` removes any generic/global selectors that are now in the domain-specific array to prevent redundancy.
6. **Cache invalidation** — `configCache.invalidate(domain)` fires after the DB upsert commits.

The persistence service passes its active transaction client into this operation. The cache is invalidated after the persistence transaction commits.

---

## Key Data Stores

| Table | Purpose |
|-------|---------|
| `products` | Core product row: URL, `needs_price_review`, `checking_paused`, `ai_status` |
| `price_history` | Change-based history for standard, member, and original prices per product |
| `stock_status_history` | Append-only log of all stock status changes |
| `retailer_configs` | Domain-keyed scraping configs: selectors, `selector_metadata`, booleans |
| `system_logs` | Structured scrape/notification logs (14-day retention) |
| `exchange_rates` | Daily FX rates updated at 4 AM via cron |

## Product lifecycle boundaries

The scrape engine is reused by several entry points:

- product discovery when a new URL is submitted;
- manual rescan of an existing product;
- confirmation of a candidate from the voting modal;
- scheduled product refresh;
- administrative or diagnostic test runs.

Only the discovery and refresh paths automatically proceed into product persistence. A discovery or rescan result that requires review is returned to the frontend without being persisted until the user confirms a candidate. Scheduled refreshes can persist a result while also setting `needs_price_review` for later review.

## Notifications

Notifications are side effects of persisted product state and price comparisons, not part of the extraction engine itself. The refresh service currently evaluates:

- price drops;
- target-price hits;
- back-in-stock transitions from `out_of_stock`, `pre_order`, or `not_available` to `in_stock` when enabled;
- price announcements when a pre-order product receives its first price; and
- page-unavailable events after the page-gone threshold.

The event payload, delivery-provider behaviour, and frontend presentation are documented separately because one persisted event can fan out to multiple notification channels.

---

## Related Documentation

- [SELECTORS.md](SELECTORS.md) — Selector format reference (CSS, Scrapy `::attr`, regex `~pattern~`, modifiers)
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — Developer setup, Vitest suites, and local execution workflows
- [PROCESSES.md](PROCESSES.md) — Deployment, backup, and operational runbooks
- the upstream audit register (not yet imported) — Full backend audit with issue register and fix status
