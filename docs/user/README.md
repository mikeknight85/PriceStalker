# PriceStalker User Guide: How Product Tracking Works

This guide provides a simple, high-level overview of how PriceStalker tracks product prices, uses AI to adapt to new stores, and helps ensure data accuracy.

---

## 1. Adding a Product
When you paste a product URL into PriceStalker (e.g., `https://example.com/product/cool-shoes`), the system starts a multi-phase scraping pipeline:

1. **URL Normalization**: The system strips out marketing trackers (like UTM codes) and cleans up formatting to ensure a consistent, unique link.
2. **Setup**: It resolves what store (retailer) the URL belongs to and figures out details like currency and country rules.

If the price is clear, tracking starts automatically. If the page contains
several possible prices, PriceStalker asks you to confirm which one should be
tracked before creating the product.

### Everyday product controls

From a product page, you can manually refresh the product, pause or resume
scheduled checks, review price and stock history, and update notification
preferences. A manual refresh is useful after a retailer changes its page or
when you want to check a product before its next scheduled refresh.

---

## 2. How the Scraper Reads a Product Page

For most retailers, PriceStalker reads the page using a fast standard web
request. It then removes unrelated page content and looks for the product
name, retailer, image, price, and stock information.

Some retailers need JavaScript to display their product details, or block
ordinary requests with services such as Cloudflare or Imperva. For those
retailers, an administrator can enable the optional browser scraper. It uses a
separate stealth browser service to load the page more like a normal browser.

The browser scraper is optional and is not required for ordinary retailers. If
you are only tracking products, you normally do not need to configure it; ask
your administrator to enable it for a retailer when ordinary checks cannot
read the page correctly.

---

## 3. Data Extraction (The Cascade)
Once the HTML is downloaded, the system denoises the page—stripping out heavy scripts, footers, headers, and navigation menus to keep only the core product content. It then checks for prices in a **7-layered cascade**:
1. **Structural Metadata** (JSON-LD data formatted for search engines like Google).
2. **Deal Selectors** (Temporary deals/sale prices).
3. **Member Selectors** (Loyalty/club prices).
4. **Pre-Order Selectors** (Upcoming release prices).
5. **Original Price Selectors** (Manufacturer's Suggested Retail Price/RRP).
6. **Custom Store Selectors** (Specific CSS paths tailor-made for that retailer).
7. **Generic Selectors** (Fallback patterns matching standard price structures).

### Price types

The product page may contain more than one legitimate price:

* **Current price**: The normal selling price PriceStalker uses for tracking.
* **Deal price**: A sale or promotional price.
* **Member price**: A price available through a loyalty or membership scheme.
* **Pre-order price**: A price shown for an upcoming product.
* **Original price**: A previous, recommended, or reference price.

Price history keeps these price types separate where the retailer provides
enough evidence to distinguish them.

---

## 4. When a Page Is Unavailable

PriceStalker distinguishes between an uncertain check and a page that appears
to have gone away:

* A temporary network problem, timeout, or blocked response normally leaves the
  last known stock status unchanged.
* A confirmed 404, redirect to an error page, or other soft-404 result is
  counted across multiple checks before action is taken.
* After three consecutive page-gone results, the product is marked
  **Unavailable**, monitoring is paused, and a notification can be sent.
* A manual or forced refresh can resume monitoring if the page becomes
  available again.

This prevents a short-lived retailer outage or bot-protection response from
immediately making a product appear permanently unavailable.

## 5. Where AI Fits In (Enhanced, but Optional)
PriceStalker is built to be resilient, even without AI. However, enabling the AI Engine unlocks powerful benefits:

### AI Auto-Mapping
* **Without AI**: If a new store is added that doesn't have custom rules yet, PriceStalker relies on generic CSS patterns, which are sometimes less precise.
* **With AI**: If a store config is missing or incomplete, the system prunes the HTML and sends it to the configured AI provider. The AI automatically builds the exact CSS rules needed to track prices on that store in the future, saving them back into the database automatically.

### AI Price Cross-Verification
* If enabled, the AI engine double-checks the final price extracted by the system against the raw page layout. If the AI detects an error, it flags the product for human review instead of saving a wrong price.

---

## 6. Price Consensus & The Voting Modal
Sometimes, different elements on a page list different prices (e.g., a "Buy Now" price vs. "Save $10" deal tags). PriceStalker handles this gracefully:

* **Consensus Engine**: The system groups all extracted price candidates and tallies them up using a weighting scale. High-priority paths (like JSON-LD) carry more weight than generic HTML scans.
* **Out-of-Stock Guardrails**: If a product goes out of stock, PriceStalker applies safety rules (like checking if a price drifted down by more than 50% from the last known price) to avoid recording temporary glitches.
* **The Voting Modal (Human-in-the-Loop)**: If the system cannot resolve a clear winner, or if a price is suspicious, it sends the result for review. The Price Selection Modal shows the candidates so you can select the correct price. The system then records your choice and can learn from it.

---

## 7. The Learning Loop
When you manually select the correct price in the Voting Modal (or when a scrape is successful), PriceStalker learns from it:
* It analyzes which rule successfully found that price.
* It promotes that rule to the top priority for that store.
* It tracks rule failure rates. If a rule fails too many times consecutively, it is automatically demoted or evicted.

## 8. Refreshes, Notifications, and Troubleshooting

Products are checked according to their configured refresh interval. A product
may not be checked immediately after it is added because the scheduler spreads
checks out to reduce load on retailers. You can use manual refresh when an
immediate check is needed.

Notifications can cover price drops, target prices, back-in-stock events,
newly announced pre-order prices, and products that appear to have become
unavailable. Notification channels and thresholds are configured separately;
see the [Notifications guide](../admin/user_notifications.md).

If a product needs attention:

* **No price found**: the retailer page may have changed or require a retailer
  configuration update.
* **Awaiting price review**: several candidates disagreed, so select the price
  you want to track.
* **Unavailable**: the page appeared to be gone across repeated checks. A
  manual refresh can resume tracking if the page returns.
* **The page is incomplete or blocked**: an administrator may need to enable
  the browser scraper or update the retailer rules.

## 9. Currency and privacy

PriceStalker can display prices in your preferred currency using its configured
exchange-rate data. The original retailer currency remains part of the price
record.

If an administrator enables AI extraction, auto-mapping, or verification,
relevant page content may be sent to the configured AI provider. Check with
your administrator if your deployment has specific privacy or data-retention
requirements.

### Small glossary

* **Retailer**: The store or website selling the product.
* **Selector**: A rule that identifies a price, product detail, or stock element
  on a page.
* **Stock status**: Whether a product is in stock, out of stock, on pre-order,
  member-only, unavailable, or unknown.
* **Price candidate**: A possible price found on the page before PriceStalker
  chooses or asks you to confirm the result.

---

## Related Documentation
* **Scraper Internals**:
 * [Scraper Lifecycle](../developer/SCRAPER_LIFECYCLE.md) — Detailed technical stage-by-stage guide.
 * [Lifecycle Diagrams](../developer/product_lifecycle_slides.md) — Visual flow diagrams for the scraper pipeline.
 * [Selector Guide](../developer/SELECTORS.md) — In-depth guide on scraper selectors.
* **Administration & Setup**:
 * [Admin Guide](../admin/admin_guide.md) — General administration and settings dashboard guide.
 * [Selector Rules](../admin/selectors.md) — How to write custom CSS, XPath, and Regex selectors.
 * [AI Features](../admin/ai_features.md) — Configuring AI auto-mapping and verification.
 * [API Tokens](../admin/tokens.md) — Creating security credentials and API tokens.
 * [System Settings](../admin/system.md) — Managing proxies, schedules, and circuit breakers.
 * [Admin API](../admin/admin_api.md) — Reference of secure HTTP endpoints for programmatic management.
 * [Notifications](../admin/user_notifications.md) — How to configure notifications and customized alert types.
