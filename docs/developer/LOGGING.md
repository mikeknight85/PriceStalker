# PriceStalker Logging System Guide

This document describes the logging architecture, targets, configuration options, noise-reduction features, and security scrubbing mechanics within PriceStalker.

---

## 1. Overview & Architecture

PriceStalker is split into two primary backend components, each handling logging independently:
1. **Backend API Service**: Utilizes a multi-target, structured system that routes messages to the console, local disk files, and the PostgreSQL database.
2. **Scraper Service**: Uses a light console-focused logger optimized for streaming Puppeteer/stealth browsing operations.

---

## 2. Configuration Options

Logging behavior is controlled via environment variables in your `.env` file or `docker-compose.yaml` file.

| Environment Variable | Allowed Values | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Global log level threshold for both backend and scraper services. |
| `DEBUG` | `true`, `false` | `false` | Shortcut boolean. Setting to `true` overrides log levels to `DEBUG` and enables detailed HTTP request body logging. |
| `CONSOLE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `LOG_LEVEL` | Overrides the log level threshold specifically for Console/Docker output. |
| `FILE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `LOG_LEVEL` | Overrides the log level threshold specifically for Disk Log files. |
| `DB_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `LOG_LEVEL` | Overrides the log level threshold specifically for the `system_logs` table behind Admin -> System Event Log. Raise it to `warn` to keep the table small, or lower it to `debug` to capture traces without flooding the console. |
| `LOG_DIR_PATH` | Any valid absolute/relative directory | `./logs` | Directory path where log files are written. |
| `TZ` | e.g. `Australia/Perth`, `UTC` | `UTC` | Controls the timezone prefix format for both services. |

---

## 3. Logging Targets & Output Modes

The **Backend API Service** prints logs to three distinct outputs:

### A. Console (stdout / stderr)
Optimized for visibility in terminal runners and container engines (e.g. `docker compose logs`).
* Strips HTML tags (such as `<br>` formatting) to ensure clean readability.
* Redirects `ERROR` and `WARN` levels to `stderr` and `INFO`/`DEBUG` to `stdout`.

### B. Disk Log Files
Logs are written to the directory specified by `LOG_DIR_PATH` (default: `./logs/`):
* `backend.log`: Contains all logs matching or exceeding the `FILE_LOG_LEVEL` threshold.
* `error.log`: An error-only log capturing `WARN` and `ERROR` entries. Includes full stack traces when errors are thrown.

### C. Database (PostgreSQL)
Persistent event logs stored in the `system_logs` table. These logs are queryable via the **Admin -> System Event Log** panel in the Web UI.

Writes honour `DB_LOG_LEVEL` (falling back to `LOG_LEVEL`) exactly as the console
and file sinks honour theirs. Two context rules apply on top of the threshold:

* `HTTP`, `Database` and `Scheduler` are high-volume operational contexts. Below
  `WARN` they are not persisted, because request and heartbeat chatter bloats the
  table without telling an administrator anything.
* At `WARN` and `ERROR` those contexts *are* persisted regardless, since a failed
  request or a scheduler error is exactly what the event log is opened to find.

They store:
* Log Level & Timestamp
* Source context (e.g. `Auth`, `Scraper`, `API`, `Database`)
* Message content
* Structured metadata (such as `requestId`, `productId`, or `retailer_domain`)

---

## 4. Log Level Hierarchy & DB Persistence Rules

PriceStalker uses a priority-based scale for filtering logs:
$$\text{DEBUG (0)} \rightarrow \text{INFO (1)} \rightarrow \text{WARN (2)} \rightarrow \text{ERROR (3)}$$

### Database Persistence Rules
To prevent database bloat, performance bottlenecks, and logging loops, the database target bypasses the default log hierarchy in favor of strict context filtering:

* **ERROR** & **WARN**: Always persisted to the database.
* **INFO**: Persisted to the database **except** when belonging to high-noise contexts (`HTTP`, `Database`, `Scheduler`).
* **DEBUG**: Discarded and **never** persisted to the database, with the sole exception of consolidated `'Voting'` context logs.

---

## 5. Express HTTP Request Logger Middleware

The backend automatically logs incoming HTTP requests using a custom Express middleware.

### Noise Reduction Filters
To keep logs clean, the request logger implements the following:
* Successful (`status < 400`) polling requests to `/api/notifications/recent` and `/health` are omitted entirely from production logs.
* Routine monitoring checks (e.g., retrieving system logs or status checks) are forced to the `DEBUG` level to keep them out of standard production logs.
* Any request resulting in a status code $\ge 400$ is automatically promoted to `WARN` level.

### Extended Debug Payloads
When `DEBUG=true` is enabled, the request logger appends full client request payloads (`query` parameters and `body` data) directly into the debug logs.

---

## 6. Log Scrubbing & Security

To prevent sensitive credentials and tokens from leaking into files or databases, all log outputs pass through an automatic scrubbing processor before being outputted:

1. **URL Credential Scrubbing**: Any URL string containing embedded basic auth (e.g., `http://user:password@hostname`) has its credentials replaced: `http://[REDACTED]:[REDACTED]@hostname`.
2. **Object Key Redaction**: When logging objects or request details, the logger scans recursively for sensitive key patterns:
   `password`, `token`, `api_key`, `secret`, `password_hash`, `token_hash`, `authorization`, `proxy`.
   Matching key values are replaced with `[REDACTED]`.

---

## 7. Viewing and Managing Logs

### CLI / Terminal
View real-time logs from Docker:
```bash
docker compose logs -f backend
```

### Web Admin UI
Administrators can search, filter, and review logs under **Admin -> System Event Log**.
* **Filter by Severity**: Toggle between Info, Warnings, Errors, and Debug logs.
* **Filter by Source**: Dropdown populated by distinct database log contexts.
* **Purge Logs**: Clear all logs matching current filters.
* **Bulk Action**: Delete specific log rows.
* **Auto-cleanup**: The database runs background routines that automatically prune logs older than 14 days to prevent storage growth.
