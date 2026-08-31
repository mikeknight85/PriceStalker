import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/system/logging/logger';

/**
 * Query tracing for the Postgres pool (logging audit L-01).
 *
 * Repository SQL was previously invisible: a failing query surfaced as a bare
 * driver error with no statement, no timing, and no way to tell a slow query
 * from a stuck one.
 *
 * This wraps the pool rather than introducing a `tracedQuery` helper, because
 * thirty modules already import the pool directly and every one of them would
 * otherwise have to be rewritten to get any coverage at all.
 *
 * The logger is imported directly rather than through the logging barrel: that
 * chain ends at `pg` and never reaches back to `config/database`, so the
 * circular-import warning on the pool module does not apply here.
 *
 * Parameter *values* are never logged. They routinely carry password hashes,
 * reset tokens, API keys and email addresses, and the scrubber cannot reliably
 * redact a bare positional array with no key names to match on. The parameter
 * count is logged instead, which is what is actually useful when reading a
 * failure.
 */

const DEFAULT_SLOW_QUERY_MS = 500;

/** The logger's own insert, which must never be traced -- see below. */
const LOG_INSERT_MARKER = 'INSERT INTO system_logs';

function slowQueryThreshold(): number {
  const configured = Number(process.env.SLOW_QUERY_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SLOW_QUERY_MS;
}

/** Collapse a multi-line statement to one readable line and cap its length. */
function summarize(sql: string): string {
  const flattened = sql.replace(/\s+/g, ' ').trim();
  return flattened.length > 500 ? `${flattened.slice(0, 500)}...` : flattened;
}

function describe(args: unknown[]): { sql: string; paramCount: number } | null {
  const [first, second] = args;

  if (typeof first === 'string') {
    return { sql: summarize(first), paramCount: Array.isArray(second) ? second.length : 0 };
  }

  // The config-object form: pool.query({ text, values }).
  if (first && typeof first === 'object' && 'text' in first) {
    const config = first as { text: unknown; values?: unknown };
    if (typeof config.text === 'string') {
      return {
        sql: summarize(config.text),
        paramCount: Array.isArray(config.values) ? config.values.length : 0,
      };
    }
  }

  return null;
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

/** Replace `target.query` with a traced version, in place. */
function instrumentQuery(target: Queryable, label: 'Pool' | 'Client'): void {
  const original = target.query.bind(target) as (...args: unknown[]) => unknown;

  (target as { query: unknown }).query = function tracedQuery(...args: unknown[]) {
    const described = describe(args);

    // The logger persists to system_logs through this same pool. Tracing that
    // insert would make every database log line generate another one.
    if (!described || described.sql.startsWith(LOG_INSERT_MARKER)) {
      return original(...args);
    }

    const { sql, paramCount } = described;
    const started = Date.now();

    let result: unknown;
    try {
      result = original(...args);
    } catch (err) {
      logger.error(
        `SQL | ${label} | Failed to dispatch | ${sql} | Params: ${paramCount}`,
        'Database',
        err
      );
      throw err;
    }

    if (!(result instanceof Promise)) return result;

    return result.then(
      (value) => {
        const latency = Date.now() - started;
        if (latency >= slowQueryThreshold()) {
          logger.warn(
            `SQL | ${label} | Slow query | ${latency}ms | ${sql} | Params: ${paramCount}`,
            'Database'
          );
        } else {
          logger.debug(
            `SQL | ${label} | ${latency}ms | ${sql} | Params: ${paramCount}`,
            'Database'
          );
        }
        return value;
      },
      (err) => {
        const latency = Date.now() - started;
        logger.error(
          `SQL | ${label} | Failed after ${latency}ms | ${sql} | Params: ${paramCount}`,
          'Database',
          err
        );
        throw err;
      }
    );
  };
}

/**
 * Trace every statement issued through the pool, including those on clients
 * checked out for a transaction.
 */
export function enableQueryTracing(pool: Pool): void {
  instrumentQuery(pool, 'Pool');

  const originalConnect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;

  (pool as { connect: unknown }).connect = function tracedConnect(...args: unknown[]) {
    const result = originalConnect(...args);
    if (!(result instanceof Promise)) return result;

    return result.then((client: PoolClient) => {
      // A client is checked out and released repeatedly; only wrap it once.
      const marked = client as PoolClient & { __psQueryTraced?: boolean };
      if (!marked.__psQueryTraced) {
        instrumentQuery(marked, 'Client');
        marked.__psQueryTraced = true;
      }
      return client;
    });
  };
}
