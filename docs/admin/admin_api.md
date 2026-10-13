# PriceStalker API Reference Guide

All PriceStalker endpoints are grouped by resource type. The Base URL is `/api`. All endpoints require `Authorization: Bearer <token>` unless marked otherwise.

---

## Authentication & Session Endpoints
*No token required for registration status or login.*

<details><summary><b>Authentication API</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Log in to retrieve a JWT session token |
| `GET` | `/auth/registration-status` | Check if public registrations are enabled |
</details>

---

## Products & Watcher Management

<details><summary><b>Products API</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List all tracked products |
| `POST` | `/products` | Add a new product by URL |
| `GET` | `/products/:id` | Get details, stats, and metadata for a product |
| `PUT` | `/products/:id` | Update settings and notification triggers for a product |
| `DELETE` | `/products/:id` | Stop tracking and delete a product |
| `GET` | `/products/:id/prices` | Retrieve price history data points |
| `POST` | `/products/:id/refresh` | Force an immediate price check |
</details>

---

## User Settings & Profile

<details><summary><b>Settings & Profile API</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`/`PUT` | `/settings/notifications` | Get / update user notification configurations |
| `POST` | `/settings/notifications/test/{telegram,discord,pushover,ntfy,gotify,email,webhook}` | Send a test notification alert |
| `POST` | `/settings/notifications/test-gotify` | Test Gotify connection before saving settings |
| `GET` | `/settings/product-defaults` | Get effective default check interval for the user & instance |
| `GET` | `/settings/discovery/status` | Check if SearXNG product search is enabled |
| `GET` | `/settings/currencies` | List global reference currencies |
| `GET`/`PUT` | `/settings/ai` | Get / update user AI settings |
| `POST` | `/settings/ai/test` | Test AI extraction on a target URL |
| `POST` | `/settings/ai/test-{ollama,gemini,groq,openai,mistral,anthropic}` | Test connection to a specific AI provider |
| `GET`/`PUT` | `/profile` | Get / update user profile (currency, locale, default_refresh_interval) |
| `PUT` | `/profile/password` | Change user password |
</details>

---

## Administrative Management (Admin Only)
*All admin endpoints require an active user account with `is_admin: true` or a valid system token.*

A system token must additionally hold a scope that covers the route. The scopes
are `*` (full access), `mcp:read`, `mcp:write`, `mcp:extract`, `admin:read`,
`admin:write` and `admin:system`; a denial answers `403` with the scopes that
would have been accepted. Tokens issued before scopes existed hold `*` and are
unaffected. See [API Tokens](tokens.md).

<details><summary><b>System API Tokens</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `GET` | `/api/admin/system-tokens` | List all active system tokens (never returns a hash or a token value) |
| `GET` | `/api/admin/system-tokens/scopes` | List the scope vocabulary a token can be granted |
| `POST` | `/api/admin/system-tokens` | Generate a new system token |
| `DELETE` | `/api/admin/system-tokens/:id` | Revoke a system token |

`POST` accepts `{ label, description?, expires_at?, scopes? }`. Omitting `scopes`
grants `["*"]` (full access) for backwards compatibility and logs a warning;
pass an explicit list to narrow the token. An unknown scope is rejected with
`400` rather than ignored.
</details>

<details><summary><b>User Administation</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `GET` | `/api/admin/users` | List all users in the system |
| `POST` | `/api/admin/users` | Create a new user account |
| `PUT` | `/api/admin/users/:id` | Update user details |
| `DELETE` | `/api/admin/users/:id` | Delete a user |
| `PUT` | `/api/admin/users/:id/admin` | Toggle user admin status |
</details>

<details><summary><b>System Operations & Settings</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `GET`/`PUT` | `/api/admin/settings` | Get / update global system settings |
| `GET` | `/api/admin/debug/status` | Check if public debug mode is active |
| `POST` | `/api/admin/command` | Run system command (e.g. `clear-settings-cache`, `run-migration`) |
</details>

<details><summary><b>Retailer Database Mappings</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `GET` | `/api/admin/retailers` | List all retailer config mappings |
| `POST` | `/api/admin/retailers` | Add or update a retailer configuration |
| `DELETE` | `/api/admin/retailers/:id` | Remove a retailer configuration |
| `GET` | `/api/admin/retailers/domain/:domain` | Fetch config for a specific domain |
| `POST` | `/api/admin/retailers/test` | Test a retailer configuration live |
</details>

<details><summary><b>System Logs & Health</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `GET` | `/api/admin/logs` | Fetch system logs (paginated/filtered) |
| `DELETE` | `/api/admin/logs` | Delete specific logs by ID |
| `DELETE` | `/api/admin/logs/clear` | Clear logs by level or context |
| `GET` | `/api/admin/debug/db-health` | Fetch active database health monitor state |
| `POST` | `/api/admin/debug/db-health/test-alert` | Trigger direct SMTP test email |
| `POST` | `/api/admin/debug/db-health/simulate` | Simulate database state transition |
</details>

---

## Debugging & Extraction
<details><summary><b>Extract API</b></summary>

| Method | Endpoint | Description |
|----------|--------|-------------|
| `POST` | `/api/admin/debug/extract` | Run full multi-strategy extraction on a URL |

`/api/admin/debug/extract` is the preferred way to test site scraper behaviors. It runs the exact same multi-strategy pipeline used by the scheduler background loops.

**Payload**:
```json
{
 "url": "https://www.example.com/product",
 "mode": "scraper",
 "config": {
 "use_browser_scraper": false
 },
 "use_ai": true,
 "returnHtml": false
}
```

* **`mode`**: Choose `"scraper"` (run full pipeline) or `"bypass"` (run direct local axios request).
* **`config`**: Override scraper configs (e.g. `use_browser_scraper`, `use_proxy`).
* **`use_ai`**: Set to `true` to allow AI extraction fallback on failure.
* **`returnHtml`**: Set to `true` to return the raw HTML string inside the response payload.
</details>
