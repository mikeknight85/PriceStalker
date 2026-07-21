-- PriceStalker v2 data migration
-- Moves data from the v1 schema (this repo) into the v2 schema (Steven's fork).
--
-- STATUS: verified end-to-end against a real production snapshot
--         (2 users / 21 products / 10,364 price_history / 145 stock / 29 notifications).
--         Row counts, sum(price), and product-URL checksums all matched; zero FK orphans;
--         sequence collision test passed.
--
-- SHAPE:  this is the SIDE-BY-SIDE variant. It reads a v1 database restored into
--         schema `old` and writes into a freshly-created v2 schema in the same database.
--         It is NOT the in-place upgrade path used by existing installs -- see README.md.
--
-- Usage:
--   createdb newapp
--   psql -d newapp -f <v2 schema>            -- create v2 tables
--   psql -d newapp -c 'CREATE SCHEMA old;'
--   gunzip -c v1-dump.sql.gz | sed -e 's/public\./old./g' \
--     -e 's/^SET search_path.*/SET search_path = old;/' | psql -d newapp
--   psql -d newapp -f migrate.sql

\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------
-- 0. Schema pre-adjustments (become umzug migrations in the real port)
-- ---------------------------------------------------------------

-- 0a. REQUIRED. v1 SSO users have NULL password_hash; v2 declares the column
--     NOT NULL. Without this the INSERT below aborts on any OIDC user.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 0b. Re-add v1 SSO columns (feature ported forward; v2 has no OIDC support).
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_subject TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_issuer TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_cleared_at TIMESTAMP;

-- 0c. Re-add v1-only product columns (features ported forward).
ALTER TABLE products ADD COLUMN IF NOT EXISTS notify_any_change BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency_override VARCHAR(3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS extraction_context TEXT;

-- ---------------------------------------------------------------
-- 1. users  (IDs preserved -- products.user_id FK depends on them)
-- ---------------------------------------------------------------
-- v2 introduces per-user currency/locale, defaulting to AUD/en-AU upstream.
-- Rather than impose that on every install, derive each user's currency from the
-- currency they have actually recorded most often, falling back to USD.
WITH user_currency AS (
  SELECT DISTINCT ON (p.user_id)
         p.user_id, h.currency
  FROM old.products p
  JOIN old.price_history h ON h.product_id = p.id
  WHERE h.currency IS NOT NULL
  GROUP BY p.user_id, h.currency
  ORDER BY p.user_id, count(*) DESC, h.currency
)
INSERT INTO users (
  id, email, password_hash, name, is_admin, created_at,
  telegram_bot_token, telegram_chat_id, telegram_enabled,
  discord_webhook_url, discord_enabled,
  pushover_user_key, pushover_app_token, pushover_enabled,
  ntfy_topic, ntfy_server_url, ntfy_username, ntfy_password, ntfy_enabled,
  gotify_url, gotify_app_token, gotify_enabled,
  webhook_url, webhook_headers, webhook_payload_template, webhook_enabled,
  auth_provider, oidc_subject, oidc_issuer, notifications_cleared_at,
  currency, locale, preferred_currency, categories, disabled
)
SELECT
  o.id, o.email, o.password_hash, o.name, o.is_admin, o.created_at,
  o.telegram_bot_token, o.telegram_chat_id, o.telegram_enabled,
  o.discord_webhook_url, o.discord_enabled,
  o.pushover_user_key, o.pushover_app_token, o.pushover_enabled,
  o.ntfy_topic, o.ntfy_server_url, o.ntfy_username, o.ntfy_password, o.ntfy_enabled,
  o.gotify_url, o.gotify_app_token, o.gotify_enabled,
  -- NOTE: v1 webhook_method is DROPPED -- v2's webhook sender is POST-only.
  o.webhook_url, o.webhook_headers, o.webhook_body_template, o.webhook_enabled,
  COALESCE(o.auth_provider, 'local'), o.oidc_subject, o.oidc_issuer, o.notifications_cleared_at,
  COALESCE(uc.currency, 'USD'), NULL, COALESCE(uc.currency, 'USD'), '[]'::jsonb, false
FROM old.users o
LEFT JOIN user_currency uc ON uc.user_id = o.id;

-- NOTE: v1 per-user AI credentials (anthropic/openai/gemini/groq/openrouter/ollama
-- keys + models, ai_enabled, ai_provider, ai_verification_enabled) have NO target.
-- v2 centralises AI config globally in system_settings, admin-only. These are
-- deliberately NOT migrated; an admin re-enters them once post-upgrade.

-- ---------------------------------------------------------------
-- 2. products
-- ---------------------------------------------------------------
INSERT INTO products (
  id, user_id, url, name, image_url, refresh_interval,
  last_checked, next_check_at, stock_status,
  price_drop_threshold, target_price, notify_back_in_stock, created_at,
  preferred_extraction_method, needs_price_review, price_candidates,
  anchor_price, ai_verification_disabled, ai_extraction_disabled, checking_paused,
  notify_any_change, currency_override, extraction_context,
  category, price_type, is_primary
)
SELECT
  o.id, o.user_id, o.url, o.name, o.image_url, o.refresh_interval,
  o.last_checked, o.next_check_at, o.stock_status,
  o.price_drop_threshold, o.target_price, o.notify_back_in_stock, o.created_at,
  o.preferred_extraction_method, o.needs_price_review, o.price_candidates,
  o.anchor_price, o.ai_verification_disabled, o.ai_extraction_disabled, o.checking_paused,
  o.notify_any_change, o.currency_override, o.extraction_context,
  NULL, 'standard', false            -- v2-only columns take upstream defaults
FROM old.products o;

-- NOTE: v1 refresh_interval defaults to 3600, v2 to 43200. Existing rows keep
-- their own value; only newly-added products pick up the 12h default.

-- ---------------------------------------------------------------
-- 3. price_history  (v1 columns are a strict subset of v2)
-- ---------------------------------------------------------------
INSERT INTO price_history (id, product_id, price, currency, recorded_at, price_type, details)
SELECT o.id, o.product_id, o.price, o.currency, o.recorded_at, 'standard', NULL
FROM old.price_history o;

-- ---------------------------------------------------------------
-- 4. stock_status_history  (identical shape in both schemas)
-- ---------------------------------------------------------------
INSERT INTO stock_status_history (id, product_id, status, changed_at)
SELECT o.id, o.product_id, o.status, o.changed_at
FROM old.stock_status_history o;

-- ---------------------------------------------------------------
-- 5. notification_history -> notifications
--    Reshape: v1 alert log -> v2 in-app notification bell.
-- ---------------------------------------------------------------
INSERT INTO notifications (user_id, type, title, message, is_read, created_at, data)
SELECT
  o.user_id,
  o.notification_type,
  COALESCE(o.product_name, 'Product'),
  CASE o.notification_type
    WHEN 'price_drop'   THEN 'Price dropped from '||o.old_price||' to '||o.new_price||' '||COALESCE(o.currency,'')
    WHEN 'price_target' THEN 'Target price '||o.target_price||' reached ('||o.new_price||' '||COALESCE(o.currency,'')||')'
    WHEN 'stock_change' THEN 'Stock changed: '||COALESCE(o.old_stock_status,'?')||' -> '||COALESCE(o.new_stock_status,'?')
    ELSE 'Notification'
  END,
  true,                               -- historical alerts arrive already-read
  o.triggered_at,
  jsonb_strip_nulls(jsonb_build_object(
    'product_id', o.product_id, 'product_url', o.product_url,
    'old_price', o.old_price, 'new_price', o.new_price, 'currency', o.currency,
    'price_change_percent', o.price_change_percent, 'target_price', o.target_price,
    'old_stock_status', o.old_stock_status, 'new_stock_status', o.new_stock_status,
    'channels_notified', o.channels_notified
  ))
FROM old.notification_history o;

-- ---------------------------------------------------------------
-- 6. Sequences
--    REQUIRED. Rows are copied with explicit IDs, so every sequence is still at 1
--    and the first new insert collides. Note that MAX(id) far exceeds COUNT(*)
--    where rows have been deleted (verified: 21 products but MAX(id)=45).
-- ---------------------------------------------------------------
SELECT setval('users_id_seq',                (SELECT COALESCE(MAX(id),1) FROM users),                true);
SELECT setval('products_id_seq',             (SELECT COALESCE(MAX(id),1) FROM products),             true);
SELECT setval('price_history_id_seq',        (SELECT COALESCE(MAX(id),1) FROM price_history),        true);
SELECT setval('stock_status_history_id_seq', (SELECT COALESCE(MAX(id),1) FROM stock_status_history), true);
SELECT setval('notifications_id_seq',        (SELECT COALESCE(MAX(id),1) FROM notifications),        true);

COMMIT;
