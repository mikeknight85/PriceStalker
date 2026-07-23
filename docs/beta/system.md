# PriceStalker Admin: System Settings

The **System** tab in the Admin Panel provides the core configurations for network connections, scraper browsers, product discovery, structured data, and security.

---

## 1. Network & Integration
* **Proxy URL/Port (`scraper_proxy`)**: Specify the HTTP/HTTPS proxy address used to route outgoing PDP requests (e.g. `http://user:pass@proxyhost:port`).
* **Remote Scraper URL (`remote_scraper_url`)**: Sets the address of your containerized stealth Puppeteer scraping service (`remotescraper`, e.g. `http://remotescraper:5100/scrape`).

---

## 2. Product Discovery (SearXNG)
PriceStalker integrates with SearXNG to search for products across search engine providers:
* **SearXNG API URL (`searxng_url`)**: Connection URL to your SearXNG instance. You can click the **Test** button next to it to verify connection health.
* **Enable Product Search (`searxng_enabled`)**: Switch toggle. If enabled, users can find products by search query directly in the *Add Product* modal instead of pasting URLs.

---

## 3. Browser Configuration
Adjusts how the remote Puppeteer browser behaves when resolving anti-bot protections:
* **Default User-Agent (`default_user_agent`)**: The User-Agent string sent during standard HTTP calls.
* **Default Referrer (`default_referrer`)**: The referrer headers set on requests (default: `https://www.google.com/`).
* **Browser Timeout (`browser_timeout`)**: Time in milliseconds (e.g. `60000`) before a browser scrape attempt aborts.
* **Browser Delay (`browser_delay`)**: Time in milliseconds (e.g. `3000`) to wait after page load before taking the DOM screenshot and extracting the HTML (helps wait for lazy-loaded content).

---

## 4. JSON-LD & Structured Data
* **Prefer JSON-LD for Images (`prefer_jsonld_image`)**: Switch toggle. If enabled, PriceStalker prioritizes structural search schema images over custom selectors, resulting in cleaner, standardized images.

---

## 5. Security & Access
* **Allow User Registration (`registration_enabled`)**: Toggles whether users can register a new account on the login page.
* **Enable Public Debug Page (`debug_page_enabled`)**: Toggle to enable or disable the public diagnostic console page (`/debug`).

---

## 6. Database Maintenance
PriceStalker stores all configurations, historical prices, and credentials in a PostgreSQL database.
* To perform manual backups, review migrations, or look up schema layouts, see the database guide: [DATABASE.md](../DATABASE.md).
