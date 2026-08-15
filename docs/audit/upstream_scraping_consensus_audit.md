# Upstream Scraping & Consensus Audit

This document is a cleaned-up reference of the historical audits conducted upstream on the scraper, consensus, and product domain services. It acts as the reference registry for bugs and architecture adjustments inherited by **PriceStalker**.

---

## 📊 Upstream Master Audit Status

The original audit registers aggregated bugs across scraping, voting, database transactions, and route handlers.

### Round 1 Audit Registers

| ID | Severity | Layer | Description | Status Upstream |
|---|---|---|---|---|
| **S-1** | Medium | Stock | Schema.org overrides global selectors without logging. | Fixed |
| **S-2** | Medium | Stock | JSON-LD multi-offer stock resolution optimistically prefers `in_stock`. | Yellow / Has Issues |
| **S-3** | Low | Stock | `'unknown'` stock candidates pollute frontend voting data. | Yellow / Has Issues |
| **S-4** | Medium | Stock | Generic phrase matching falls back directly to `body` text. | Fixed |
| **P-1** | Medium | Price | Extraction pass method override produces no selector-level debug log. | Yellow / Has Issues |
| **P-2** | Low | Price | JSON-LD price key has dual-path resolution (ambiguous fallback). | Fixed |
| **P-3** | Medium | Price | JSON-LD recursive extraction produces duplicate candidates. | Fixed |
| **P-4** | Low | Price | Custom CSS extraction has no candidate count limit. | Fixed |
| **C-1** | Low | Consensus | `deal-price` and `pre-order-price` bypass the weight system with no drift check. | Fixed |
| **C-2** | Low | Consensus | Consensus output format is inconsistent. | Fixed |
| **C-3** | Medium | Consensus | Tie-breaking fallback selects lowest price instead of median or closest to anchor. | Yellow / Has Issues |
| **C-4** | Low | Consensus | OOS `highConfidenceMethods` list has undocumented gaps. | Fixed |
| **R-1** | Medium | Product | Notification logic compares pre-scrape price captured outside advisory lock. | Fixed |
| **X-1** | Low | Product | Auto-mapping re-runs full extraction phase including metadata. | Fixed |

---

### Round 2 Audit Registers (Orchestration & Security)

| ID | Severity | Layer | File/Context | Description | Status Upstream |
|---|---|---|---|---|---|
| **O-1** | Critical | Orchestration | `extraction.ts` | `priceCandidates` overwritten on auto-map re-extract. | Pending |
| **O-2** | High | Orchestration | `consensus.ts` | `isCorroborated` null-guard inverted. | Fixed |
| **O-3** | High | Orchestration | `consensus.ts` | OOS drift only checks downward spikes. | Fixed |
| **O-4** | High | Orchestration | `maintenance.ts` | `configCache.invalidate()` with no domain key wipes entire cache. | Pending |
| **O-5** | High | Orchestration | `maintenance.ts` | Wrong extraction step logged for status-restore vs engine-upgrade. | Pending |
| **O-6** | Medium | Orchestration | `index.ts` | `requestId` has only 1,000 entropy values. | Pending |
| **O-7** | Medium | Orchestration | `index.ts` | `isShellConfig` ignores `jsonld_price_key`. | Pending |
| **O-8** | Medium | Orchestration | `consensus.ts` | Arbitrated prices wrongly treated as uncorroborated in OOS guardrail. | Pending |
| **O-9** | Medium | Orchestration | `index.ts` | `scrapeProduct()` silently drops `retailerName` from return value. | Fixed |
| **O-10**| Medium | Orchestration | `arbitration.ts` | AI arbitration/verification errors swallowed. | Pending |
| **O-11**| Medium | Orchestration | `extraction.ts` | `resolveScrapeContext` called twice on auto-map re-extract. | Pending |
| **O-12**| Low | Orchestration | `arbitration.ts` | Local `ReviewReason` type missing `'price_drift'`. | Fixed |
| **O-13**| Low | Orchestration | `init.ts` | `globalAiSettings` typed as `any`. | Fixed |
| **A-1** | Critical | Transport | `remote.ts` | Off-by-one retry loop (max retries sentinel is dead code). | Pending |
| **A-2** | High | Acquisition | `index.ts` | `usedRemoteFallback` set before success (blocks fallbacks). | Pending |
| **A-3** | High | Acquisition | `index.ts` | Challenged remote HTML blocks fallback via flag. | Pending |
| **A-4** | High | Acquisition | `index.ts` | Fallback result never checked for challenge. | Pending |
| **A-5** | High | Acquisition | `standard.ts` | Proxy credentials logged in plaintext to `extractionSteps` database column. | Pending |
| **A-6** | High | Transport | `headers.ts` | Hardcoded Chrome 121 UA + `Sec-Ch-Ua` mismatch. | Pending |
| **A-7** | High | Transport | `remote.ts` | Axios 1.x uses `CanceledError` not `AbortError` — abort safety net broken. | Pending |
| **A-8** | High | Acquisition | `standard.ts` | Inconsistent retry budget — fallback retries 2x. | Pending |
| **A-9** | Medium | Transport | `headers.ts` | `Sec-Fetch-Site: none` conflicts with referrer header. | Pending |
| **A-10**| Medium | Transport | `headers.ts` | Missing `Accept-Encoding` header. | Pending |
| **A-11**| Medium | Acquisition | `standard.ts` | HTTP 407/401 proxy auth errors unhandled (propagate as crashes). | Pending |
| **A-12**| Medium | Transport | `remote.ts` | Empty remote HTML body silently treated as successful extraction. | Pending |
| **A-13**| Medium | Transport | `detection.ts` | Case-sensitive WAF marker detection. | Pending |
| **A-14**| Low | Transport | `detection.ts` | Akamai `Reference #18.` pattern too specific. | Pending |
| **A-15**| Low | Acquisition | `standard.ts` | `withRetry` logs under `'AI'` category for HTTP scraper calls. | Pending |
| **E-1** | High | Extractor | `dom-denoiser.ts`| `denoiseHtmlForRegex` nested-quantifier regex ReDoS vulnerability. | Pending |
| **E-2** | High | Extractor | `stock/schema.ts` | `walk()` recursion stack overflow risk (no depth guard). | Pending |
| **E-3** | High | Extractor | `arbitration.ts` | AI arbitration passed `allCandidates` including member/original prices. | Pending |
| **E-4** | Medium | Extractor | `price-extraction.ts`| `priceSpecification` double-processed (duplicate candidates). | Pending |
| **E-5** | Medium | Extractor | `dom-denoiser.ts`| JSON-LD blocks duplicated in DOM after clone re-append. | Pending |
| **E-6** | Medium | Extractor | `core/selectors.ts`| `normalizeSelector` corrupts CSS attribute selectors containing `\|`. | Pending |
| **E-7** | Medium | Extractor | `price-utils.ts` | No max price sanity guard (barcodes/SKUs enter candidate pool). | Pending |
| **E-8** | Medium | Extractor | `consensus.ts` | Member/original price group winner is first inserted, not highest-confidence. | Pending |
| **E-9** | Medium | Extractor | `consensus.ts` | `hasConsensus >= 1.0` lets single uncorroborated source reach consensus. | Pending |
| **E-10**| Medium | Extractor | `utils.ts` | Absolute tolerance `< 1.00` causes grouping failures for high-value items. | Pending |
| **E-11**| Medium | Extractor | `arbitration.ts` | Anchor-price fallback sets `aiStatus = 'confirmed'`. | Pending |
| **E-12**| Medium | Extractor | `stock/generic.ts`| `add to trolley` hardcoded in-stock phrase is locale-specific. | Pending |
| **E-13**| Medium | Extractor | `stock/generic.ts`| Add-to-cart button detection too broad. | Pending |
| **E-14**| Medium | Extractor | `stock/custom.ts` | Silent exception swallowing in stock selector evaluation. | Pending |
| **E-15**| Medium | Extractor | `dom-denoiser.ts`| DOM ancestor traversal not short-circuited (O(D×N) walks). | Pending |
| **E-16**| Medium | Extractor | `core/engine.ts` | XPath re-serializes full DOM on every XPath selector. | Pending |
| **E-17**| Medium | Extractor | `price-extraction.ts`| JSON-LD `"$"` currency defaults to `'USD'` without locale awareness. | Pending |
| **E-18**| Low | Extractor | `price-extraction.ts`| Invalid regex patterns swallowed silently. | Pending |
| **E-19**| Low | Extractor | `core/selectors.ts`| `isNoiseElement` runs all 10 ancestor iterations on detached nodes. | Pending |
| **PS-1**| Critical | Product | `ProductPersistenceService.ts` | `updateMetadata`/`updateStockState` ignore active transaction `_client`. | Pending |
| **PS-2**| Critical | Product | `ProductPersistenceService.ts` | `recordPrices` second `getLatest()` outside locked client — TOCTOU duplicate price inserts. | Pending |
| **PS-3**| High | Product | `notifications/alerts.ts` | `notifyPriceDrop` fires on price increases when `price_drop_threshold = 0`. | Pending |
| **PS-4**| High | Product | `notifications/alerts.ts` | `notifyTargetHit` fires on every price change while below target. | Pending |
| **PS-5**| High | Product | `ProductRefreshService.ts` | `notifyPriceAnnounced` fires spuriously on first-ever add of pre-order. | Pending |
| **PS-6**| High | Product | `utils/metadata.ts`| Product image permanently blocked from update once non-placeholder is set. | Pending |
| **PS-7**| High | Product | `ProductPersistenceService.ts` | Product name never corrected once set to bad value. | Pending |
| **PS-8**| High | Product | `utils/auto-config.ts` | Outer `catch` swallows all errors (transaction not rolled back). | Pending |
| **PS-9**| Medium | Product | `ProductPersistenceService.ts` | `syncUserCategories` runs outside transaction. | Pending |
| **PS-10**| Medium | Product | `auto-config.helpers.ts` | `resolveWinningSelector` filter is always-true when selectedMethod is null. | Pending |
| **PS-11**| Medium | Product | `add/confirmation.ts` | `...options` spread passes untrusted client data to persistence service. | Pending |
| **PS-12**| Medium | Product | `ProductRefreshService.ts` | 4 sequential pre-scrape DB queries (should be parallelized). | Pending |
| **PS-13**| Medium | Product | `utils/auto-config.ts` | All selector failure counters incremented even when no custom match was attempted. | Pending |
| **PS-14**| Medium | Product | `notifications/alerts.ts` | `'USD'` hardcoded currency fallback. | Pending |
| **SYS-1**| Critical | System | `DatabaseHealthMonitor.ts` | Admin email address exposed in `getStatus()` API response. | Fixed |
| **SYS-2**| High | System | `settings/ai.ts` | Gemini API key in URL query string — leaks to server/proxy access logs. | Pending |
| **SYS-3**| High | System | `DatabaseHealthMonitor.ts` | `warmCache()` hardcodes `WHERE id = 1`. | Pending |
| **SYS-4**| High | System | `SettingsListenerService.ts` | Reconnect loop flat 5s retry (hammers DB pool). | Pending |
| **SYS-5**| High | System | `DatabaseHealthMonitor.ts` | "Outage Resolved" email sent without prior "Outage Started" alert. | Pending |
| **SYS-6**| High | Routes | `RetailerTestingService.ts` | SSRF — unchecked URL passed to scraper with no IP validation. | Pending |
| **SYS-7**| High | Routes | `products/scan.ts` | Raw `async` handlers without `asyncHandler`. | Pending |
| **SYS-8**| High | Routes | `RetailerMutationService.ts` | `deleteRetailer()` TOCTOU cache key invalidation. | Pending |
| **SYS-9**| Medium | System | `DatabaseHealthMonitor.ts` | `sendAlertEmail` fire-and-forget (duplicate alert email risk). | Pending |
| **SYS-10**| Medium | System | `DatabaseHealthMonitor.ts` | TLS cert verification disabled for SMTP (`rejectUnauthorized: false`). | Pending |
| **SYS-11**| Medium | System | `settings/ai.ts` | `computeFallbacksForModels` matches virtually every OpenAI model. | Pending |
| **SYS-12**| Medium | System | `settings/system.ts` | Settings update loop has no transaction. | Pending |
| **SYS-13**| Medium | System | `SettingsListenerService.ts` | Stale debounce closure not cancelled on reconnect. | Pending |
| **SYS-14**| Medium | System | `settings/ai.ts` | API key mask detection based on `"..."` substring is fragile. | Pending |
| **SYS-15**| Low | System | `CurrencyConversionService.ts` | No timeout on Frankfurter API call. | Pending |
| **SYS-16**| Low | System | `CurrencyConversionService.ts` | AUD→AUD self-rate never written to DB. | Pending |
| **SYS-17**| Low | Routes | `admin/users.ts` | `PUT /:id` passes raw `req.body` to service. | Pending |
