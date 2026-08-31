# PriceStalker Admin Guide

This guide describes how to navigate and manage the administrative features of the PriceStalker Admin Panel (`/admin`). 

---

## Sidebar Navigation Tabs

The System Administration screen is organized into eight specialized tabs:

### 1. System
Configure network proxy routing, remote Puppeteer scraper links, browser timeouts/referrers, product discovery via SearXNG, and master toggles for registrations or debug pages.
* *For details, see [system.md](system.md).*

### 2. Extraction Rules
Default system-wide extraction rules, used as fallbacks when a retailer has no
site-specific configuration of its own.

Rule priority: **retailer rules -> these default rules -> built-in fallbacks.**

The screen is grouped by the job each rule does:

* **Product information**: product title, retailer identity, product image.
  Retailer identity is the shop, not the manufacturer.
* **Pricing**: current, sale/deal, member, pre-order, and original/RRP. Only the
  current price becomes the tracked price; the rest are recorded alongside it.
* **Availability**: stock evidence selectors, then the status phrases read inside
  them. Detection order is member only -> pre-order -> out of stock -> in stock.
* **False-positive prevention**: exclusion selectors, removed from the page
  before extraction runs.

Saved changes reach a running scraper within 30 minutes, because settings are
cached. The **Apply now** button on this screen clears that cache immediately.

### 3. Retailers
Manage configurations on a domain-by-domain basis. The editor is grouped the same
way as Extraction Rules:

* **Retailer identity**: friendly name, domain, notes, and the selectors that
  identify the shop.
* **Page acquisition**: browser scraper, proxy, currency hint, user agent,
  referrer.
* **Product information**: title and image selectors, and their JSON-LD keys.
* **Pricing**: the five price types, the JSON-LD price key, and the per-retailer
  **Prefer JSON-LD Images** override.
* **False-positive prevention**: exclusion selectors and the raw selector JSON.
* **Availability**: stock evidence and status phrases.
* **Validation**: the live tester and AI preprocessor selectors.

**Re-run auto-map** in the sticky header regenerates a retailer's selectors from a
product page you supply, without deleting the retailer first. A product URL is
required: mapping works by reading a real product page, and a home page has no
price to learn from. The generated configuration replaces what is saved, and the
scraper's config cache is cleared so the next scrape uses it.
* *For selector syntax rules and eviction mechanics, see [selectors.md](selectors.md).*

### 4. Users
Administrate the user database:
* Create new accounts or edit existing profile settings.
* Toggle the **Is Admin** flag to grant/revoke access to administrative panels.
* Set default regional preferences (currency, timezone, and locale).

### 5. API Tokens
Generate and manage database-backed access tokens used by external integrations (like Discord bots or scripting webhooks) to safely query endpoints.
* *For terminal command scripts and authentication syntax, see [tokens.md](tokens.md).*

### 6. Authentication
Set up Single Sign-On (SSO) with OpenID Connect (OIDC) identity providers (like Google, Keycloak, or Authentik). Configure policies determining if login is restricted to local credentials, OIDC, or supports both.
* *For architecture details and parameters, see [SSO_DESIGN.md](../SSO_DESIGN.md).*

### 7. AI Engine
Configure the active AI provider (Gemini, OpenAI, Anthropic, Ollama, Vertex, etc.), input credentials, test provider connections, and toggle switches for **AI Fallback**, **AI Verification**, and **Auto-Mapping**.
* *For supported models and configuration guidelines, see [ai_features.md](ai_features.md).*

### 8. Logs
View and search the structured `system_logs` history:
* Filter logs by level (`info`, `warn`, `error`) and context context.
* Clear logs to prune the database.
* Inspect troubleshooting details for failed scrapes.
