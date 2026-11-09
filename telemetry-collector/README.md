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

1. **Worker Never Logs or Stores IP Addresses:**
   - The worker code never reads, stores, logs, or forwards client IP addresses (`CF-Connecting-IP`).
   - What Cloudflare's own edge infrastructure and platform logging (`wrangler.jsonc` observability) retains is governed by the Cloudflare account configuration and edge privacy settings.
   - Geographical data is limited to a 2-letter ISO country code derived strictly from Cloudflare's edge metadata (`request.cf.country` or `cf-ipcountry`).
2. **No URLs, Domains, or User Data:**
   - No retailer URLs, store domain names, product titles, prices, user names, or credentials are accepted or stored.
3. **Coarse Aggregations Only:**
   - Item, store, and user counts are transmitted only as coarse buckets (`0`, `1-10`, `11-50`, `51-200`, `200+` for items/stores; `1`, `2-5`, `6+` for users) to prevent installation fingerprinting.
4. **Retention & Opportunistic Pruning:**
   - Records are upserted by anonymous `instance_id`.
   - Each ping refreshes `last_seen_at` and the latest configuration flags. An active instance pinging regularly retains its record and its original `first_seen_at` timestamp indefinitely.
   - **Pruning:** Pruning runs probabilistically on ingest (`Math.random() < 0.05` inside `handlePing`). Any instance that has not sent a ping for more than **180 days** based on `last_seen_at` is automatically pruned (`DELETE FROM instances WHERE last_seen_at < datetime('now', '-180 days')`).
5. **Payload Sanity & Abuse Protection:**
   - Enforces a 16 KB maximum payload size (`413 Payload Too Large`), safely inspected on chunked or buffered requests.
   - Requires a valid RFC-4122 UUID for `instance_id` (`400 Invalid or missing instance_id UUID`).
   - Validates `version`, `build_commit`, and platform identifiers against strict regex character allowlists before database insertion.
   - Escapes labels during HTML serialization to eliminate stored script execution risks.

---

## Endpoints

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/health` | Service health status | Public |
| `GET` | `/v1/stats` | JSON summary of 7d/30d active instances, version adoption, platforms, and countries | Public (cached 30m) |
| `GET` | `/dashboard` | HTML visualization dashboard of aggregate metrics | Public (cached 60s) |
| `POST` | `/v1/ping` | Ingests daily anonymous telemetry payload | Public (edge WAF / rate limiting configurable on apex zone) |

---

## Database Schema

The D1 database schema is defined in [`schema.sql`](schema.sql):

- **`instances`:** Tracks distinct instance installations, latest version, OS platform/arch, Docker status, country, sanitized feature flags, coarse buckets, and `first_seen_at` / `last_seen_at` timestamps.
- **`daily_rollups`:** Reserved for future scheduled daily aggregate snapshots (currently unused).

To apply or inspect schema in production:
```bash
npx wrangler d1 execute pricestalker-telemetry --file=schema.sql
```

---

## Deployment & Edge Gateway Architecture

### Edge Gateway Architecture (`GATEWAY_SECRET`)
`GATEWAY_SECRET` is an optional edge protection mechanism to ensure that incoming telemetry pings route through the canonical apex domain with its security, DDoS, and WAF rules:
- PriceStalker backends send standard HTTP POST requests with only `Content-Type` and `User-Agent` (they do not hold or send secrets).
- When deploying behind a custom domain (e.g. `ps-telemetry.enuff.com`), a Cloudflare **Request Header Transform Rule** on the custom domain injects `x-telemetry-gateway-secret: <GATEWAY_SECRET>`.
- If an attacker attempts to ping the fallback `*.workers.dev` URL directly, the worker detects the missing secret and rejects the request with HTTP 403.
- If deploying to a standard domain without a Transform Rule, leave `GATEWAY_SECRET` unset; the worker functions as an open public endpoint.

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
Secrets must never be committed to Git. If using a gateway secret, configure it via Wrangler:
```bash
npx wrangler secret put GATEWAY_SECRET
```
