# Changelog

All notable changes to PriceStalker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-beta.1] - 2026-07-21

2.0 rebuilds the application on a heavily-reworked branch of the same upstream,
contributed by a collaborator, keeping the PriceStalker name, identity layer and
release engineering. It is a breaking release: **the schema migrates
automatically on first boot and there is no down path.** Back up your database
before upgrading.

### Upgrading

- Schema migrations now run at backend startup. The server waits for the
  database, applies what is pending, and only then listens. A first boot on a
  large database takes noticeably longer.
- Products, price history and stock history carry over unchanged.
- `notification_history` is converted into the new in-app notification model and
  then dropped. Notifications you had already cleared arrive read; the rest
  arrive unread. Original payloads are preserved in each notification's `data`
  column.
- Each user's preferred currency is derived from the currency they have recorded
  most often, rather than defaulting every install to one value.
- Per-user AI credentials are not migrated. AI is configured centrally in 2.0;
  an admin re-enters the key once under Admin -> AI Engine.
- `users.password_hash` becomes nullable so SSO accounts, which have no
  password, are representable.
- `POSTGRES_PASSWORD` and `JWT_SECRET` are now required. The stack refuses to
  start without them instead of falling back to a built-in default.

### Added

- Rebuilt scraping engine: acquisition, transport and extraction are separate
  stages, with consensus arbitration between extractors and DOM denoising.
- Per-retailer configuration UI (Admin -> Retailers): selector sets, stock
  phrase lists, JSON-LD key mapping, custom user-agent and referrer, engine
  choice, retailer status history, and a visual selector picker.
- Optional remote scraper service: a stealth browser in its own container with
  a pooled, recycled Chromium instance, for sites that block ordinary scraping.
  Off by default (`docker compose --profile remotescraper up -d`).
- Live currency conversion with daily FX rates and a per-user preferred
  currency.
- Product categories with sidebar filtering, dashboard tabs, pagination and
  sorting.
- Multiple price types per product: standard, deal, member and pre-order.
- Email/SMTP notification channel, and customisable message templates per
  channel.
- Product search by name via SearXNG.
- Persisted system logs with an admin viewer, and system API tokens for
  machine access.
- Database health monitoring with optional SMTP alerting.
- Admin -> Authentication panel for OIDC/SSO, including a discovery test that
  validates an issuer URL before saving it.
- AI providers: Google Vertex AI, DeepSeek and Mistral.
- Backend and remote scraper images now run as an unprivileged user.

### Changed

- AI configuration moved from per-user to instance-wide, managed by an admin.
- SSO settings moved from Settings to Admin -> Authentication.
- Container images are now built entirely in CI from a clean checkout. They
  previously required a locally pre-built `dist/` to be copied in.
- `docker-compose.yaml` pulls published images instead of building locally, no
  longer publishes PostgreSQL to the host, and uses a named volume.

### Fixed

- Unversioned assets (`icon.svg`, `manifest.json`, `sw.js`) were served with
  `Cache-Control: immutable` and a one-year expiry. Because their paths never
  change, a new logo or service worker could not reach anyone who had already
  loaded the site. They now revalidate.
- `Cache-Control` was sent twice on every static response.
- SSO accounts could reach the password-login path, where a null password hash
  produced a confusing failure instead of a clear "use SSO" message. The same
  applied to changing a password.
- Disabled users were rejected on local login but not on SSO.

### Removed

- OpenRouter AI provider. Use Groq, which also has a free tier, or stay on
  1.4.x.
- The daily GitHub update check and its in-app banner. `DISABLE_UPDATE_CHECK`
  currently has no effect.
- Per-product currency override and the "notify on any price change" option.
- Demo mode.

### Known issues

- The OIDC sign-in flow has been exercised up to the provider redirect, but a
  full token exchange against a live provider has not been verified in this
  release.
- Migrations have been tested against a 1.4.x database. Older 1.x schemas
  should converge, since 1.x reapplies its own migrations at every boot, but
  this is untested.

## [1.4.0] - 2026-06-29

### Added

- **Edit a price watcher's selection after creation** (#21). New "Edit
  Price Selection" button on the product detail page re-scrapes the page
  and reopens the price picker, so you can correct a wrong price (e.g. a
  bad CSS match) without deleting the watcher or losing its price
  history. The corrected price is recorded as a new point.

### Fixed

- **Broken product images from relative URLs** (#22). Image URLs returned
  as site-relative paths (e.g. `/i/abc123`) are now resolved to absolute
  URLs against the source page, so they render correctly. Existing broken
  images self-heal on the next price check.

## [1.3.1] - 2026-06-05

### Documentation

- README "What's new" table caught up to the 1.3.x line (was stale at
  1.1.x).
- New Notifications → Custom Webhook config section with the full
  placeholder reference table.
- Notifications feature blurb now mentions the Custom Webhook provider
  and the any-change alert added in 1.2.8.

No code changes — pure docs/version-bump release so `:latest` users on
prod see the most recent README on the GitHub release page.

## [1.3.0] - 2026-06-05

### Added

- **Configurable generic webhook notification provider** (#4). New
  "Custom Webhook" provider alongside the existing 5 (Telegram,
  Discord, Pushover, ntfy, Gotify). Configure URL, method (GET / POST
  / PUT / PATCH / DELETE), optional headers (JSON object), and a body
  template with placeholders — `{title}`, `{type}`, `{url}`,
  `{currency}`, `{price}`, `{new_price}`, `{old_price}`, `{threshold}`,
  `{target_price}`, `{timestamp}`. Routes notifications to anything
  that speaks HTTP: Apprise, Home Assistant, n8n, Zapier, custom
  backends.
- **Beta channel** (`:beta` Docker tag). Tracks every merge to `main`.
  `:latest` now only updates on tagged releases. Demo / staging stacks
  pin to `:beta` for auto-rolling pre-release deployments; prod stacks
  stay on `:latest` until the next tag.
- **BETA pill** next to the running-version display in Settings when
  the image was built from `main`. Makes pre-release deployments
  visually distinguishable from prod without checking the image tag.
- **Themed textareas** — global form-group CSS now styles textareas
  the same as inputs (was missing the selector, every textarea fell
  through to browser defaults). Plus a `.code-input` modifier class
  for monospace JSON/code-shaped fields.

### Fixed

- **Webhook save/test feedback uses toast** instead of the top-of-page
  alert bar. The webhook form sits at the bottom of a long Settings
  page; feedback was previously invisible to anyone scrolled there.
- **Product card alert badges respect product currency.** Price-drop
  and target-price badges in the dashboard's product card hardcoded a
  `$` prefix and ignored the product's actual currency. Now use the
  same `formatPrice` helper as the displayed price next to them.

## [1.2.11] - 2026-06-02

### Fixed

- **Wrong product images on SPA pages with recommendation widgets**
  (digitec.ch, etc.). `scrapeProductWithVoting` read JSON-LD for price
  and stock but ignored the `image` field, so the cascade fell to the
  generic image scan which picked the first matching element — often
  a recommendation card on React-rendered pages, not the actual hero
  image. The stored URL pointed at a *different product's* image.
  Same class of bug as the JSON-LD stock-signal drop fixed in v1.2.6.
  The voting path now applies the type-aware JSON-LD `Product.image`
  whenever the page exposes it.
- **Stored bogus image URLs were permanent.** The image self-heal added
  in v1.2.9/1.2.10 only triggered when `image_url` was NULL, so once
  a bad URL was in the DB it stayed forever. Self-heal now also fires
  when the scrape returns a different non-null URL — broken products
  recover on their next check or the next manual refresh.

## [1.2.10] - 2026-06-02

### Fixed

- **Manual "Refresh Price now" now also backfills missing `image_url`.**
  Parity with the scheduler's image self-heal added in v1.2.9 — the
  manual refresh route was a separate code path that wasn't updated.
  Clicking refresh on a product missing a picture now rescues it
  immediately instead of waiting up to a full refresh interval.

## [1.2.9] - 2026-06-02

### Fixed

- **Missing product images that never recovered.** `image_url` was
  only written at create-time, so a first-scrape miss became permanent
  even when later scrapes would have succeeded. JS-heavy SPAs
  (digitec.ch via Puppeteer) hit this when render timing varied.
  Scheduler now backfills `image_url` whenever the current value is
  null and the scrape produced one — existing broken products
  self-heal on their next scheduled check.
- **Lazy-load attribute coverage.** `extractGenericImage` now also
  reads `data-original`, `data-lazy`, `data-lazy-src`, `data-srcset`
  and `srcset` (picking the first URL out of srcset descriptor lists).
  Reduces first-scrape misses on lazy-loaded image elements.

## [1.2.8] - 2026-06-01

### Added

- **In-app update notification.** The backend queries the GitHub
  releases API once a day. When a newer PriceStalker release is
  available, logged-in users see a dismissible banner with a link to
  the release notes. Dismissals are per-version (localStorage), so
  a future release re-surfaces it. No telemetry — the only outbound
  request is a single HTTPS GET to api.github.com from the backend
  (never from the user's browser), with `User-Agent: PriceStalker/<v>`.
  Opt-out entirely with `DISABLE_UPDATE_CHECK=true`.

## [1.2.7] - 2026-06-01

### Fixed

- **Wrong currency in the price-selection modal** on stores that emit
  canonical schema.org markup (`<meta itemprop="price" content="X">`
  plus `<meta itemprop="priceCurrency" content="EUR">`). The generic
  CSS candidate extractor read the numeric `content` attribute, found
  no symbol, and `parsePrice()` defaulted to USD — so the modal
  preview showed `$` even on EUR/GBP/etc. stores. The post-confirm
  scrape used a different code path that did find the symbol, so the
  saved row was correct, but the modal was misleading. The extractor
  now falls back to the companion `[itemprop="priceCurrency"]`, then
  OpenGraph `product:price:currency` / `og:price:currency`, before
  accepting the USD default.

## [1.2.6] - 2026-06-01

### Fixed

- **Shopify restock detection** (#2) — three compounding bugs made the
  voting scraper mislabel in-stock Shopify products as out-of-stock and
  hide the (correctly extracted) price for any OOS product:
  - `scrapeProductWithVoting` silently dropped JSON-LD's
    `offers.availability` signal because it called the price-only
    candidate extractor but not the full extractor that reads stock.
  - The generic CSS detector matched Shopify Dawn-family themes' hidden
    `.price__badge-sold-out` element on in-stock products (Dawn renders
    both badge states in the DOM and toggles visibility via CSS rules
    Cheerio can't evaluate).
  - The UI suppressed the price entirely when stock was OOS, leaving
    affected users looking at an empty card and concluding detection
    itself was broken.
- **Wrong currency on generic CSS extractions** (#6) — the generic
  scraper defaults to USD when it can't detect a symbol or code in the
  text. Added a per-product currency override that wins across writes,
  notifications and SELECTs (via `COALESCE`), so users can correct it
  without waiting for a code fix.

### Added

- **Shopify-aware extraction.** New scraper path that detects a Shopify
  storefront by its `cdn.shopify.com` / `Shopify.theme` signature and
  fetches `/products/<handle>.js` for canonical per-variant `available`
  and price. Bypasses theme/localization variation entirely and covers
  the full Shopify long tail, not just the reported store.
- **Localised in-stock phrases** in the generic stock detector
  (Dutch / German / French / Spanish / Italian / Portuguese), so
  non-English Shopify pages produce a positive in-stock signal instead
  of falling through to OOS by default.
- **"Notify on any price change" toggle** per product (#5). When
  enabled, the scheduler fires a `price_change` notification on every
  movement ≥ 0.01 in either direction, replacing the threshold-based
  drop notification while it's on (no double-firing). Implemented for
  Telegram, Discord (green/red embed by direction), Pushover, ntfy
  (up/down trend tags) and Gotify.
- **`notify_back_in_stock` accepted on `POST /products`** and defaulted
  to `true` when adding an OOS product — the typical reason someone
  tracks something unbuyable is to know when it returns.
- **Price now shown alongside the OOS badge** on the product card and
  detail page (no more "Price unavailable" hiding the last-known price).
- **"Detected via: <method> (<context>)" hint** under the price on the
  product detail page (#6). Generic CSS surfaces the actual selector
  that matched, so wrong-currency / wrong-price calls are diagnosable.
- **GitHub Actions runner bump** to Node 24-compatible majors
  (`actions/checkout` v6, `dorny/paths-filter` v4, `docker/*` v4/v6/v7),
  ahead of the June 2026 deprecation.

## [1.2.5] - 2026-04-27

### Fixed

- **Puppeteer "Failed to launch the browser process"** — the `nodejs`
  user in the backend image was created with `useradd -r` (no `-m`),
  leaving `$HOME` unset at runtime. Chromium's crash handler
  (`chrome_crashpad_handler`) derives its `--database` path from
  `$HOME` / `$XDG_CONFIG_HOME`, so it crashed on launch with
  `--database is required`, breaking the browser-fallback branch of
  the voting scraper. Static-HTML sites (Amazon JSON-LD, Digitec
  JSON-LD, etc.) were unaffected because they never reach Puppeteer.
  Fix: create a real home directory for the `nodejs` user and set
  `HOME=/home/nodejs`.

### Added

- **`DEMO_MODE` env flag** that disables identity-mutating profile
  operations. With `DEMO_MODE=true`, `PUT /api/profile` and
  `PUT /api/profile/password` return 403. Useful for any deployment
  where the operator wants to keep a shared or test account stable —
  public demos, multi-tenant sandboxes, QA environments. Per-user-scoped
  operations stay open (adding products, configuring your own AI
  provider, configuring your own notification webhooks). Off by default;
  existing deployments see no change.

## [1.2.4] - 2026-04-22

### Fixed

- **"Failed to load product details" transient error on the product page**
  — same class of race that `Dashboard.fetchProducts` got a retry for in
  v1.1.3. Opening a product could occasionally render the error banner
  and require a manual refresh. `ProductDetail.fetchData` now retries
  once after 500ms, and the real error is logged to `console.error` for
  easier diagnosis if it recurs.

## [1.2.3] - 2026-04-21

### Changed

- **Multi-arch Docker images (amd64 + arm64)** — CI now publishes
  `ghcr.io/mikeknight85/pricestalker-{backend,frontend}` as manifest lists
  covering both `linux/amd64` and `linux/arm64`. Docker clients pick the
  right variant automatically; no change for existing x86 deployments.
  Unlocks native runs on Apple Silicon, Raspberry Pi, AWS Graviton, etc.
  Merged from upstream [clucraft/PriceGhost#34](https://github.com/clucraft/PriceGhost/pull/34)
  by [@soile1991](https://github.com/soile1991).

## [1.2.2] - 2026-04-21

### Changed

- **Biggest Drops (7d) dashboard card items are now clickable** — each entry
  navigates to its product detail page. Same UX principle as the main product
  cards got in 1.2.1: the card is the link, not just a named button.

## [1.2.1] - 2026-04-21

### Changed

- **Clickable product image and name on the dashboard** — both now
  navigate to the product details page, matching the behavior of the
  "View" button. Hover cursor + subtle highlight on the name signal
  they're interactive. The View button is kept for discoverability.

## [1.2.0] - 2026-04-21

### Added

- **Single Sign-On via OIDC (BETA)** — PriceStalker can now act as an OIDC
  Relying Party against any compliant provider (Authentik, Keycloak,
  Google, Okta, Auth0, …) using the Authorization Code + PKCE flow. Full
  design doc at [`docs/SSO_DESIGN.md`](docs/SSO_DESIGN.md).

  **Feature-flagged off by default** — set `ENABLE_SSO=true` on the
  backend + configure a provider in Settings → Authentication before any
  user-visible change. Existing deployments upgrading from 1.1.x see no
  difference until they opt in.

  **Admin policy options** (Settings → Authentication):
  - `local` — current behavior, OIDC UI hidden
  - `both` — local form + "Sign in with X" button, user picks
  - `oidc` — SSO-only with auto-redirect; break-glass admin fallback via
    `/login?local=1` so a misconfigured IdP can never lock you out

  **Admin toggles**:
  - JIT provisioning — auto-create PriceStalker accounts from first OIDC
    sign-in (default on)
  - Require verified email — enforce `email_verified=true` in ID token or
    userinfo (default on; admins running self-hosted IdPs like Authentik
    can disable it so they don't have to customize their scope mappings)
  - Test discovery — one-click validation of an issuer URL before saving

  **Identity resolution**: matches by stable `(oidc_issuer, oidc_subject)`
  first, falls back to email-linking against existing local accounts, JIT-
  creates if neither matches. First user in the DB is auto-promoted to
  admin (same rule as local registration).

  **Known limitation** (BETA): logging out of the IdP does not log you
  out of PriceStalker. Single Logout (SLO) is on the v1.3.0 roadmap. Use
  PriceStalker's own logout button for now.

### Changed

- Refactored `adminMiddleware` from `routes/admin.ts` into its own
  `middleware/admin.ts` so it can be reused by the new admin-auth routes.
- `users.password_hash` is now nullable (OIDC-provisioned users never had
  one). Attempting to change a password on an SSO account returns a
  clear error directing you to your IdP instead.

## [1.1.3] - 2026-04-21

### Fixed

- **"Failed to load products" banner right after login** — the Dashboard's
  initial product fetch occasionally raced with React committing the auth
  state update, causing a failed request that a page refresh would then
  succeed on. `fetchProducts` now retries once after 500 ms, which
  reliably catches the race. The real error is also logged to
  `console.error` so any remaining case can be diagnosed from the
  browser console.

## [1.1.2] - 2026-04-21

### Changed

- **New logo** — ghost with binoculars. Replaces the upstream price-tag-wielding
  ghost. Each lens has a tiny `$` inside, keeping the price-tracking metaphor
  but putting the stalker identity front and center. Affects
  `frontend/public/icon.svg` (PWA/favicon/navbar) and `assets/header.svg`
  (README wordmark).

### Fixed

- **Harden /version.json against browser/SW caching** so a release is visible
  on a normal reload instead of needing a hard-refresh or SW unregister:
  - `frontend/src/pages/Settings.tsx` fetch now uses `{cache: 'no-store'}`
    and a cache-busting timestamp query.
  - `frontend/nginx.conf` serves `/version.json` with explicit
    `Cache-Control: no-store, no-cache, must-revalidate` headers.

## [1.1.1] - 2026-04-21

### Fixed

- **Version display in UI** stuck at `v1.0.6` after the 1.1.0 release. Two
  `version.json` files existed in the repo: the one at repo root (unused)
  was bumped, the one actually read at runtime
  (`frontend/public/version.json`) was not. The unused root file has been
  removed; `frontend/public/version.json` is now the single source of truth
  for the UI-displayed version.

## [1.1.0] - 2026-04-20

First PriceStalker release — a friendly fork of
[clucraft/PriceGhost](https://github.com/clucraft/PriceGhost) (upstream last
released 1.0.6 on 2026-01-26, now inactive). Rebranded, picks up pending
upstream PRs, adds new AI providers, improves multi-currency handling, and
tightens default security.

### Added

- **OpenRouter AI provider** — aggregator access to hundreds of models (free
  tier included) via one API key. Freeform model ID, defaults to
  `meta-llama/llama-3.1-8b-instruct:free`. Full support for extraction,
  verification, stock status, and arbitration. Closes upstream #23.
- **Groq AI provider** — merged from upstream [PR #27](https://github.com/clucraft/PriceGhost/pull/27)
  by @f-liva. Supports Llama 3.3 70B, Llama 3.1 8B Instant, Mixtral 8x7B,
  Gemma 2 9B. Closes upstream #26.
- **Migration path from clucraft/PriceGhost** — env-overridable
  `docker-compose.yml` (`POSTGRES_DB`, `DATABASE_URL`, `POSTGRES_VOLUME_NAME`,
  `FRONTEND_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`). Existing users can
  attach to their `priceghost` database and volume without data movement.
  See `.env.example` for the override block.
- **LICENSE file** (MIT) with attribution to the original author (clucraft)
  and the fork (Michael Kessler). Upstream declared MIT in README only.

### Changed

- **Rebranded** from PriceGhost to PriceStalker across UI, docker
  identifiers, package names, and assets.
- **Base images** bumped from Node 20 to Node 22 LTS (fewer CVEs in base
  layers, addresses part of upstream #31). Postgres stays on 16 to avoid
  forcing `pg_upgrade` on existing volumes.
- **Multi-currency parser** (`backend/src/utils/priceParser.ts`):
  - Fixes the bug reported in upstream #24 where Brazilian Real format
    `R$2.720,00` was parsed as `$2.72`.
  - Added BRL (R$), PLN (zł), KRW (₩), RUB (₽), SEK, NOK, DKK, CNY
    recognition.
  - Swiss apostrophe thousands separator (`CHF 1'234.56`) is now handled.
  - Number-format detection is currency-aware: `2.720` is 2720 for
    comma-decimal currencies (EUR/BRL/PLN/…), 2.72 for others.
- **Frontend price formatting** consolidated into
  `frontend/src/utils/formatPrice.ts`. Replaced six duplicate implementations
  across ProductCard, PriceChart, PriceSelectionModal, ProductDetail,
  NotificationBell (which previously fell back to `$` for CHF), and
  NotificationHistory.

### Fixed

- **Product-name truncation** for rows where the scraper returns titles
  longer than 255 characters. Prevents Postgres `VARCHAR(255)` overflow on
  insert. Merged from upstream [PR #18](https://github.com/clucraft/PriceGhost/pull/18)
  by @ericdaugherty, closes upstream #17.

### Security

- **Removed default host port mappings** for postgres (5432) and backend
  (3001). Nginx in the frontend container proxies `/api` internally via
  docker networking, so there's no reason to expose these to the host.
  Closes upstream #20.

## [1.0.6] - 2026-01-26

### Added

- **Google Gemini AI Support** - New AI provider option alongside Anthropic, OpenAI, and Ollama
  - Supported models: Gemini 2.5 Flash Lite (default), Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3 Flash Preview
  - Test API key button to verify connection before saving
  - Full support for AI extraction, verification, stock status checking, and price arbitration
  - Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
- **Self-Hosted ntfy Support** - Use your own ntfy server instead of ntfy.sh
  - Server URL field (defaults to ntfy.sh if left blank)
  - Optional username/password authentication for protected servers
  - Auth fields only shown when a custom server URL is entered

---

## [1.0.5] - 2026-01-25

### Added

- **AI Model Selector** - Choose your preferred AI model in settings
  - Anthropic: Claude Haiku 4.5, Sonnet 4.5, Opus 4.5
  - OpenAI: GPT-4.1 Nano, Mini, and Full
  - Ollama: Any locally installed model
- **Per-Product AI Controls** - Disable AI extraction and/or verification on individual products
  - Useful for products where AI interferes with manual price selection
  - Separate toggles for extraction (fallback) and verification
- **Gotify Notification Support** - Self-hosted push notifications via Gotify
  - Test connection before saving to verify server URL and app token
  - Full notification support for price drops, target prices, and stock changes
- **AI Stock Status Verification** - Separate AI call to verify stock status for variant products
  - When tracking a specific variant price, AI now verifies if that exact variant is in stock
  - Fixes false "in stock" status when other variants are available but tracked variant is not
- **Pause/Resume Checking** - Temporarily pause price checking on individual products or in bulk
  - Pause and Resume actions in the bulk Actions menu
  - Filter dropdown to show All / Active / Paused products
  - Paused products are greyed out with pause icon indicator
  - Scheduler automatically skips paused products

### Fixed

- **Ollama Thinking Mode** - Fixed Qwen3 and DeepSeek models outputting `<think>` tags instead of JSON
  - Added `/nothink` message before prompts to disable thinking mode
  - Added `num_ctx: 16384` for proper context window (was truncating HTML at 4K)
  - Added fallback to strip `<think>` tags from responses
- **AI Stock Status "Unknown"** - AI now correctly returns "out_of_stock" for pre-order/coming soon products
  - Previously returned "unknown" even when reasoning stated product was unavailable
  - Prompt now explicitly requires "out_of_stock" when product cannot be purchased

### Changed

- **Recommended AI Models** - Based on testing:
  - **Cloud**: Claude Haiku 4.5 (best accuracy for the cost)
  - **Local/Free**: Qwen3 (any size, with thinking mode disabled)

---

## [1.0.4] - 2026-01-24

### Added

- **Multi-Strategy Price Voting System** - More robust price extraction using multiple methods
  - Runs all extraction methods (JSON-LD, site-specific, generic CSS, AI) in parallel
  - Uses consensus voting to select the correct price when methods agree
  - AI arbitration when extraction methods disagree
  - User price selection dialog when price is ambiguous (multiple prices found)
  - Remembers the winning extraction method for future checks of the same product
- **Price Selection Modal** - When multiple prices are found for a product, users can now select the correct one
  - Shows all price candidates with confidence levels
  - Displays extraction method and context for each candidate
  - Sorted by confidence (highest first)

### Changed

- **Improved scheduler** - Now uses preferred extraction method when available for faster, more accurate re-checks

---

## [1.0.3] - 2026-01-24

### Added

- **Notification History** - Complete log of all triggered notifications accessible via bell icon in navbar
  - Bell icon with badge showing recent notification count (last 24 hours)
  - Dropdown preview showing 5 most recent notifications
  - Full history page at `/notifications` with filtering by type
  - Tracks price drops, target price alerts, and back-in-stock notifications
  - Shows which channels (Telegram, Discord, Pushover, ntfy) received each notification
  - Links to product detail pages from notification entries
  - **Clear button** to dismiss notifications from dropdown without deleting history
- **Particle background effect** - Subtle animated particles floating behind all content
  - Theme-aware: white particles on dark mode, indigo on light mode
  - Multiple layers with varying speeds for depth effect
- **Star History chart** in README to track repository stars over time

### Fixed

- **Notification crash with string prices** - Fixed TypeError when notification prices were returned as strings from PostgreSQL

### Changed

- **Settings page layout** - Moved version info, changelog, and GitHub links to sidebar under navigation

---

## [1.0.2] - 2026-01-23

### Fixed

- **Stock status false positives** - Fixed overly aggressive pre-order detection that incorrectly marked in-stock items as out of stock. Pages with "in stock", "add to cart", or "add to basket" text now correctly prioritize these indicators
- **Magento 2 stock detection** - Added proper stock status detection for Magento 2 sites, checking for stock classes and add-to-cart buttons

---

## [1.0.1] - 2026-01-23

### Added

- **Puppeteer fallback for JavaScript-rendered prices** - Automatically uses headless browser when no price found in static HTML, fixing extraction for Magento, React, Vue, and other JS-heavy sites
- **Pre-order/coming soon detection** - Products with future release dates, pre-order buttons, or "notify me" messaging are now correctly marked as out of stock
- **AI availability verification** - AI now checks if products are actually purchasable, not just if the price is correct
- **Official PriceStalker branding** - Custom ghost icon in navbar and login page
- **Ghostly text effect** - "Ghost" text in navbar has ethereal fade effect

### Fixed

- **Fresh install registration error** - Backend now creates all required database tables on startup, fixing 500 errors on fresh Docker installs without init.sql
- **Stock status for unreleased products** - Products showing "Coming Soon", "Available [future date]", or "Pre-order" are now correctly detected as out of stock

### Changed

- **CI/CD optimization** - Docker images only rebuild when relevant code changes (backend/** or frontend/**), not for README or documentation updates

---

## [1.0.0] - 2026-01-23

### Added

#### Core Features
- Universal price scraping with site-specific extractors for Amazon, Walmart, Best Buy, Target, eBay, Newegg, Home Depot, Costco, and AliExpress
- JSON-LD structured data extraction for broad site compatibility
- Puppeteer headless browser fallback with stealth plugin for JavaScript-rendered pages
- Price history tracking with interactive charts (7d, 30d, 90d, all time)
- 7-day sparkline graphs on dashboard for quick trend overview
- Configurable check intervals (5 minutes to 24 hours)
- Live countdown timers and progress bars showing time until next check
- Staggered checking with jitter to prevent rate limiting

#### AI Features
- AI-powered price extraction fallback (Anthropic Claude, OpenAI GPT, Ollama local)
- AI price verification to catch scraping errors (e.g., scraping savings amounts instead of actual prices)
- AI status badges showing verification status (✓ verified, ⚡ corrected)

#### Notifications
- Telegram bot notifications
- Discord webhook notifications
- Pushover push notifications
- ntfy.sh notifications (no account required)
- Price drop alerts with configurable thresholds
- Target price alerts
- Back-in-stock alerts
- Per-channel enable/disable toggles
- Test notification buttons for each channel

#### Stock Tracking
- Out-of-stock detection with visual indicators
- Stock status history tracking
- Stock timeline visualization
- Back-in-stock notification alerts

#### User Interface
- Dark/Light mode with system theme auto-detection
- Responsive design for desktop and mobile
- Toast notifications for user feedback
- Dashboard with list layout, search, and sorting
- Bulk actions (select multiple products, bulk delete)
- Historical low price indicators
- Product notification badges showing configured alerts

#### User Management
- Multi-user support with JWT authentication
- Admin panel for user management
- Registration enable/disable control
- Profile management (name, password)
- Password visibility toggle for sensitive fields

#### PWA & Mobile
- Progressive Web App support
- Add to Home Screen capability
- Service worker for offline caching
- Custom ghost icon

#### Currency Support
- USD, EUR, GBP, CHF, CAD, AUD, JPY, INR support
- Automatic currency detection from scraped pages

#### Deployment
- Docker and Docker Compose support
- GitHub Container Registry images
- GitHub Actions CI/CD workflow

### Security
- JWT-based authentication
- bcrypt password hashing
- Input validation throughout
- Secure API design

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.6 | 2026-01-26 | Google Gemini AI support, self-hosted ntfy support |
| 1.0.5 | 2026-01-25 | AI model selector, per-product AI controls, Gotify support, Ollama fixes |
| 1.0.4 | 2026-01-24 | Multi-strategy price voting system with user selection for ambiguous prices |
| 1.0.3 | 2026-01-24 | Notification history with bell icon, clear button, and full history page |
| 1.0.2 | 2026-01-23 | Fixed stock status false positives for in-stock items |
| 1.0.1 | 2026-01-23 | Bug fixes, JS-rendered price support, pre-order detection |
| 1.0.0 | 2026-01-23 | Initial public release |
