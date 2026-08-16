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
| **L-03** | Configuration Filtering | **Low** | Global `LOG_LEVEL` limits are bypassed by database writes, causing disk bloat on errors even when debugging is off. | Modify the persistence write handler to enforce `LOG_LEVEL` thresholds before inserting into the Postgres database. |
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
Define a centralized query helper class or utility in `backend/src/config/database.ts` to log statements:
```typescript
export async function tracedQuery(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    logger.debug(`SQL | Query: ${text} | Latency: ${Date.now() - start}ms`, 'Database');
    return res;
  } catch (err) {
    logger.error(`SQL | Failed: ${text} | Latency: ${Date.now() - start}ms`, 'Database', err);
    throw err;
  }
}
```

### Phase 2: Raw AI Output Logging
Update AI Provider classes (`GeminiProvider`, `OpenAIProvider`, `AnthropicProvider`) to write input/output details:
```typescript
logger.debug(`AI | Request | Prompt: ${prompt.substring(0, 500)}...`, 'AI');
const response = await this.client.chat.completions.create(...);
logger.debug(`AI | Response | Text: ${response.choices[0]?.message?.content}`, 'AI');
```

### Phase 3: Synchronize Log Levels with DB Writer
Modify `printer.ts` to block db insertions if they fall below the configuration `LOG_LEVEL` thresholds.
