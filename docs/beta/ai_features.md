# PriceStalker Admin: AI Features & Engines

PriceStalker integrates with Gemini AI models to automate store mappings and double-check scraped price data for correctness.

---

## 1. Setup & API Keys
To use AI capabilities, ensure you have set up a Gemini API Key in your global environment settings:

* **Settings File**: Verify `GEMINI_API_KEY` is defined in your `.env` configuration file.
* **Alternative Providers**: If using OpenAI or OpenRouter integrations, specify the matching provider parameters in settings.

---

## 2. Retailer Auto-Mapping
When you add a product from a store that is not yet configured, PriceStalker can generate the scraper rules automatically:

1. **HTML Pruning**: PriceStalker strips away redundant layout blocks (like headers, sidebars, and scripts) to fit the page size within the model's token limits (usually pruned to ≤50KB).
2. **Gemini Prompting**: The system feeds the cleaned HTML to Gemini.
3. **Rule Injection**: Gemini returns the CSS paths for the product name, price, and stock status. These rules are injected directly into your store's configuration database, allowing future scrapes to run quickly without invoking the AI model again.

---

## 3. Price Cross-Verification
To ensure data accuracy and protect against scraping errors, enable AI Verification:

* **How it works**: After PriceStalker extracts a price, it sends the raw product text along with the extracted price to Gemini.
* **Verification Check**: Gemini verifies if the extracted value is the actual current selling price visible on the page.
* **Discrepancy Action**: If the AI model flags a discrepancy, the scraped price is discarded and the product is routed to the `needsReview` queue.

---

## 4. AI Switch Toggles
You can manage these settings globally or per retailer domain under settings:
* `ai_auto_mapping_enabled`: Toggles automatic CSS rule generation for unsupported stores.
* `ai_verification_enabled`: Toggles cross-check verification on scraped values.
