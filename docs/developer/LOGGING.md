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
| `SLOW_QUERY_MS` | Any positive integer | `500` | A SQL statement taking at least this long is logged at `WARN` instead of `DEBUG`. |
| `AI_TRACE_CHARS` | Any positive integer | `2000` | How much of an AI prompt and response to record at `DEBUG`. Both are capped: a prompt carries the denoised product page. |
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

---

## 6. SQL Query Tracing

Every statement issued through the connection pool is traced under the
`Database` context, including statements on a client checked out for a
transaction. Each line carries the statement, how long it took, and how many
bind parameters it had:

```text
DEBUG [Database]: SQL | Pool | 4ms | SELECT * FROM products WHERE user_id = $1 | Params: 1
WARN  [Database]: SQL | Pool | Slow query | 812ms | SELECT ... | Params: 2
ERROR [Database]: SQL | Client | Failed after 3ms | UPDATE ... | Params: 3
```

Levels follow the same thresholds as everything else:

* `DEBUG` for a normal query. Set `LOG_LEVEL=debug` (or `CONSOLE_LOG_LEVEL=debug`)
  to see them; at the default `info` they cost nothing.
* `WARN` once a query reaches `SLOW_QUERY_MS`.
* `ERROR` when a query fails, with the driver error attached.

**Parameter values are never logged.** Bind parameters routinely carry password
hashes, reset tokens, API keys and email addresses, and the scrubber matches on
key names it cannot see in a bare positional array. The parameter count is
recorded instead.

Because `Database` is a high-volume context, `DEBUG` and `INFO` lines are printed
and written to disk but not persisted to `system_logs`. Slow-query warnings and
query failures are persisted, so they show up in **Admin -> System Event Log**.

---

## 7. AI Request Tracing

At `DEBUG`, every AI provider records the prompt it sent and the raw text it got
back, under the `AI` context:

```text
DEBUG [AI]: AI | Gemini | Request  | Extract the price from... [3021 more chars]
DEBUG [AI]: AI | Gemini | Response | {"price": 49.99, "currency": "AUD"}
```

The raw response matters more than the parsed one: most AI extraction failures
are a model wrapping its JSON in prose or a code fence, which is invisible by the
time parsing has already failed.

Both are capped at `AI_TRACE_CHARS` (default 2000). Uncapped, a single scrape
would put a page of HTML into the console, the log file, and -- if
`DB_LOG_LEVEL=debug` -- a `system_logs` row.

## 8. Extraction Progress

The price cascade writes each step to the log as it runs, as well as into the
scrape trace attached to the result. The trace alone only becomes visible once a
scrape finishes, so a scrape that hangs or dies partway took its progress with
it -- which is exactly when it is wanted.
