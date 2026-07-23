# PriceStalker Admin Guide

This guide describes how to manage the administrative features of PriceStalker, including store configs (retailers), system configurations, security tokens, and the AI engine.

---

## 1. Retailer Configuration
Retailers represent the e-commerce websites and stores that PriceStalker monitors. Under the Admin section, you can manage how the scraper behaves for each individual domain.

### Dynamic Selectors
Each retailer has a set of array lists containing CSS selectors, Scrapy-style helpers, or regex rules to locate target values:
* **Price Selectors**: CSS paths that point directly to the main selling price (e.g., `.price-sale`, `#product-price`).
* **Name Selectors**: Paths to locate the product title.
* **Stock Selectors**: Custom elements that denote stock levels or availability words.

*For an in-depth guide on writing and managing custom query rules, see [selectors.md](selectors.md).*

### Auto-Promotion & Eviction
* When a scraper run succeeds (either via auto-detection or a user voting selection), the successful selector is automatically promoted to index `0` for fast execution in future runs.
* If a selector accumulates too many consecutive failures, it is automatically demoted and eventually evicted from the configuration arrays to prevent redundant scans.

---

## 2. System Settings
System Settings control global scraper behavior and connection details:

* **Proxies**: Configure proxy servers under settings to route requests through different IP addresses. This is critical for stores that block standard hosting provider IP ranges.
* **Scraper Frequency**: Configure default interval schedules (default is every 12 hours) specifying how often background products are re-checked.
* **Circuit Breakers**: Stores that persistently return severe connection errors (e.g. HTTP 503 Service Unavailable, Cloudflare challenge loops) automatically trigger a backoff cooldown. Admin configurations let you review which domains are temporarily blocked.

*For details on configuring proxies, schedules, and circuit breakers, see [system.md](system.md).*

---

## 3. Tokens (API & Security)
External services (like custom scripts, Discord bots, or home automation integrations) interact with the PriceStalker API using authorization headers.

* **Generating API Tokens**:
  You can generate authentication tokens to authenticate requests without revealing password secrets. If you need to generate a token programmatically, you can run the helper script in the workspace root:
  ```bash
  pnpm --filter pricestalker-backend exec ts-node src/scripts/generate-api-token.ts --user <username>
  ```
* **Authentication Header Format**:
  Send the generated token with your HTTP requests using the standard header format:
  ```http
  Authorization: Bearer <your_generated_token>
  ```

*For more information on authorization headers and token management, see [tokens.md](tokens.md).*

---

## 4. AI Engine Configuration
The AI Engine leverages Gemini models to auto-map new shops and verify data.

### Configuration Settings
1. **API Keys**: Save your API credentials in the settings dashboard (configured as `GEMINI_API_KEY` or equivalent provider variables in your `.env` file).
2. **Auto-Mapping Switch (`ai_auto_mapping_enabled`)**:
   * **On**: If a user submits a product from an unsupported store, PriceStalker prunes the page HTML down to 50KB and asks Gemini to identify and generate the correct CSS selector elements. These are then saved straight into the database configuration.
   * **Off**: The scraper relies solely on generic CSS rules and structural JSON-LD data.
3. **Verification Switch (`ai_verification_enabled`)**:
   * **On**: Whenever a price is resolved, the system prompts Gemini to double-check it against the visual elements of the denoised page layout, flagging it if there is a discrepancy.
   * **Off**: Resolved prices bypass the cross-validation step.

*For detailed configuration instructions and model behavior, see [ai_features.md](ai_features.md).*

---

## 5. Single Sign-On (SSO / OIDC)
PriceStalker supports Single Sign-On integration with OAuth2 / OpenID Connect compliant identity providers (e.g. Google, Keycloak, Authentik). 
* Configuration is managed via **Settings → Authentication** inside the Admin UI.
* Admins can toggle login policies between local email/passwords, SSO, or both.

*For detailed SSO / OIDC setup instructions, see [SSO_DESIGN.md](../SSO_DESIGN.md).*

