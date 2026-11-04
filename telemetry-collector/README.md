# PriceStalker Telemetry Collector

Privacy-preserving telemetry ingestion service for PriceStalker installations, running on Cloudflare Workers and Cloudflare D1.

## Architecture

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (Serverless SQLite)
- **Public Stats / Ingestion Endpoint:** `https://ps-telemetry.enuff.com` (also deployable to `*.workers.dev` or any custom domain)

```
PriceStalker Instances (Daily Ping)
             │
             ▼
Cloudflare Edge Worker (/v1/ping)
   ├── Discard IP / connection headers
   ├── Extract 2-letter country (request.cf.country)
   ├── Validate UUID format and payload boundaries
   └── Upsert into D1 Database (instances table)
             │
             ▼
Cloudflare D1 Database (SQLite)
   └── Prunes stale records (> 180 days inactive)
```

---

## Privacy & Data Retention Guarantees

The collector is designed so that privacy claims are verifiable directly from the source code (`src/index.ts`):

1. **IP Addresses Discarded at Edge:**
   - The worker never logs, stores, or forwards client IP addresses (`CF-Connecting-IP`).
   - Geographical data is limited to a 2-letter ISO country code derived strictly from Cloudflare's edge metadata (`request.cf.country` or `cf-ipcountry`).
2. **No URLs, Domains, or User Data:**
   - No retailer URLs, store domain names, product titles, prices, user names, or credentials are accepted or stored.
3. **Coarse Aggregations Only:**
   - Item, store, and user counts are transmitted only as coarse buckets (`0`, `1-10`, `11-50`, `51-200`, `200+` for items/stores; `1`, `2-5`, `6+` for users) to prevent installation fingerprinting.
4. **Retention Policy:**
   - Records are upserted by anonymous `instance_id`.
   - Each ping refreshes `last_seen_at` and the latest configuration flags.
   - **Automated Pruning:** Any instance that has not sent a ping for more than **180 days** is automatically deleted from D1 (`DELETE FROM instances WHERE last_seen_at < datetime('now', '-180 days')`).
5. **Payload Sanity & Abuse Protection:**
   - Enforces a 16 KB maximum payload size (`413 Payload Too Large`).
   - Requires a valid RFC-4122 UUID for `instance_id` (`400 Invalid or missing instance_id UUID`).
   - Bounds all text fields to defensive maximum lengths.

---

## Endpoints

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/health` | Service health status | Public |
| `GET` | `/v1/stats` | JSON summary of 7d/30d active instances, version adoption, platforms, and countries | Public (cached 30m) |
| `GET` | `/dashboard` | HTML visualization dashboard of aggregate metrics | Public (cached 60s) |
| `POST` | `/v1/ping` | Ingests daily anonymous telemetry payload | Public (rate-limited by Cloudflare) |

---

## Database Schema

The D1 database schema is defined in [`schema.sql`](schema.sql):

- **`instances`:** Tracks distinct instance installations, latest version, OS platform/arch, Docker status, country, sanitized feature flags, coarse buckets, and `first_seen_at` / `last_seen_at` timestamps.
- **`daily_rollups`:** Historical daily aggregate snapshots.

To apply or inspect schema in production:
```bash
npx wrangler d1 execute pricestalker-telemetry --file=schema.sql
```

---

## Deployment & Configuration

### Prerequisites
- Node.js 18+ and `npm`
- Cloudflare account with Workers and D1 enabled

### Local Development
```bash
cd telemetry-collector
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

### Production Deployment
```bash
cd telemetry-collector
npm run deploy
```

### Managing Secrets
Secrets must never be committed to Git. For production deployments with edge reverse proxies or gateways, configure secrets securely via Wrangler:
```bash
npx wrangler secret put GATEWAY_SECRET
```
