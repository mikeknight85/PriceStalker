# PriceStalker Admin: System Settings

This document covers proxy management, background cron tasks, and scraping circuit breakers.

---

## 1. Proxy Management
To avoid IP bans and scraping blocks, configure proxies under the Admin Dashboard:

* **Format**: Support standard proxy patterns:
  `http://username:password@proxy-host:port`
* **Rotation**: Ensure proxies are rotated regularly to minimize detection on sensitive PDP (Product Detail Page) domains.

---

## 2. Background Scheduler (Cron)
Scrapes are processed at regular intervals in the background:

* **Frequency**: Default interval check is every 12 hours (configurable per product or globally).
* **Cron Jobs**: Run at 4 AM local time for exchange rate updates and scheduler synchronization.
* **Monitoring**: If a product has been paused due to a persistent 404 error, you can resume tracking under the products database grid.

---

## 3. Circuit Breakers
If a store is offline or is actively blocking connections, PriceStalker's circuit breaker triggers a cooldown period:
* **Failure Count**: If a domain accumulates too many sequential connection issues, it goes into a backoff state.
* **Manual Reset**: To unblock a store, clear the block flags in the store's Retailer Settings.

---

## 4. Database Maintenance
PriceStalker stores all configurations, historical prices, and credentials in a PostgreSQL database.
* To perform manual backups, review migrations, or look up schema layouts, see the database guide: [DATABASE.md](../DATABASE.md).

