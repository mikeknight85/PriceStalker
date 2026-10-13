# PriceStalker Admin: System Settings

The **System** tab in the Admin Panel provides the core configurations for network connections, scraper browsers, product discovery, structured data, and security.

---

## 1. Network & Integration
* **Proxy URL/Port (`scraper_proxy`)**: Specify the HTTP/HTTPS proxy address used to route outgoing PDP requests (e.g. `http://user:pass@proxyhost:port`).
* **Browser Scraper URL (`remote_scraper_url`)**: Sets the address of your
  containerized stealth Puppeteer scraping service (`scraper`, e.g.
  `http://scraper:5100/scrape`). Retailers with **Use Browser Scraper**
  enabled are fetched through it. The stored setting key keeps its original
  name so existing configurations are unaffected.

---

## 2. Product Tracking
Configures default scheduled check behavior for tracked products across the instance:
* **Default Check Interval (`default_refresh_interval`)**: Sets the baseline interval (from 1 hour to 1 week; default: 12 hours) assigned to newly added products for any user account that has not set their own preference under **Settings → Tracking**. Products already being tracked retain their existing individual intervals.

---

## 3. Product Discovery (SearXNG)
PriceStalker integrates with SearXNG to search for products across search engine providers:
* **SearXNG API URL (`searxng_url`)**: Connection URL to your SearXNG instance. You can click the **Test** button next to it to verify connection health.
* **Enable Product Search (`searxng_enabled`)**: Switch toggle. If enabled, users can find products by search query directly in the *Add Product* modal instead of pasting URLs.
* **Search Result Ranking**: Search results are scored and ranked so that supported retailers and product pages appear above forum threads, video links, or articles, while retaining all results.
* **Quick-Track Action**: Users can click **Track** to immediately begin tracking a search result with default settings, or click **Configure** to customize intervals and alert thresholds.

---

## 4. Browser Configuration
Adjusts how the remote Puppeteer browser behaves when resolving anti-bot protections:
* **Default User-Agent (`default_user_agent`)**: The User-Agent string sent during standard HTTP calls.
* **Default Referrer (`default_referrer`)**: The referrer headers set on requests (default: `https://www.google.com/`).
* **Browser Timeout (`browser_timeout`)**: Time in milliseconds (e.g. `60000`) before a browser scrape attempt aborts.
* **Browser Delay (`browser_delay`)**: Time in milliseconds (e.g. `3000`) to wait after page load before taking the DOM screenshot and extracting the HTML (helps wait for lazy-loaded content).

*(Note: The **Prefer JSON-LD for Images** toggle lives under **Extraction Rules**, beside the global image selectors).*

---

## 5. Security & Access
* **Allow User Registration (`registration_enabled`)**: Toggles whether users can register a new account on the login page.
* **Allow Password Reset via Email (`password_reset_enabled`)**: Toggles whether users can request password-reset links via SMTP. Requires fallback SMTP to be configured.
* **Enable Admin Debug Page (`debug_page_enabled`)**: Toggle to enable or disable the diagnostic console page (`/debug`).
* **Disable Global Scheduler (`scheduler_disabled`)**: Circuit-breaker toggle. When enabled, pauses all automated background price checks instance-wide while still permitting manual scrapes.
* **Disable Auto Retailer Updates (`retailer_updates_disabled`)**: Prevents background heuristics and AI auto-mapping from persisting automatic modifications to retailer rules.

---

## 6. Maintenance
* **Refresh Database Cache**: Forces the backend to immediately invalidate its 30-minute `SettingsCache` and reload all system settings, selectors, and retailer configs from PostgreSQL without restarting the server.
* **Database Maintenance**: PriceStalker stores all configurations, historical prices, and credentials in PostgreSQL. To perform manual backups, review migrations, or look up schema layouts, see the database guide: [DATABASE.md](../developer/DATABASE.md).
