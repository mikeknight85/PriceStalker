---
title: PriceStalker — Self-hosted price tracker
description: Open-source, self-hosted price tracking with multi-currency alerts, stock monitoring, retailer selectors, AI-assisted extraction, and Docker deployment.
---

# PriceStalker

## Open-source, self-hosted price tracking

PriceStalker monitors product pages across retailers and alerts you when a
price drops, reaches your target, or an out-of-stock product becomes available
again. It is designed for people who want to run their own price tracker with
Docker, PostgreSQL, and configurable scraping rules.

## Highlights

- Multi-retailer price tracking with price history.
- Multi-currency display and live conversion for user preferences.
- Stock, pre-order, member-only, and unavailable-product monitoring.
- Retailer-specific CSS, XPath, regex, stock-phrase, and JSON-LD selectors.
- Consensus price selection with a review flow when extraction is uncertain.
- Optional AI-assisted extraction, arbitration, and verification.
- Email, Telegram, Discord, Pushover, ntfy, Gotify, and webhook notifications.
- Optional stealth browser scraping for JavaScript-heavy or protected sites.
- Docker deployment with PostgreSQL persistence.

## Get started

- [README and installation](https://github.com/mikeknight85/PriceStalker#readme)
- [User guide](user/README.md)
- [Administration guide](admin/README.md)
- [Developer documentation](developer/DEVELOPER_GUIDE.md)
- [Scraper lifecycle](developer/SCRAPER_LIFECYCLE.md)
- [GitHub repository](https://github.com/mikeknight85/PriceStalker)

PriceStalker is a modern fork and v2 rebuild of
[PriceGhost](https://github.com/clucraft/PriceGhost), retaining the upstream
MIT licence and crediting the original project.
