# PriceStalker Selector & Extraction Guide

> **Provenance:** adapted from the upstream engine docs (shared scraper core). Infra specifics removed; logic matches this repo. Verify against code — docs can drift.


This document explains how to configure custom selectors, attribute-based extraction, and suffix modifiers for stock status detection within the PriceStalker Admin UI.

---

## 🛠️ UI Field Mapping

When configuring a retailer via the Admin panel, use the following fields inside the **"📦 Stock Status & Phrases"** collapsible card:

| Field Name | Description |
| :--- | :--- |
| **Stock Status Selectors** | The elements and attributes to query. Order matters (top-down evaluation). |
| **In-Stock Phrases** | Phrases that indicate availability (e.g., `in stock`, `add to cart`). |
| **Out-of-Stock Phrases** | Phrases that indicate unavailability (e.g., `sold out`, `unavailable`). |
| **Pre-Order Phrases** | Phrases that indicate pre-order status (e.g., `pre-order`). |

---

## 🚀 Unified Selector Engine

PriceStalker uses a unified multi-engine selector system that allows you to mix and match CSS, XPath, and Regex within the same configuration arrays.

### 1. CSS (Default)
* **Syntax**: `.my-class`, `#price`, `div.product > span`
* **Behavior**: Uses Cheerio to extract visible text content.
* **Attributes**: Use `::attr(name)` to pull attribute values.
* **Raw HTML**: Prefix with `!` to get outer HTML (e.g. `!.product-table`).

### 2. XPath
* **Syntax**: `xpath://div[@id='price']`, `xpath://span[contains(@class, 'value')]`
* **Behavior**: Executes a standard XPath query against the DOM.
* **Prefix**: MUST start with `xpath://`. If the internal path doesn't start with `/` or `.`, PriceStalker automatically prepends `//`.

### 3. Regex
* **Syntax**: `regex:/Price: \$([0-9,.]+)/`
* **Behavior**: Runs a regular expression against the raw fetched HTML.
* **Capture Groups**: The first capturing group is used as the result. If no groups are present, the whole match is used.
* **Legacy Format**: `~pattern~` is still supported and automatically treated as a Regex.

---

## 🛠️ Suffix Modifiers & Chaining

Modifiers can be appended to ANY base selector (CSS or XPath) to transform or assert the result.

### 1. Attribute Extraction (`::attr`)
* **Format**: `base-selector::attr(attributeName)`
* **Example**: `xpath://meta[@property='og:price:amount']::attr(content)`

### 2. Status Assertion (`->status`)
Modifiers allow for direct status assertion (primarily for Stock Status) without relying on global phrase matching.
* **Equals**: `selector::equals(value)->status`
* **Contains**: `selector::contains(substring)->status`
* **Example**: `xpath://div[@class='stock-info']::attr(data-status)::equals(preorder)->pre_order`

### 3. Execution Order
1. **Engine Routing**: Determine if it's CSS, XPath, or Regex.
2. **Extraction**: Fetch the target element or text.
3. **Attribute Pull**: If `::attr` is present, get the attribute.
4. **Modifier Check**: If `::equals` or `::contains` is present, check the value.
5. **Status Return**: If the modifier matches, return the target status (e.g. `in_stock`).

---

## 🧹 DOM Denoising & Preservation

The pre-extraction denoiser protects your custom selectors while stripping page noise.

1. **Automatic Preservation**: Any element targeted by a custom CSS selector in your retailer configuration (including its parent tree) is automatically protected from deletion.
2. **Global Fallbacks**: High-confidence attributes like `data-testid` and `itemprop` are also preserved to serve as universal fallbacks.
3. **Safety Switch**: Toggle **"Skip Denoising"** on a retailer config to pass the raw HTML directly to the extraction engine.

---

## 📈 Selector Staleness & Match Tracking

PriceStalker features a database-backed config auto-learning and eviction engine to maintain custom retailer configurations:

1. **Whitelisted Method Promotion**: When a price is confirmed, only selectors resolved from specific whitelisted methods (`custom-css`, `deal-price`, `member-price`, `pre-order-price`, `original-price`, `custom-regex`) are promoted to the retailer's custom config, preventing generic styles from polluting the configuration.
2. **Success/Failure Statistics**: Every scrape tracks custom selector matches using `selector_metadata` JSONB on `retailer_configs`.
   - Matching selectors increment `match_count`, reset `consecutive_failures` to `0`, and update `last_matched_at`.
   - Non-matching custom selectors evaluated during a scrape increment `consecutive_failures`.
3. **Score-Based Eviction**: When a selector array grows beyond 10 entries, PriceStalker sorts custom selectors by score:
   `score = match_count - consecutive_failures * 2`
   It retains the top 10 highest-scoring selectors and evicts stale, failing ones dynamically.

