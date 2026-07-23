# PriceStalker Version 2 Beta Documentation

Welcome to the documentation portal for PriceStalker Version 2. This directory contains detailed guides for administrators on managing, configuring, and securing the system.

---

## 📖 Admin Help Portal

* **[General Administration Guide](admin_guide.md)**  
  An overview of the admin console features including retailer databases, scheduling checks, security tokens, and AI engines.
  
* **[Selectors & Rule Extraction](selectors.md)**  
  How to write and test custom CSS, XPath, and Regex rule paths for parsing product names, prices, and stock statuses.
  
* **[AI Features & Setup](ai_features.md)**  
  Configuring Gemini AI models to automate store selector mappings and perform price cross-verification.
  
* **[Security & API Tokens](tokens.md)**  
  Instructions on generating and managing API keys and utilizing Bearer authorization.
  
* **[System Settings & Management](system.md)**  
  Configuring proxy lists, adjusting background schedules, and managing circuit-breaker backoffs.

* **[Admin API Endpoints Reference](admin_api.md)**  
  A complete list and reference of the secure HTTP API endpoints used to manage PriceStalker.

* **[User Notifications Guide](user_notifications.md)**  
  How to configure Telegram, Discord, Pushover, Email, and Webhook notification channels and customized price alerts.



---

## 🔗 Related Documentation
* **[Upstream User Guide](../BETA.md)**: Simplified flow reference for scraping, voting, and the scheduler queue.
* **[Technical Scraper Lifecycle](../SCRAPER_LIFECYCLE.md)**: Technical overview of the pipeline's six sequential execution phases.
* **[SSO / OIDC Setup Guide](../SSO_DESIGN.md)**: Details on single sign-on authentication configuration.
* **[Database Schema Guide](../DATABASE.md)**: Overview of PostgreSQL tables, schemas, and backup targets.
