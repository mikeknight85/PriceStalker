# PriceStalker Environment Variables

This document outlines the environment variables used to configure PriceStalker deployments. These variables are typically defined inside your `.env` file or passed directly to Docker Compose.

---

## Required Configuration

These parameters must be configured for the stack to start successfully. The application will refuse to boot with placeholder values.

| Variable | Description | Example / Default |
|:---|:---|:---|
| `POSTGRES_PASSWORD` | Password for the PostgreSQL database connection. | `a-strong-secure-password` |
| `JWT_SECRET` | Secret key used to sign JSON Web Tokens (JWT) for user sessions. Changing this key will log out all active users. Generate using: `openssl rand -base64 48` | `replace-with-a-long-random-string` |

---

## Database Configuration

Used to customize the database connection and volume persistence.

| Variable | Description | Default |
|:---|:---|:---|
| `POSTGRES_DB` | Name of the PostgreSQL database. Defaults to `priceghost` to maintain compatibility for upgrades from earlier versions. | `priceghost` |
| `POSTGRES_USER` | Username for the database administrator account. | `postgres` |
| `POSTGRES_VOLUME_NAME` | The named Docker volume used to store database files. | `pricestalker_postgres_data` |

---

## General Configuration

| Variable | Description | Default |
|:---|:---|:---|
| `FRONTEND_PORT` | The host machine port exposed to access the PriceStalker Web UI. | `80` |
| `IMAGE_REGISTRY` | Docker image registry URL. | `ghcr.io` |
| `IMAGE_NAMESPACE` | GitHub container namespace or owner. | `mikeknight85` |
| `IMAGE_TAG` | Image release tag. Use `stable` (or `latest`) for versioned releases, `beta` for the pre-release channel tracking `main`, or pin an immutable version tag (e.g. `2.1.0-beta.8`, note: published GHCR image tags omit the leading `v`). | `latest` |
| `TZ` | System timezone. Affects log timestamps in both services and cron schedule targets. Database timestamps and API payloads remain UTC. An unrecognised zone falls back to UTC and is reported once at startup. | `UTC` |
| `LOG_LEVEL` | Verbosity of the system logger: `debug`, `info`, `warn`, or `error`. See [LOGGING.md](LOGGING.md) for detailed configuration options. | `info` |
| `DEBUG` | Shortcut boolean. When `true`, forces log levels to `DEBUG` and enables detailed HTTP request body logging. | `false` |
| `CONSOLE_LOG_LEVEL` | Overrides the log level threshold specifically for console / stdout container output. | `LOG_LEVEL` |
| `FILE_LOG_LEVEL` | Overrides the log level threshold specifically for disk logs (`logs/backend.log`). | `LOG_LEVEL` |
| `DB_LOG_LEVEL` | Overrides the log level threshold specifically for the `system_logs` table (Admin -> System Event Log). | `LOG_LEVEL` |
| `SLOW_QUERY_MS` | Threshold in milliseconds for database query tracing; queries taking longer are logged at `WARN` instead of `DEBUG`. | `500` |
| `AI_TRACE_CHARS` | Maximum character length of AI prompts and raw responses to log at `DEBUG`. | `2000` |
| `BACKEND_MEM_LIMIT` | Docker container memory constraint for the backend service. | `1g` |
| `REDACT_API_KEYS` | When set to `true`, AI API credentials stored in settings are masked (`sk-...xxxx`) in the Admin panel and cannot be revealed via the UI. | `false` |
| `ALLOW_INTERNAL_SCRAPING` | When set to `true`, any URL the application fetches may point at loopback, private, or link-local addresses. Leave it unset in production. Without it, admin tools (retailer config test, debug extract, retailer remap) refuse every internal address, and the product paths (add, rescan, scheduled refresh) refuse loopback and link-local — the cloud metadata endpoint `169.254.169.254` among them — while still allowing a shop on a private LAN such as `192.168.1.50`. Only the address check is waived: non-`http`/`https` schemes are always refused. | `false` |
| `DISABLE_TELEMETRY` | When set to `true`, disables the daily anonymous heartbeat ping. Can also be toggled in Admin -> System Settings. | `false` |
| `DO_NOT_TRACK` | Standard web privacy flag. When set to `1`, disables anonymous telemetry. | `0` |

---

## SSO / OIDC Configuration

These parameters enable and coordinate Single Sign-On integrations. Detailed setups are described in the Authentication guide.

| Variable | Description | Default |
|:---|:---|:---|
| `ENABLE_SSO` | Set to `true` to activate the OpenID Connect (OIDC) authentication endpoints and reveal SSO login routes in the UI. | `false` |
| `PUBLIC_URL` | The external public base URL of this PriceStalker instance. Required when `ENABLE_SSO` is active to formulate callback redirects. | `https://pricestalker.example.com` |
| `OIDC_REDIRECT_URI_OVERRIDE` | Override callback URL for custom reverse proxy routing configurations if different from `${PUBLIC_URL}/api/auth/oidc/callback`. | *(Empty)* |

---

## Optional Configuration

| Variable | Description | Default |
|:---|:---|:---|
| `ADMIN_API_TOKEN` | A bootstrap/emergency API token that grants administrative access without requiring a standard user login. Leave unset in production. | *(Empty)* |
| `SMTP_FALLBACK_HOST` | Hostname of the fallback SMTP email server. | *(Empty)* |
| `SMTP_FALLBACK_PORT` | Port number of the fallback SMTP email server. | `587` |
| `SMTP_FALLBACK_USER` | Username / account for authenticating with the fallback SMTP server. | *(Empty)* |
| `SMTP_FALLBACK_PASS` | Password / app password for authenticating with the fallback SMTP server. | *(Empty)* |
| `SMTP_FALLBACK_FROM` | The sender email address used for system fallback notifications. | *(Empty)* |
| `ADMIN_ALERT_EMAIL` | The recipient email address where database-health alert logs are forwarded on failure. | *(Empty)* |

---

## Browser Scraper Configuration

Read by the optional `scraper` service only (`scraper/src/core/SessionManager.ts`),
and only when that service is deployed. The backend scrapes over plain HTTP
without it; these change nothing on an install that has no browser scraper.

Each of the four numeric limits must be a **positive integer**. Anything else —
a negative number, a fraction, text — is refused with a warning at startup and
the default stands. A negative limit used to be accepted at face value and
quietly made the pool unusable: `sessions.length >= -1` is true on an empty
pool, so every scrape came back as "all browser instances at capacity".

| Variable | Description | Default |
|:---|:---|:---|
| `MAX_BROWSERS` | Maximum concurrent Chromium processes. The main lever for memory: each browser is a separate process with its own renderer children. Lower it to `1` on a 1–2 GB VPS. | `3` |
| `MAX_PAGES_PER_BROWSER` | Maximum concurrent tabs per browser process. Raising it increases throughput per browser at the cost of per-process memory. | `4` |
| `MAX_SCRAPES_PER_BROWSER` | Scrapes a browser serves before it is recycled, to reclaim the memory Chromium does not return. | `50` |
| `IDLE_TIMEOUT_MS` | Idle time, in milliseconds, before an unused browser is closed. | `300000` (5 minutes) |
| `ENABLE_ADBLOCKER` | Set to `false` to disable the built-in adblocker. It runs with `blockTrackers: false` so anti-bot verification scripts (Turnstile, Reese84, DataDome) can still report their telemetry; disable it entirely only when adblocking interferes with rendering. | `true` |
| `PROFILE_BASE_DIR` | Base directory for Chromium's per-session profiles. Set it to a path under `/dev/shm` to trade RAM for disk I/O. The default lives under the container's `/tmp`, which `docker-compose.yaml` and `deploy/swarm-stack.yml` back with a capped `tmpfs` so leaked profiles cannot fill the node's overlay storage (issue #52). | `<os tmpdir>/scraper-profiles` |

`docker-compose.yaml` and `deploy/swarm-stack.yml` both pass these through from
`SCRAPER_`-prefixed host variables (`SCRAPER_MAX_BROWSERS`, `SCRAPER_MAX_PAGES`,
`SCRAPER_MAX_SCRAPES`, `SCRAPER_IDLE_TIMEOUT_MS`, `SCRAPER_ENABLE_ADBLOCKER`,
`SCRAPER_PROFILE_BASE_DIR`), so set the prefixed names in `.env` rather than
editing the compose files.

### Per-scrape options, which are not environment variables

Navigation strategy, the scrape budget, the hydration delay and the challenge
auto-resolve knobs (`interstitialWaitMs`, `interstitialRetries`) arrive per
request over the scraper's HTTP API, not from the environment. The backend
sources the first three from the `browser_timeout` and `browser_delay` system
settings under **Admin -> System**; `browser_timeout` is the budget for the
*whole* scrape, which the scraper splits across navigation and the
post-navigation phase. The challenge phrase list is the
`generic_challenge_phrases` system setting, editable under
**Admin -> Extraction Rules**.
