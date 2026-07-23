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
| `IMAGE_TAG` | Image release tag. Set to `beta` to test pre-release builds. | `latest` |
| `TZ` | System timezone. This affects log timestamps and cron job schedule targets. | `UTC` |
| `LOG_LEVEL` | Verbosity of the system logger: `debug`, `info`, `warn`, or `error`. | `info` |
| `BACKEND_MEM_LIMIT` | Docker container memory constraint for the backend service. | `1g` |
| `REDACT_API_KEYS` | When set to `true`, AI API credentials stored in settings are masked (`sk-...xxxx`) in the Admin panel and cannot be revealed via the UI. | `false` |

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
| `SMTP_FALLBACK_FROM` | The sender email address used for system fallback notifications. | *(Empty)* |
| `ADMIN_ALERT_EMAIL` | The recipient email address where database-health alert logs are forwarded on failure. | *(Empty)* |
