import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
-- PriceGhost Database Schema
-- Synchronized with live database on vodka (2026-05-02)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  telegram_bot_token VARCHAR(255),
  telegram_chat_id VARCHAR(255),
  telegram_enabled BOOLEAN DEFAULT true,
  telegram_message_template TEXT,
  discord_webhook_url TEXT,
  discord_enabled BOOLEAN DEFAULT true,
  discord_message_template TEXT,
  pushover_user_key TEXT,
  pushover_app_token TEXT,
  pushover_enabled BOOLEAN DEFAULT true,
  pushover_message_template TEXT,
  ntfy_topic TEXT,
  ntfy_server_url TEXT,
  ntfy_username TEXT,
  ntfy_password TEXT,
  ntfy_enabled BOOLEAN DEFAULT true,
  ntfy_message_template TEXT,
  gotify_url TEXT,
  gotify_app_token TEXT,
  gotify_enabled BOOLEAN DEFAULT true,
  gotify_message_template TEXT,
  webhook_url TEXT,
  webhook_headers TEXT,
  webhook_payload_template TEXT,
  webhook_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  email_from TEXT,
  email_to TEXT,
  email_subject_template TEXT,
  email_body_template TEXT,
  ai_enabled BOOLEAN DEFAULT false,
  ai_verification_enabled BOOLEAN DEFAULT false,
  ai_provider VARCHAR(20),
  anthropic_api_key TEXT,
  anthropic_model TEXT,
  openai_api_key TEXT,
  openai_model TEXT,
  ollama_base_url TEXT,
  ollama_model TEXT,
  gemini_api_key TEXT,
  gemini_model TEXT,
  currency VARCHAR(10) DEFAULT 'AUD',
  locale VARCHAR(10) DEFAULT 'en-AU',
  preferred_currency VARCHAR(10) DEFAULT 'AUD',
  categories JSONB DEFAULT '[]'::jsonb,
  notifications_cleared_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global Currencies (ported from PriceBuddy)
CREATE TABLE IF NOT EXISTS global_currencies (
  id SERIAL PRIMARY KEY,
  country_territory TEXT,
  currency_name TEXT,
  iso VARCHAR(10) NOT NULL,
  symbol TEXT,
  locale VARCHAR(10) NOT NULL,
  separation VARCHAR(10),
  position VARCHAR(10)
);

-- Exchange Rates for conversion
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate NUMERIC(20,10) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_currency, to_currency)
);

-- Index for locale/iso lookups
CREATE INDEX IF NOT EXISTS idx_global_currencies_locale ON global_currencies(locale);
CREATE INDEX IF NOT EXISTS idx_global_currencies_iso ON global_currencies(iso);

-- Default system settings
INSERT INTO system_settings (key, value) VALUES
('registration_enabled', 'true'),
('debug_page_enabled', 'true'),
('scheduler_disabled', 'false'),
('retailer_updates_disabled', 'false'),
('generic_pre_order_price_selectors', '[]'),
('generic_in_stock_phrases', '["in stock", "instock", "add to cart", "add to basket", "buy now", "available now", "add to trolley", "clearance", "on sale", "special offer", "limited stock", "available", "ready to ship"]'),
('generic_out_of_stock_phrases', '["out of stock", "sold out", "currently unavailable", "not available", "backorder", "back-order", "notify me when available", "coming soon"]'),
('generic_pre_order_phrases', '["pre-order", "preorder", "available starting", "expected to ship", "release date", "pre-ordering"]')
ON CONFLICT (key) DO NOTHING;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  image_url TEXT,
  refresh_interval INTEGER DEFAULT 3600,
  last_checked TIMESTAMP,
  next_check_at TIMESTAMP,
  stock_status VARCHAR(20) DEFAULT 'unknown',
  price_drop_threshold NUMERIC(10,2),
  target_price NUMERIC(10,2),
  notify_back_in_stock BOOLEAN DEFAULT false,
  ai_verification_disabled BOOLEAN DEFAULT false,
  ai_extraction_disabled BOOLEAN DEFAULT false,
  checking_paused BOOLEAN DEFAULT false,
  preferred_extraction_method VARCHAR(20),
  anchor_price NUMERIC(10,2),
  needs_price_review BOOLEAN DEFAULT false,
  price_candidates JSONB,
  ai_status VARCHAR(20),
  price_type VARCHAR(20) DEFAULT 'standard',
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, url)
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  ai_status VARCHAR(20),
  price_type VARCHAR(20) DEFAULT 'standard',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User memberships for retailers
CREATE TABLE IF NOT EXISTS user_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retailer_domain TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, retailer_domain)
);

-- Index for faster price history queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_date
ON price_history(product_id, recorded_at);

-- Stock status history table
CREATE TABLE IF NOT EXISTS stock_status_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retailer Configuration table
CREATE TABLE IF NOT EXISTS retailer_configs (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  status VARCHAR(50) DEFAULT 'OK',
  use_proxy BOOLEAN DEFAULT false,
  use_browser BOOLEAN DEFAULT false,
  use_remote_scraper BOOLEAN DEFAULT false,
  is_js_heavy BOOLEAN DEFAULT false,
  currency_hint VARCHAR(10),
  name_selectors JSONB DEFAULT '[]'::jsonB,
  retailer_name_selectors JSONB DEFAULT '[]'::jsonB,
  price_selectors JSONB DEFAULT '[]'::jsonB,
  deal_price_selectors JSONB DEFAULT '[]'::jsonB,
  member_price_selectors JSONB DEFAULT '[]'::jsonB,
  image_selectors JSONB DEFAULT '[]'::jsonB,
  stock_selectors JSONB DEFAULT '[]'::jsonB,
  price_regex JSONB DEFAULT '[]'::jsonB,
  name_regex JSONB DEFAULT '[]'::jsonB,
  image_regex JSONB DEFAULT '[]'::jsonB,
  in_stock_phrases JSONB DEFAULT '[]'::jsonB,
  out_of_stock_phrases JSONB DEFAULT '[]'::jsonB,
  pre_order_phrases JSONB DEFAULT '[]'::jsonB,
  pre_order_price_selectors JSONB DEFAULT '[]'::jsonB,
  member_only_phrases JSONB DEFAULT '[]'::jsonB,
  user_agent TEXT,
  referrer TEXT,
  custom_selectors JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Regional Currency Mappings
CREATE TABLE IF NOT EXISTS regional_currency_mappings (
  id SERIAL PRIMARY KEY,
  pattern VARCHAR(255) UNIQUE NOT NULL,
  currency VARCHAR(10) NOT NULL,
  match_type VARCHAR(10) NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Notification History table
CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  currency TEXT,
  price_change_percent NUMERIC(5,2),
  target_price NUMERIC(10,2),
  old_stock_status TEXT,
  new_stock_status TEXT,
  channels_notified JSONB,
  product_name TEXT,
  product_url TEXT
);

-- Indexes for notification history
CREATE INDEX IF NOT EXISTS idx_notification_history_product ON notification_history(product_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_date ON notification_history(user_id, triggered_at DESC);

-- System Logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL,
  context VARCHAR(50),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for log searching
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_context ON system_logs(context);
    `);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  console.log("Down migration for initial schema is a no-op to protect data.");
};
