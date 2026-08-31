# PriceStalker Logging System Audit Report

This document presents a comprehensive review of the logging architecture, coverage, and debug capabilities of PriceStalker, focusing on finding gaps in operational monitoring, error diagnosis, and debug-level trace visibility.

---

## 1. Current Architecture Overview

PriceStalker runs a custom multi-target logging framework utilizing a database buffer, log file rotation, and console output.

| Logger Target | Level Mapping | Filtering / Noise Protection | Persistence Strategy |
| :--- | :--- | :--- | :--- |
| **Console (`stdout`)** | Respects `CONSOLE_LOG_LEVEL` | Unrestricted | Transient container logs |
| **File (`app.log`)** | Respects `LOG_LEVEL` | Unrestricted | Rotated daily (max 14 days) |
| **Database (`system_logs`)** | Ignores global level bounds | Bypasses `HTTP`, `Database`, `Scheduler` contexts for `INFO` | Stored in Postgres, pruned older than 14 days |

### Active Logging Rules
* **Sensitive Data Redaction**: The custom [scrubber.ts](file:///home/steven/projects/pricestalker/backend/src/utils/system/logging/scrubber.ts) automatically masks credentials (`user:pass`), OAuth bearer tokens, cookies, and database passwords from all logs before they hit console, files, or the database.
* **Database Persisted Contexts**: Only severity `ERROR` and `WARN` logs are saved unconditionally. `INFO` logs are saved *only* if they originate from business domain operations (e.g., `'Scraper'`, `'Authentication'`, `'Server'`).

---

## 2. Coverage Mapping

An audit of the backend system log calls shows high compliance across critical events, but highlights major gaps in detail tracing:

### Database Boot & Migrations (`Database` Context)
* **Status**: **Excellent**
* **Logs Found**:
  * Health verification start/completion: `logger.info('System | Database | Verification successful')`.
  * Umzug Schema migrations start and success: `logger.info('System | Migrations | Applying N migrations: ...')`.

### Scheduled Tasks (`Scheduler` Context)
* **Status**: **Good**
* **Logs Found**:
  * Task start/finish heartbeats (e.g., `logger.debug('Scheduler | Heartbeat | Starting scheduled scan')`).
  * Concurrency and queue details: `logger.info('Scheduler | Price Check | Found N products to check')`.
  * Job-level errors caught at top-level.
* **Gap**: The heartbeats are written to `DEBUG` and thus omitted from the database logs. While this avoids bloating the database table, it leaves the UI log viewer without confirmation that the cron schedule is operating normally unless a scrape runs.

### Scraper Orchestrator (`Scraper` & `Extraction` Context)
* **Status**: **Excellent**
* **Logs Found**:
  * Step-by-step trace mapping logged dynamically to a temporary list (`extractionSteps`).
  * Upon finish, the consolidated trace is logged at `INFO` level: `logger.info('Extraction | ...', 'Extraction', { trace: extractionSteps })`.
  * This trace gets written to the database in the `details` JSON field, powering the detail expansion in the Admin UI logs.

---

## 3. Discovered Gaps & Gaps Matrix

We identified **five major monitoring and tracing gaps** that degrade debugging speed, cost tracking, and system diagnostic accuracy:

| Gap ID | Area | Severity | Technical Impact | Actionable Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **L-01** | Database Layer | **High** | No visibility into SQL queries, database latency, or parameter maps during transaction failures. | Introduce a wrapper around `pool.query` that logs executing queries, counts, and duration at `DEBUG` level. |
| **L-02** | AI / LLM Integrations | **Medium** | Prompt structure, system parameters, and raw JSON returns are invisible; only token usage is logged. | Add `logger.debug` statements inside `providers/*.ts` printing the raw prompt request and response payloads. |
| **L-03** | Configuration Filtering | **Low** | Global `LOG_LEVEL` limits are bypassed by database writes, causing disk bloat on errors even when debugging is off. | **Fixed.** Database writes now honour `DB_LOG_LEVEL`, falling back to `LOG_LEVEL`, like the console and file sinks. |
| **L-04** | Scraper Selectors | **Low** | Selector evaluation sequence (JSON-LD, custom-regex, generic parsing) lacks real-time streaming console logs. | Log each selector execution and matching candidate in real-time under `DEBUG` level. |
| **L-05** | Auth token errors | **Low** | Verification checks for tokens don't log the reason for expiration or decryption failure. | Log token validation failures (e.g., token expired, signature mismatch) at `WARN` level. |

---

## 4. Operational Detail: Critical Gaps Breakdown

### L-01: Lack of SQL Query Trace
PriceStalker executes database interactions using direct PostgreSQL pool clients:
```typescript
const result = await pool.query('SELECT ...');
```
Because there is no intermediate wrapper or ORM hook, developers cannot see queries executing in real-time. 

> [!WARNING]
> If a query locks or runs slowly in production, it will trigger an E2E timeout error at the routing layer but show nothing in the logs, forcing developers to profile Postgres connection logs directly.

### L-02: Hidden LLM Payloads
The AI client (`backend/src/services/ai/providers/openai.ts` and others) currently logs token counts to console:
```typescript
logger.debug(`AI | ${this.providerName} | Tokens: ${response.usage.total_tokens}`);
```
However, the actual HTML inputs or structural schemas passed into the prompt are never logged. When the parser fails, developers cannot inspect the prompt to see if the HTML was truncated, malformed, or if the LLM output returned bad formatting.

---

## 5. Implementation Roadmap for Improvements

To resolve these gaps without code regression or database performance loss, follow this execution sequence:

### Phase 1: Database Query Tracing
Define a centralized query helper class or utility in `backend/src/config/database.ts`
for selected high-value repositories. Record operation names and timings, not
raw parameter values:
```typescript
export async function tracedQuery<T>(operation: string, query: () => Promise<T>) {
  const start = Date.now();
  try {
    const res = await query();
    logger.debug(`SQL | ${operation} | Latency: ${Date.now() - start}ms`, 'Database', {
      event: 'db.query',
      operation,
      duration_ms: Date.now() - start
    });
    return res;
  } catch (err) {
    logger.error(`SQL | ${operation} failed`, 'Database', {
      event: 'db.query.failed',
      operation,
      duration_ms: Date.now() - start,
      error: err
    });
    throw err;
  }
}
```

### Phase 2: Safe AI Call Tracing
Update AI Provider classes (`GeminiProvider`, `OpenAIProvider`, `AnthropicProvider`)
to write bounded metadata rather than raw prompt or response content:
```typescript
const started = Date.now();
const response = await this.client.chat.completions.create(...);
logger.debug('AI | Response completed', 'AI', {
  event: 'ai.response',
  provider: this.providerName,
  model,
  duration_ms: Date.now() - started,
  input_tokens: response.usage?.prompt_tokens,
  output_tokens: response.usage?.completion_tokens,
  response_chars: response.choices[0]?.message?.content?.length
});
```

### Phase 3: Synchronize Log Levels with DB Writer
Modify `printer.ts` to apply an explicit `DB_LOG_LEVEL` policy and a slow-query
threshold before inserting into Postgres. Keep error persistence reliable, but
avoid persisting routine debug queries and scheduler/database noise by default.

---

## 6. Recommended Direction

The existing `system_logs` shape is a useful foundation:

```sql
system_logs (
  id,
  level,
  context,
  message,
  details jsonb,
  created_at
)
```

The immediate problem is not that `details` is JSON. It is that the event
payload is not consistent. Event names are commonly embedded in `message`
using separators such as `|`, `context` is free-form text, and the frontend
has to know special keys inside `details` (`trace`, `steps`, `tokens`,
`product_id`, and so on).

The target should preserve the existing columns for compatibility while adding
small, stable fields:

```sql
event         text,
request_id    text,
product_id    integer,
duration_ms   integer
```

Their roles should be distinct:

| Field | Purpose |
| :--- | :--- |
| `context` | Broad subsystem, such as `Scraper`, `AI`, `Database`, or `Auth`. |
| `event` | Stable machine-readable name, such as `scrape.completed` or `ai.response`. |
| `message` | Short human-readable summary for the log table. |
| `details` | Event-specific structured JSON. |
| `request_id` | HTTP request or operation correlation identifier. |
| `product_id` | Indexed product relationship where applicable. |
| `duration_ms` | Duration for database, scraper, HTTP, AI, and job operations. |

An example event would be:

```json
{
  "level": "INFO",
  "context": "Scraper",
  "event": "scrape.completed",
  "message": "Price extraction completed",
  "request_id": "req_abc123",
  "product_id": 42,
  "duration_ms": 1380,
  "details": {
    "retailer_domain": "example.com",
    "stock_status": "in_stock",
    "candidate_count": 4,
    "selected_method": "json-ld",
    "currency": "USD"
  }
}
```

## 7. Safety Boundaries

The original suggestions to log raw SQL parameters and full AI prompts or
responses should not be implemented literally. Scraped pages and AI prompts
may contain personal data, customer URLs, credentials, or very large payloads.
The current scrubber redacts common secret keys, but it does not make arbitrary
HTML or prompt content safe to persist.

### Database tracing

Do not persist raw SQL parameters by default. Query instrumentation should
record an operation name or normalized query fingerprint, duration, row count,
success/failure, PostgreSQL error code, and correlation identifiers:

```json
{
  "event": "db.query",
  "operation": "product.find_due_for_refresh",
  "duration_ms": 42,
  "row_count": 1,
  "slow": false
}
```

Only slow queries and failures should normally be written to `system_logs`.
The application has many direct `pool.query` call sites, so an explicit
instrumentation helper should be introduced first for high-value repositories
instead of changing every query in one pass.

### AI tracing

AI diagnostics should record metadata, not raw prompt content:

```json
{
  "event": "ai.response",
  "provider": "openai",
  "model": "configured-model",
  "operation": "price_extraction",
  "duration_ms": 1830,
  "input_tokens": 12000,
  "output_tokens": 640,
  "response_chars": 2100,
  "parse_status": "success"
}
```

If raw prompt or response capture is ever required, it should be explicitly
opt-in, size-bounded, redacted, and kept out of normal database persistence.

## 8. Correlation IDs

A scrape can span an HTTP request, product discovery or refresh, HTML
acquisition, extraction, AI mapping, consensus, persistence, and notification.
Some current logs carry `product_id` or `requestId`, but this is not enforced
consistently.

Introduce a shared operation context, initially containing:

```typescript
interface LogContext {
  request_id?: string;
  product_id?: number;
  scrape_id?: string;
  job_id?: string;
}
```

Use asynchronous request context so nested services inherit these values.
The first integration points should be Express requests, scheduled price-check
jobs, product discovery, product refresh/rescan, and scraper orchestration.
This would make a complete scrape trace queryable without relying on message
parsing:

```sql
SELECT *
FROM system_logs
WHERE scrape_id = $1
ORDER BY created_at;
```

## 9. Phased Implementation Plan

### Phase 1: Logging foundation

- Add an optional `event` field and a typed details contract.
- Normalize `Error` values before persistence.
- Keep `logger.info/warn/error/debug` working while adding a structured event API.
- Add the new columns through an idempotent migration.
- Make the Admin log response and UI aware of event names and structured fields.

### Phase 2: Correlation and scraper tracing

- Add request, scrape, job, and product identifiers to the shared logging context.
- Apply the context to HTTP requests, scheduled jobs, and scraper orchestration.
- Display event names and correlation identifiers in the Admin log viewer.

### Phase 3: Operational instrumentation

- Add a safe traced-query helper for selected repositories.
- Persist query failures and queries above a configurable slow-query threshold.
- Add a shared AI-call wrapper for provider, model, duration, token, retry, and
  parse metadata.
- Add selector/extraction metrics only where they materially improve diagnosis.

## 10. Log-Level Policy

Database persistence currently has a separate hard-coded policy from console
and file output. This is why the audit describes database writes as bypassing
`LOG_LEVEL`; more precisely, database writes intentionally use their own
severity/context rules in `printer.ts`.

Make that policy explicit with settings such as:

```text
LOG_LEVEL=INFO
CONSOLE_LOG_LEVEL=INFO
FILE_LOG_LEVEL=INFO
DB_LOG_LEVEL=WARN
DB_SLOW_QUERY_MS=500
```

The existing special cases for `HTTP`, `Database`, `Scheduler`, and `Voting`
should become named policy decisions or configuration rather than hidden
conditionals. Debug-level database logging should remain bounded and filtered
to avoid turning `system_logs` into an unbounded query dump.

## 11. Recommended Issue Breakdown

The work should be split into reviewable changes:

1. **Logging foundation:** event names, typed details, consistent redaction,
   explicit database log-level policy, migration, and Admin UI support.
2. **Correlation and scraper tracing:** request/scrape/job IDs and complete
   end-to-end trace display.
3. **Operational instrumentation:** safe slow-query tracing, AI call metadata,
   and targeted selector/extraction metrics.

This approach improves diagnosis without persisting sensitive payloads or
turning `system_logs` into an unbounded debug archive.
