# PriceStalker Admin Guide

This guide describes how to navigate and manage the administrative features of the PriceStalker Admin Panel (`/admin`). 

---

## 🗺️ Sidebar Navigation Tabs

The System Administration screen is organized into eight specialized tabs:

### 1. System
Configure network proxy routing, remote Puppeteer scraper links, browser timeouts/referrers, product discovery via SearXNG, and master toggles for registrations or debug pages.
* *For details, see [system.md](system.md).*

### 2. Global Selectors
Configure default system-wide extraction selectors. These act as universal fallbacks if a retailer has no domain-specific configuration defined.
* **Global Price Selectors**: Standard class and attribute patterns used to find price strings.
* **Global Stock Selectors**: Universal phrases or attribute schemas (like `[itemprop="availability"]`) used to assess stock levels.

### 3. Retailers
Manage configurations on a domain-by-domain basis. You can add new domains, inspect selector counts, configure anti-bot proxies, test scraper configs, or edit custom selectors.
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
