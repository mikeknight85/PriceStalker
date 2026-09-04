# PriceStalker Database Documentation

> **Provenance:** adapted from the upstream engine docs (shared scraper core). Infra specifics removed; logic matches this repo. Verify against code — docs can drift.


This document describes the PostgreSQL database schema, core entity tables, trigger-based cache synchronization, and backup/migration procedures used in PriceStalker.

---

## Schema Overview

PriceStalker uses **PostgreSQL** as its absolute source of truth. All domain configuration (retailer selectors, regex patterns, anti-bot rules) and application states (product lists, price history, notification templates) are stored here.

```mermaid
erDiagram
 users ||--o{ products : tracks
 users ||--o{ user_memberships : has
 products ||--o{ price_history : logs
 products ||--o{ stock_status_history : logs
 products ||--o{ notification_history : triggers
 retailer_configs ||--|| user_memberships : resolves
```

---

## Core Tables

### 1. `users`
Stores user profile information, authentication hashes, locale/currency settings, and integration details for notification providers.
* **Key Fields**:
 - `email` (unique) & `password_hash`
 - `is_admin`: Grants access to backend administrative endpoints.
 - `disabled`: Boolean flag to disable access without deleting the account.
 - `last_active` & `created_at`: Timestamps tracking user activity and registration.
 - `currency` & `locale` are optional display preferences. A null locale uses
   the browser format and a null currency leaves prices in the retailer's
   original currency.
 - **Notification Integrations**: Stores activation state, webhook tokens, and customizable templates for `telegram`, `discord`, `pushover`, `ntfy`, `gotify`, `webhook`, and `email`.
 - *(Note: AI provider settings and API keys are stored instance-wide in `system_settings`, not in `users`)*.

### 2. `products`
The central registry of tracked items across all users.
* **Key Fields**:
 - `url` & `name`
 - `refresh_interval`: Frequency (seconds) for scheduled checks.
 - `stock_status`: Current availability (`in_stock`, `out_of_stock`, `pre_order`, `member_only`, `not_available`, `unknown`).
 - `unavailable_reason`: Specific explanation when a page cannot be reached (e.g. `404/410`, `Bot wall`, `Timeout`).
 - `consecutive_unavailable_count`: Consecutive count of failed scrapes used for de-bouncing before marking unavailable.
 - `paused_by`: Tracks whether monitoring was paused by `user` or `system`.
 - `price_drop_threshold` & `target_price`: Alert targets.
 - `preferred_extraction_method`: Stores the winning consensus extraction type.
 - `anchor_price`: Benchmark price used to detect anomalous consensus pricing drift.
 - `needs_price_review`: Boolean flag indicating manual verification required.

### 3. `retailer_configs`
Houses the extraction selectors and custom routing rules. **Strictly no retailer logic is hardcoded in backend services.**
* **Key Fields**:
 - `domain` (unique primary lookup key, e.g. `amazon.com.au`).
 - `use_browser_scraper`: Offloads page rendering to the `scraper` service.
 - `currency_hint`: Default fallback currency for parser.
 - **JSONB Arrays**: Standardized selectors for `name_selectors`, `retailer_name_selectors`, `price_selectors`, `deal_price_selectors`, `member_price_selectors`, `pre_order_price_selectors`, `original_price_selectors`, `image_selectors`, `stock_selectors`, `exclusion_selectors`.
 - `in_stock_phrases`, `out_of_stock_phrases`, `pre_order_phrases`, `member_only_phrases`: Evaluated availability phrases.
 - `prefer_jsonld_image`: Tri-state override for JSON-LD images (`true`, `false`, `null` to inherit global).
 - `user_agent` & `referrer`: Request header overrides.

### 4. `price_history`
Chronological record of price checks, used to render sparkline charts and historical drop graphs.
* **Key Fields**:
 - `product_id` (foreign key with cascade delete).
 - `price` & `currency`
 - `price_type`: Tracks extraction categories (`standard`, `deal`, `member`, `pre_order`).

### 5. `stock_status_history`
Chronological record of availability changes, used to render the 30-day stock status timeline.
* **Key Fields**:
 - `product_id` (foreign key with cascade delete).
 - `status`: E.g. `in_stock`, `out_of_stock`, `pre_order`.

### 6. `notifications`
Stores generated alert records and delivery status.
* **Key Fields**:
 - `user_id` & `product_id`.
 - `type` / `event_type`: Event type (`price_drop`, `target_price`, `back_in_stock`, `price_announced`, `unavailable`, `resumed`).
 - `title`, `message`, `data` (structured event payload), `is_read`.

### 7. `system_settings`
Global instance configuration managed via Admin.
* **Key Fields**:
 - `key` (primary key, e.g. `ai_provider`, `remote_scraper_url`, `generic_*` selectors).
 - `value`: Stored setting or JSON string.

### 8. `system_api_tokens`
API access tokens for machine authorization.
* **Key Fields**:
 - `token`: Hashed bearer token (prefixed with `ps_`).
 - `user_id`: Owning user account.

### 9. `password_reset_tokens`
Short-lived tokens for self-service password reset.
* **Key Fields**:
 - `token_hash`, `user_id`, `expires_at`, `used_at`.

### 10. `system_logs`
Structured event log storage for system and scrape tracing.
* **Key Fields**:
 - `level` (`info`, `warn`, `error`, `debug`), `context`, `message`, `details` (JSONB), `created_at`.

---

## Trigger-Based Cache Invalidation

To maintain database performance under heavy scraping loads, the backend maintains system settings and retailer selectors in memory (`SettingsCache` and `RetailerConfigCache`).

To prevent cache staleness when settings are edited in the Admin Portal:
1. PostgreSQL triggers are installed on `system_settings` and `retailer_configs` tables.
2. Upon any `INSERT`, `UPDATE`, or `DELETE` operation, a trigger function runs and fires a `pg_notify` event:
 ```sql
 NOTIFY settings_update;
 ```
3. The backend listens for this channel and instantly clears the local caching layer (`settingsCache.clear()`), ensuring real-time UI changes propagate to the background scraper without restarts.

---

## Operations

### 1. Migrations
Migrations are stored under `backend/src/migrations/` and run sequentially using the Umzug migrations runner.
* **Run Migrations (Production)**:
 ```bash
 pnpm --filter pricestalker-backend run db:migrate
 ```
* **Run Migrations (Development)**:
 ```bash
 pnpm --filter pricestalker-backend run db:migrate:dev
 ```

### 2. Database Backup

Take a backup before any production deploy — migrations are one-way. On the
Swarm host:

```bash
docker exec $(docker ps -q -f name=pricestalker_postgres) \
 pg_dump -U postgres --no-owner --no-privileges priceghost | gzip > backup.sql.gz
```

See `deploy/swarm-stack.yml` for the production stack.
