# PriceStalker Admin: AI Features & Configuration

PriceStalker features a flexible, multi-provider AI engine that helps automatically generate CSS selectors for retailers and cross-verify scraped price data.

---

## 1. Supported AI Provider Options
Under the **AI Engine** tab of the Admin Panel, you can select which backend AI model provider you want to use. The system supports the following options:

* **Gemini (Google)**: Requires a Gemini API Key and model selection.
* **Vertex AI (Google Cloud)**: Requires a Google Cloud Project ID, Location, API Key, and model selection.
* **Anthropic**: Requires an Anthropic API Key and model selection (e.g., Claude).
* **OpenAI**: Requires an OpenAI API Key and model selection (e.g., GPT-4o).
* **Ollama**: Requires a connection URL and model selection to connect to a local server.
* **DeepSeek**: Requires a DeepSeek API Key and model selection.
* **Groq**: Requires a Groq API Key and model selection.
* **Mistral**: Requires a Mistral API Key and model selection.

---

## 2. Configuration Parameters
You can manage global settings via the **AI Engine** tab in the Admin Panel:

* **Enable AI Fallback**: Toggle switch. If enabled, PriceStalker will use the configured AI provider to extract prices when standard CSS/XPath selectors fail to find a valid price on the page.
* **AI Verification**: Toggle switch. If enabled, PriceStalker automatically runs an AI cross-check on scraped prices against the page HTML to ensure accuracy.
* **Auto-Mapping**: Toggle switch. If enabled, PriceStalker automatically generates CSS selectors for new or unmapped stores during background monitoring.

> [!NOTE]
> For security, API keys and configuration credentials will display as masked (`sk-...xxxx`) in the Admin UI.

---

## 3. Retailer Auto-Mapping
When you add a product from a store that is not yet configured:

1. **HTML Pruning**: PriceStalker automatically strips away redundant page content (like headers, sidebars, and scripts) to fit the page structure into a lightweight context (≤50KB).
2. **AI Selector Generation**: The system sends the cleaned page layout to the selected AI provider to identify the correct title, price, and availability elements.
3. **Automatic Save**: The AI returns the custom CSS rules which are written straight into your store's configuration. Future scans for that store will use these saved rules directly, avoiding any additional AI model calls or API costs.

---

## 4. Price Cross-Verification
To protect against scraper errors (e.g. capturing original price instead of sale price):

* **How it works**: After selectors extract a price, PriceStalker prompts the AI to verify it against the raw page layout.
* **Verification Check**: The AI verifies if the extracted value matches the actual selling price.
* **Failure Route**: If the AI cross-check fails or corrects the price, the product status is flagged as `needsReview` (needs price review) and routed to the user voting queue.
