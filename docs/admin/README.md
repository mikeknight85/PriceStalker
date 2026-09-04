# PriceStalker Administration Guide

This portal contains detailed guides for administrators managing retailers, custom selectors, AI settings, API security tokens, and network configuration.

---

## Admin Help Portal

* **[General Administration Guide](admin_guide.md)**
  An overview of the admin console features and navigation tabs.

* **[1. System Settings & Management](system.md)**
  Configuring proxy settings, remote browser scraper URLs, SearXNG product search, and security toggles.

* **[2. Extraction Rules & Universal Fallbacks](global_selectors.md)**
  System-wide fallback extraction rules and phrase dictionaries grouped by product info, pricing, availability, and false-positive prevention.

* **[3. Selectors & Retailer Configuration Guide](selectors.md)**
  How to configure per-domain extraction rules, page acquisition, CSS/XPath/Regex selectors, stock phrases, and eviction mechanics.

* **[4. Security & API Tokens](tokens.md)**
  Instructions on generating, viewing, and revoking machine access tokens.

* **[5. Authentication & SSO Setup](../design/SSO_DESIGN.md)**
  Configuring OpenID Connect (OIDC) Single Sign-On and user login policies.

* **[6. AI Features & Setup](ai_features.md)**
  Configuring the AI engine for store auto-mapping, price verification, and fallback extraction.

* **[7. System Event Logging](../developer/LOGGING.md)**
  Multi-target logging, level hierarchies, and querying persistent logs in the Admin viewer.

* **[Admin API Endpoints Reference](admin_api.md)**
  A complete list and reference of the secure HTTP API endpoints used to manage PriceStalker.

* **[User Notifications Guide](user_notifications.md)**
  How to configure Telegram, Discord, Pushover, Email, Gotify, and Webhook notification channels and customized price alerts.



---

## Related Documentation
* **[User Guide](../user/README.md)**: Simplified flow reference for scraping, price review, and the scheduler queue.
* **[Technical Scraper Lifecycle](../developer/SCRAPER_LIFECYCLE.md)**: Technical overview of the scraper's seven execution stages and its product-monitoring hand-off.
* **[SSO / OIDC Setup Guide](../design/SSO_DESIGN.md)**: Details on single sign-on authentication configuration.
* **[Database Schema Guide](../developer/DATABASE.md)**: Overview of PostgreSQL tables, schemas, and backup targets.
