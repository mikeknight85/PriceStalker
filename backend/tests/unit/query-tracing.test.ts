import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Pool } from 'pg';
import { enableQueryTracing } from '../../src/config/queryTracing';
import { logger } from '../../src/utils/system/logging/logger';

/**
 * Tracing wraps the pool that every repository already imports, so a mistake
 * here breaks every query in the application rather than just the logging.
 */

function fakePool(behaviour: {
  query?: (...args: unknown[]) => unknown;
  client?: Record<string, unknown>;
}) {
  const client = behaviour.client ?? { query: vi.fn().mockResolvedValue({ rows: [] }) };
  return {
    query: behaviour.query ?? vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
}

describe('Query tracing', () => {
  let debug: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    delete process.env.SLOW_QUERY_MS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.SLOW_QUERY_MS;
  });

  it('passes the result through untouched', async () => {
    const rows = [{ id: 1 }];
    const pool = fakePool({ query: vi.fn().mockResolvedValue({ rows }) });
    enableQueryTracing(pool);

    const result = await pool.query('SELECT * FROM products WHERE id = $1', [1]);

    expect(result.rows).toBe(rows);
  });

  it('logs the statement and the parameter count, never the values', async () => {
    const pool = fakePool({});
    enableQueryTracing(pool);

    await pool.query('SELECT id FROM users WHERE email = $1 AND token = $2', [
      'person@example.test',
      'super-secret-reset-token',
    ]);

    expect(debug).toHaveBeenCalledTimes(1);
    const [message, context] = debug.mock.calls[0];
    expect(context).toBe('Database');
    expect(message).toContain('SELECT id FROM users WHERE email = $1 AND token = $2');
    expect(message).toContain('Params: 2');
    // The whole point: positional values carry secrets and cannot be scrubbed
    // by key name, so they must never reach a log line.
    expect(message).not.toContain('super-secret-reset-token');
    expect(message).not.toContain('person@example.test');
  });

  it('collapses a multi-line statement onto one line', async () => {
    const pool = fakePool({});
    enableQueryTracing(pool);

    await pool.query('SELECT *\n  FROM   products\n  WHERE id = $1', [7]);

    expect(debug.mock.calls[0][0]).toContain('SELECT * FROM products WHERE id = $1');
  });

  it('warns instead of debugging when a query is slow', async () => {
    process.env.SLOW_QUERY_MS = '20';
    const pool = fakePool({
      query: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ rows: [] }), 40))
      ),
    });
    enableQueryTracing(pool);

    await pool.query('SELECT pg_sleep(1)');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Slow query');
    expect(debug).not.toHaveBeenCalled();
  });

  it('logs a failing query and still rejects', async () => {
    const boom = new Error('relation "missing" does not exist');
    const pool = fakePool({ query: vi.fn().mockRejectedValue(boom) });
    enableQueryTracing(pool);

    await expect(pool.query('SELECT 1 FROM missing')).rejects.toThrow(boom);

    expect(error).toHaveBeenCalledTimes(1);
    const [message, context, err] = error.mock.calls[0];
    expect(context).toBe('Database');
    expect(message).toContain('SELECT 1 FROM missing');
    expect(err).toBe(boom);
  });

  it('does not trace the logger\'s own insert', async () => {
    const pool = fakePool({});
    enableQueryTracing(pool);

    // Tracing this would make every database log line generate another one.
    await pool.query('INSERT INTO system_logs (level, context, message, details) VALUES ($1, $2, $3, $4)', [
      'ERROR',
      'Database',
      'boom',
      null,
    ]);

    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('traces queries issued on a checked-out transaction client', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const pool = fakePool({ client });
    enableQueryTracing(pool);

    const checkedOut = await pool.connect();
    await checkedOut.query('UPDATE products SET name = $1 WHERE id = $2', ['x', 1]);

    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain('UPDATE products SET name = $1 WHERE id = $2');
  });

  it('wraps a pooled client only once across check-outs', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const pool = fakePool({ client });
    enableQueryTracing(pool);

    const first = await pool.connect();
    const second = await pool.connect();
    await second.query('SELECT 1');

    // pg reuses client objects, so double-wrapping would log each statement
    // once per check-out the client had ever had.
    expect(first).toBe(second);
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it('supports the config-object form of query', async () => {
    const pool = fakePool({});
    enableQueryTracing(pool);

    await pool.query({ text: 'SELECT $1::int', values: [1] });

    expect(debug.mock.calls[0][0]).toContain('SELECT $1::int');
    expect(debug.mock.calls[0][0]).toContain('Params: 1');
  });
});
