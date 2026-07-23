# PriceStalker Admin: Selectors & Rules Guide

PriceStalker uses a unified selector engine that allows administrators to define custom paths to extract prices, product titles, and stock statuses. You can mix CSS, XPath, and Regex patterns within your retailer configurations.

---

## 1. UI Field Mapping
When configuring a retailer via the Admin panel, use the following fields inside the **Stock Status & Phrases** collapsible card:

| Field Name | Description |
| :--- | :--- |
| **Stock Status Selectors** | The elements and attributes to query. Order matters (top-down evaluation). |
| **In-Stock Phrases** | Phrases that indicate availability (e.g., `in stock`, `add to cart`). |
| **Out-of-Stock Phrases** | Phrases that indicate unavailability (e.g., `sold out`, `unavailable`). |
| **Pre-Order Phrases** | Phrases that indicate pre-order status (e.g., `pre-order`). |

---

## 2. Selector Types

### CSS (Default)
By default, any rule you input is treated as a CSS selector. Cheerio parses the page, finds the element, and extracts its text.
* **Syntax**: `.price-amount`, `span[itemprop="price"]`, `#pdp-details .current-price`
* **Attribute extraction**: Add `::attr(attributeName)` to pull metadata values.
  * *Example*: `link[itemprop="availability"]::attr(href)` (extracts the link URL)
* **Raw HTML extraction**: Prefix with `!` to extract the outer HTML snippet instead of plain text.
  * *Example*: `!.product-title`

### XPath
When CSS is not flexible enough (e.g. you need to select elements based on sibling positioning or text contents), you can use XPath queries.
* **Syntax**: Must start with `xpath://`
* **Prepend Rule**: If the path does not start with `/` or `.`, PriceStalker automatically prepends `//` for you.
  * *Example*: `xpath://div[@class="pricing"]`
  * *Example*: `xpath:span[text()="Out of Stock"]` (becomes `xpath://span[text()="Out of Stock"]`)

### Regex (Regular Expressions)
If the price or details are locked inside script blocks or raw Javascript variables on the page, you can use regular expressions.
* **Syntax**: Must start with `regex:/pattern/`
* **Capture Groups**: The first match capture group `()` is extracted. If no groups are present, the entire expression match is taken.
  * *Example*: `regex:/var price = "([0-9.]+)";/`
* **Legacy format**: Patterns enclosed in tildes (`~pattern~`) are automatically treated as regex rules.

---

## 3. Suffix Modifiers (Asserting Stock Status)
Modifiers allow you to assert a status directly instead of checking against global phrase lists. This is highly useful for stock indicators.

### Syntax
`base-selector::equals(targetValue)->status`  
`base-selector::contains(substring)->status`

### Target Statuses
The returned value must be one of:
* `in_stock`
* `out_of_stock`
* `pre_order`

### Examples
* `xpath://div[@class="stock"]::attr(data-status)::equals(preorder)->pre_order`
* `.availability-label::contains(sold out)->out_of_stock`

---

## 4. DOM Denoising & Preservation
The pre-extraction HTML denoiser prunes page noise (like sidebars and script sections) while preserving target elements to ensure clean matches:

1. **Automatic Preservation**: Any element targeted by a custom CSS selector in your retailer configuration (including its parent tree) is automatically protected from deletion.
2. **Global Fallbacks**: High-confidence attributes like `data-testid` and `itemprop` are also preserved to serve as universal fallbacks.
3. **Safety Switch**: Toggle **"Skip Denoising"** on a retailer config to pass the raw HTML directly to the extraction engine if the layout is stripping required nodes.

---

## 5. Selector Eviction & Health
Every custom selector you define has a health score calculated by the database. The system automatically prunes unused or failing custom selectors when the array exceeds 10 entries.

* **Score Formula**: `score = match_count - consecutive_failures * 2`
* When a product is successfully scraped, the winning selector gets its `match_count` incremented, `consecutive_failures` reset to `0`, and is promoted to the top of the list (`index 0`).
* Stale selectors that fail will gradually lose points and be evicted.
