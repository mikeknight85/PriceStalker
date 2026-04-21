-- PriceStalker Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  telegram_bot_token VARCHAR(255),
  telegram_chat_id VARCHAR(255),
  discord_webhook_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default system settings
INSERT INTO system_settings (key, value) VALUES ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Migration: Add notification columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'telegram_bot_token'
  ) THEN
    ALTER TABLE users ADD COLUMN telegram_bot_token VARCHAR(255);
    ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(255);
    ALTER TABLE users ADD COLUMN discord_webhook_url TEXT;
  END IF;
END $$;

-- Migration: Add profile columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(255);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false;
    -- Make the first user an admin
    UPDATE users SET is_admin = true WHERE id = (SELECT MIN(id) FROM users);
  END IF;
END $$;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name VARCHAR(255),
  image_url TEXT,
  refresh_interval INTEGER DEFAULT 3600,
  last_checked TIMESTAMP,
  next_check_at TIMESTAMP,
  stock_status VARCHAR(20) DEFAULT 'unknown',
  price_drop_threshold DECIMAL(10,2),
  target_price DECIMAL(10,2),
  notify_back_in_stock BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, url)
);

-- Migration: Add stock_status column if it doesn't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stock_status'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_status VARCHAR(20) DEFAULT 'unknown';
  END IF;
END $$;

-- Migration: Add notification columns to products if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'price_drop_threshold'
  ) THEN
    ALTER TABLE products ADD COLUMN price_drop_threshold DECIMAL(10,2);
    ALTER TABLE products ADD COLUMN notify_back_in_stock BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Migration: Add next_check_at column for staggered checking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'next_check_at'
  ) THEN
    ALTER TABLE products ADD COLUMN next_check_at TIMESTAMP;
  END IF;
END $$;

-- Migration: Add target_price column for price alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'target_price'
  ) THEN
    ALTER TABLE products ADD COLUMN target_price DECIMAL(10,2);
  END IF;
END $$;

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add Groq AI columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'groq_api_key'
  ) THEN
    ALTER TABLE users ADD COLUMN groq_api_key VARCHAR(255);
    ALTER TABLE users ADD COLUMN groq_model VARCHAR(255);
  END IF;
END $$;

-- Migration: Add OpenRouter AI columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'openrouter_api_key'
  ) THEN
    ALTER TABLE users ADD COLUMN openrouter_api_key VARCHAR(255);
    ALTER TABLE users ADD COLUMN openrouter_model VARCHAR(255);
  END IF;
END $$;

-- Migration: SSO / OIDC support (v1.2.0)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
    ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oidc_subject') THEN
    ALTER TABLE users ADD COLUMN oidc_subject TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oidc_issuer') THEN
    ALTER TABLE users ADD COLUMN oidc_issuer TEXT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_hash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_sub_idx
  ON users(oidc_issuer, oidc_subject)
  WHERE oidc_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  policy VARCHAR(20) NOT NULL DEFAULT 'local',
  oidc_enabled BOOLEAN NOT NULL DEFAULT false,
  oidc_provider_name TEXT,
  oidc_issuer_url TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT,
  oidc_scopes TEXT NOT NULL DEFAULT 'openid profile email',
  oidc_jit_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auth_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Index for faster price history queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_date
ON price_history(product_id, recorded_at);
