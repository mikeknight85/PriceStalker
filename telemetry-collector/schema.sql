-- D1 Schema for PriceStalker Telemetry Service
-- Database: pricestalker-telemetry (ID: bcb93d6a-47da-476c-972d-b9f534aca91c)

CREATE TABLE IF NOT EXISTS instances (
  instance_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version TEXT NOT NULL,
  build_commit TEXT,
  os_platform TEXT,
  os_arch TEXT,
  node_version TEXT,
  is_docker INTEGER DEFAULT 0,
  country TEXT,
  features_json TEXT,
  items_bucket TEXT,
  stores_bucket TEXT,
  users_bucket TEXT,
  ping_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_instances_last_seen ON instances(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_instances_version ON instances(version);

CREATE TABLE IF NOT EXISTS daily_rollups (
  date DATE PRIMARY KEY,
  active_instances INTEGER DEFAULT 0,
  new_instances INTEGER DEFAULT 0,
  docker_percentage REAL DEFAULT 0,
  top_versions_json TEXT,
  top_countries_json TEXT
);
