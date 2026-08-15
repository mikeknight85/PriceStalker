# Scraping & Configuration Reference Architectures

This document integrates the architectural guides for scraping behaviors, configuration flags, stock selector modifiers, and external references imported from the upstream codebase.

---

## 🗺️ Scraper Configuration Flags Architecture

PriceStalker uses a **Split Architecture** scraping model. When a product is due for checking, the acquisition engine evaluates the retailer configuration flags to choose a fetch strategy.

```mermaid
graph TD
    A[Start Scrape] --> B{use_remote_scraper || is_js_heavy || use_browser?}
    
    B -- Yes --> C{use_remote_scraper?}
    C -- Yes --> D[Fetch via Remote Scraper (ruski Puppeteer)]
    C -- No ---> E{use_browser || is_js_heavy?}
    E -- Yes --> F[Fetch via Local Browser (Puppeteer inside backend)]
    
    B -- No ---> G[Fetch via Standard HTTP (Axios)]
    
    D --> H[Verify Content & Bot Challenges]
    F --> H
    G --> H
    
    H -- Challenge Detected & No Config ---> I[Trigger Fallback Algorithm]
    I --> J{Remote Scraper URL Configured?}
    J -- Yes --> K[Try Remote Scraper -> Learn: use_remote_scraper=true, is_js_heavy=true]
    J -- No --> L[Try Local Puppeteer -> Learn: use_browser=true, is_js_heavy=true]
```

### Detailed Flag Breakdowns

#### 1. `use_remote_scraper`
* **Purpose**: Offloads browser rendering to a dedicated remote Puppeteer microservice (running on the high-resource `ruski` host).
* **Usage**: Enabled when the retailer site employs complex anti-bot screens (like Cloudflare, Geoblocking, or challenge scripts) that block direct backend requests. It preserves CPU/memory on the primary host `vodka`.
* **Implementation**: The backend triggers `acquireRemoteHtml()` in [`remote.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/remote.ts) to send a POST request with the URL and options to the remote scraper's `/scrape` endpoint.

#### 2. `use_browser`
* **Purpose**: Forces the backend to spin up a headless Puppeteer browser *locally* inside the primary backend Docker container.
* **Usage**: Used if the site requires dynamic rendering to display price/stock information, but the remote scraper service (`ruski`) is offline or unconfigured.
* **Implementation**: Evaluated in `handleAcquisitionFallback` inside [`fallback.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/acquisition/fallback.ts).

#### 3. `is_js_heavy`
* **Purpose**: Flags that a website relies on dynamic Client-Side Rendering (CSR) frameworks (like React, Angular, or Vue) where content is not present in the initial server-side HTML.
* **Usage**: Enabled when standard HTTP (Axios) fetches return empty body shells (like `<div id="app"></div>` or loading spinners) with no actual price/product nodes.
* **Implementation**: Bypasses standard HTTP and routes requests via browser scraper.

#### 4. `use_proxy`
* **Purpose**: Routes standard HTTP and browser-based requests through a configured proxy server to bypass IP blocks, rate limits, or region-based routing.
* **Usage**: Enabled when the retailer block-lists the scraper's home IP (returns HTTP 403 or times out) or serves different regional prices.
* **Implementation**: Instantiates Axios with a proxy agent (`httpsAgent`) configured via `settingsCache.getScraperProxy()`. For remote scrapers, it passes the proxy details in the JSON options payload.

---

## 🛠️ Stock Selector Modifiers Syntax

The parser utility `parseSelector` translates selector strings from `retailer_configs` into executable extraction logic. While standard fields extract raw values, **Stock Selectors** support a custom modifier suffix syntax.

| Selector Type | Example | Extraction Behavior | Status Determination |
|---|---|---|---|
| **Standard CSS** | `#availability` | Extracts element's inner text. | Text is matched against global/retailer word-lists (`oosPhrases`, `prePhrases`, `isPhrases`). |
| **Attribute Suffix** | `meta[itemprop="availability"]::attr(content)` | Extracts value of a specific HTML attribute (e.g. `content` or `href`). | Attribute value is matched against word-lists. |
| **Regex Suffix** | `~"price":\s*([\d.]+)~` | Runs a regular expression directly against the raw HTML string. | Matches are parsed directly. |
| **Stock Modifier** | `span.availability-msg::contains(Temporarily out of stock)->in_stock` | Extracts element text or attribute. | Bypasses word-lists; compares string via `equals` or `contains`, and immediately asserts the mapped status (e.g. `in_stock`). |

### Suffix Modifier Syntax Parsing
The suffix modifier syntax is parsed using a standardized regular expression in [`selectors.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/core/selectors.ts):

```typescript
const suffixModifierRegex = /^(.+?)(::attr\((.+?)\))?::(equals|contains)\(([\s\S]+?)\)->([a-z0-9_-]+)$/i;
```

#### Regex Match Groups:
1. **Base Selector**: `span.availability-msg` (the actual CSS selector used to find the element).
2. **Attribute Extraction (Optional)**: `::attr(name)` (extracts an attribute value instead of inner text).
3. **Comparison Type**: `equals` or `contains` (determines whether to perform an exact match or substring check).
4. **Target Condition**: The string to compare against (e.g. `"Temporarily out of stock"`).
5. **Mapped Status**: The discrete `StockStatus` to return if matched (e.g., `in_stock`, `pre_order`, `out_of_stock`).

### Modifier Processing Loop
The stock extractor evaluates modifier configurations in [`custom.ts`](file:///home/steven/projects/pricestalker/backend/src/services/scraper/extractors/stock/custom.ts):

```typescript
if (modifier) {
  const targetValLower = modifier.value.toLowerCase();
  let isMatch = false;
  
  if (modifier.type === 'equals') {
    isMatch = lowerText === targetValLower;
  } else if (modifier.type === 'contains') {
    isMatch = lowerText.includes(targetValLower);
  }

  if (isMatch) {
    candidates.push({
      value: modifier.targetStatus as StockStatus,
      method: methodLabel,
      selector: s,
      context: text.trim(),
      confidence
    });
  }
  continue; // Skip standard phrase check
}
```

---

## 📚 External Scraping Architectures References

Open-source and commercial scraping architectures that have inspired parts of the scraper design:

### 1. Crawlee (TypeScript / Node.js)
* **SessionPool & IP Rotation:** Treats proxy rotation as a stateful pool where each "session" binds a specific IP, User-Agent, and cookie jar. Sessions are scored and discarded upon block threshold.
* **Unified Interface:** Allows switching a crawler from Cheerio (raw HTML parsing) to Playwright/Puppeteer (browser rendering) dynamically on failure.

### 2. ChangeDetection.io (Python / Flask)
* **Visual Selector Picker:** Generates minimal, robust CSS selectors instead of brittle absolute paths.
* **Ddiff and Filters:** Employs visual diffing and drop filters using numeric thresholds and back-in-stock phrase recognition.

### 3. Portia (Python / Scrapy)
* **Template Drift Detection:** Detects layout shifts by analyzing the tree similarity index, alerting when template schemas are broken.
