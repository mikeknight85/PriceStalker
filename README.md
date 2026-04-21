<p align="center">
  <img src="assets/header.svg" alt="PriceStalker" width="580">
</p>

<p align="center">
  <strong>We stalk prices so you don't have to.</strong><br>
  Self-hosted price tracking that watches product pages across the web and
  tells you when a price drops, hits your target, or an out-of-stock item
  comes back.
</p>

<p align="center">
  <a href="https://github.com/mikeknight85/PriceStalker/releases"><img alt="Version" src="https://img.shields.io/github/v/release/mikeknight85/PriceStalker?color=6366f1"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-10b981"></a>
  <a href="https://github.com/mikeknight85/PriceStalker/pkgs/container/pricestalker-backend"><img alt="GHCR" src="https://img.shields.io/badge/docker-ghcr.io-1f2937"></a>
</p>

---

## About this fork

PriceStalker is a friendly fork of
[clucraft/PriceGhost](https://github.com/clucraft/PriceGhost), which has been
inactive since early 2026. This fork carries forward the open community PRs,
adds more AI providers (**Groq**, **OpenRouter**), fixes the multi-currency
parser, tightens security defaults, and rebrands. Full credit to
[@clucraft](https://github.com/clucraft) for the original work — upstream
commits are preserved in this repo's history and the MIT license is intact.

**Already running PriceGhost?** See [Migrating from PriceGhost](#migrating-from-priceghost)
— you can attach this fork to your existing database and volume without
moving any data.

---

## You choose the price. Always.

Most price trackers silently pick a number off the page and hope for the best.
PriceStalker runs **four independent extraction methods** in parallel and lets
them vote:

| Method | How it works | Reliability |
|--------|--------------|-------------|
| **JSON-LD** | Reads `schema.org` structured data embedded by the retailer | Highest |
| **Site-specific** | Custom-tuned scrapers for Amazon, Best Buy, Walmart, Target, Costco, eBay, Newegg, Home Depot, AliExpress, Magento 2 | High |
| **Generic CSS** | Intelligent selectors that find price patterns on any site | Medium |
| **AI analysis** | Claude / GPT / Gemini / Groq / OpenRouter / Ollama analyzes the page context | High |

When methods agree, you're set. When they disagree, the **Price Selection
Modal** shows every candidate with confidence scores and context — you pick.
No more accidentally tracking:

- `Save $200` discount amounts instead of the actual price
- `$49/mo` financing plans instead of the real $1,999 price
- Bundle prices when you wanted the single item
- A "suggested retail" strike-through instead of the live price

---

## What's new in this fork

| Version | Highlights |
|---------|-----------|
| **1.1.2** | New logo (ghost with binoculars). `/version.json` caching hardened. |
| **1.1.1** | Fix version display stuck at 1.0.6 post-release. |
| **1.1.0** | Rebrand to PriceStalker. **Groq** and **OpenRouter** AI providers. Multi-currency parser fixes (BRL, Swiss apostrophe, EUR thousands-only). Base image bumped to Node 22 LTS. Default insecure port mappings removed. Migration path from upstream PriceGhost. |

Full history in [CHANGELOG.md](CHANGELOG.md).

---

## Features

### Multi-strategy price extraction
- Four independent extractors vote on the correct price
- Price Selection Modal with candidates, confidence scores, and context
- Puppeteer + stealth plugin for JavaScript-heavy sites (Best Buy, Target, Walmart)
- AI arbitration when methods disagree

### Price tracking
- Universal scraping across any e-commerce site (with AI fallback)
- AI price verification catches `$189 off` scraped as `$189`
- Interactive price history charts (7d / 30d / 90d / all time)
- 7-day sparklines on the dashboard
- Configurable check intervals (5 min to 24 h per product)
- Live countdown timers + progress bars to the next check

### Multi-currency (new in 1.1.0)
- USD, EUR, GBP, CHF, CAD, AUD, JPY, INR, BRL, PLN, SEK, NOK, DKK, KRW, RUB, CNY
- Currency-aware number parsing: `R$2.720,00` → 2720 BRL (not 2.72); `CHF 1'234.56` with Swiss apostrophe; `€1.234,56` with European thousands
- Display formatter centralised — notifications, charts, tables all speak the same currency

### Notifications
Telegram · Discord · Pushover · ntfy.sh (self-hosted supported) · Gotify · per-channel toggles · test buttons for every provider.

- **Price drop alerts** — set a CHF/USD/EUR threshold
- **Target price alerts** — get notified when a specific price is reached
- **Back-in-stock alerts** — know when out-of-stock items return

### Stock tracking
Automatic out-of-stock detection, visual badges, stock-change history timeline per product, notifications when items come back.

### User experience
PWA installable on mobile · dark/light/auto theme · responsive design · toast notifications · real-time countdowns · manual refresh · per-product pause.

### User management
Multi-user with per-user products and settings · admin panel · registration toggle · profile / password changes.

---

## AI providers

Six providers supported. AI extraction kicks in when standard scrapers fail;
AI verification catches bad extractions; AI arbitration breaks ties.

| Provider | Get a key | Recommended model | Cost |
|----------|-----------|-------------------|------|
| **Anthropic (Claude)** | [console.anthropic.com](https://console.anthropic.com) | Claude Haiku 4.5 ⭐ | ~$0.001 / check |
| **OpenAI (GPT)** | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-4.1 Nano | ~$0.001 / check |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini 2.5 Flash Lite | Free tier available |
| **Groq** | [console.groq.com](https://console.groq.com/keys) | Llama 3.3 70B Versatile | **Free tier** |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | `meta-llama/llama-3.1-8b-instruct:free` | **Free tier**, paid for premium models |
| **Ollama (local)** | [ollama.ai](https://ollama.ai) | `ollama pull qwen3` | **Free**, local compute |

Enable in **Settings → AI Extraction**. Start with AI Verification — it's the
highest-leverage single setting and catches the most embarrassing extraction
errors.

---

## Supported retailers

Site-specific scrapers (higher reliability than generic extraction):

Amazon (all locales) · Best Buy · Walmart · Target · Costco · eBay · Newegg · Home Depot · AliExpress · Any Magento 2 store

**Every other site** works via generic extraction + AI fallback. Tested
extensively with European retailers (digitec.ch, galaxus.de, mediamarkt.*,
etc.); they work via the AI path.

---

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/mikeknight85/PriceStalker.git
cd PriceStalker
cp .env.example .env              # optional; defaults are sensible for a fresh install
docker-compose up -d
```

Access at <http://localhost>. Create your first account, add a product URL, done.

### Migrating from PriceGhost

If you're running [clucraft/PriceGhost](https://github.com/clucraft/PriceGhost)
and want to switch without losing data, set these env vars in `.env`:

```env
POSTGRES_DB=priceghost
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/priceghost
POSTGRES_VOLUME_NAME=priceghost_postgres_data
```

Then swap your image references from `ghcr.io/clucraft/priceghost-*` to
`ghcr.io/mikeknight85/pricestalker-*`. The schema is forward-compatible —
missing columns (e.g. `groq_api_key`, `openrouter_api_key`) are added
automatically on first boot.

See [.env.example](.env.example) for all available overrides.

### Pinning to a specific version

`ghcr.io/mikeknight85/pricestalker-backend:latest` tracks main. Pin to a
specific release for stability:

```yaml
image: ghcr.io/mikeknight85/pricestalker-backend:1.1.2
image: ghcr.io/mikeknight85/pricestalker-frontend:1.1.2
```

Major.minor tags (e.g. `:1.1`) also auto-move to the latest patch in that line.

---

## Development setup

Requires Node.js 22+ and PostgreSQL 14+.

```bash
# Backend
cd backend
npm install
npm run db:init                   # initialize database schema
npm run dev                       # watch mode

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

---

## Configuration

### Notifications

<details><summary><b>Telegram</b></summary>

1. Create a bot via [@BotFather](https://t.me/botfather) on Telegram
2. Get your Chat ID from [@userinfobot](https://t.me/userinfobot)
3. Enter both in Settings → Notifications
</details>

<details><summary><b>Discord</b></summary>

1. Server Settings → Integrations → Webhooks → New Webhook
2. Copy the URL, paste it in Settings → Notifications
</details>

<details><summary><b>Pushover</b></summary>

1. Create an account at [pushover.net](https://pushover.net)
2. Note your User Key, create an application at [pushover.net/apps](https://pushover.net/apps/build) to get an API Token
3. Enter both in Settings → Notifications
</details>

<details><summary><b>ntfy.sh</b></summary>

1. Pick a unique topic (e.g. `pricestalker-yourname-abc123`)
2. Subscribe on your phone via the [ntfy app](https://ntfy.sh/app) or <https://ntfy.sh/your-topic-name>
3. Enter the topic in Settings → Notifications. Self-hosted ntfy is also supported — set the server URL + optional username/password.
</details>

<details><summary><b>Gotify (self-hosted)</b></summary>

1. Deploy [Gotify](https://gotify.net/docs/install)
2. Create an application in Gotify to get an App Token
3. Enter server URL + App Token in Settings → Notifications; use "Test Connection" before saving.
</details>

### AI

Any of the six providers listed above. Recommended bootstrap:

1. Start with **Groq** or **OpenRouter** — free tiers, no credit card to start
2. For production quality, **Claude Haiku 4.5** via Anthropic
3. For zero-cost + offline, **Ollama** with `qwen3` locally

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, Recharts |
| Backend | Node.js 22, Express, TypeScript |
| Database | PostgreSQL 16 |
| Scraping | Cheerio, Puppeteer (stealth plugin) |
| AI | Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, Ollama |
| Auth | JWT + bcrypt |
| Scheduling | node-cron |
| Deploy | Docker Compose / Docker Swarm |

---

## API reference

Base URL: `/api`. All endpoints require `Authorization: Bearer <jwt>` except `/auth/*`.

<details><summary><b>Authentication</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login, returns JWT |
| `GET` | `/auth/registration-status` | Check if registration is enabled |
</details>

<details><summary><b>Products</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List tracked products |
| `POST` | `/products` | Add product by URL |
| `GET` | `/products/:id` | Product details + stats |
| `PUT` | `/products/:id` | Update settings/notifications |
| `DELETE` | `/products/:id` | Stop tracking |
| `GET` | `/products/:id/prices` | Price history |
| `POST` | `/products/:id/refresh` | Force immediate check |
</details>

<details><summary><b>Settings</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`/`PUT` | `/settings/notifications` | Notification config |
| `POST` | `/settings/notifications/test/{telegram,discord,pushover,ntfy,gotify}` | Send a test notification |
| `POST` | `/settings/notifications/test-gotify` | Test Gotify connection before saving |
| `GET`/`PUT` | `/settings/ai` | AI extraction settings |
| `POST` | `/settings/ai/test` | Test AI extraction on a URL |
| `POST` | `/settings/ai/test-{ollama,gemini,groq,openrouter}` | Test a specific AI provider connection |
</details>

<details><summary><b>Profile & Admin</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`/`PUT` | `/profile` | Get / update user profile |
| `PUT` | `/profile/password` | Change password |
| `GET`/`POST` | `/admin/users` | List / create users (admin only) |
| `DELETE` | `/admin/users/:id` | Delete user |
| `PUT` | `/admin/users/:id/admin` | Toggle admin status |
| `GET`/`PUT` | `/admin/settings` | System settings |
</details>

---

## Project structure

```
PriceStalker/
├── backend/
│   └── src/
│       ├── config/         # Database connection, init
│       ├── middleware/     # JWT authentication
│       ├── models/         # Database queries
│       ├── routes/         # API endpoints
│       ├── services/       # Scraper, AI extractors, scheduler, notifications
│       └── utils/          # Currency-aware price parser
├── frontend/
│   └── src/
│       ├── api/            # Axios client + types
│       ├── components/     # Reusable UI (PriceSelectionModal, PriceChart, …)
│       ├── context/        # Auth & Toast contexts
│       └── pages/          # Route-level screens
├── database/
│   └── init.sql            # Schema + idempotent column migrations
├── .env.example            # Including the PriceGhost migration block
└── docker-compose.yml
```

---

## Rate limiting & retailer etiquette

Don't get banned:

- **Staggered checks** — products are scheduled with ±5 min jitter
- **Request delays** — 2–5 s random delay between different products
- **Reasonable intervals** — default 1 h; go longer if you track many items
- **Browser-like headers** — standard User-Agent strings, not a scraper fingerprint
- **UI warning** when intervals get aggressive (< 5 min)

---

## License

MIT — see [LICENSE](LICENSE). Original copyright to @clucraft (PriceGhost),
additional changes copyright to contributors to this fork.

---

## Star history

<a href="https://star-history.com/#mikeknight85/PriceStalker&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mikeknight85/PriceStalker&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mikeknight85/PriceStalker&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mikeknight85/PriceStalker&type=Date" />
  </picture>
</a>
