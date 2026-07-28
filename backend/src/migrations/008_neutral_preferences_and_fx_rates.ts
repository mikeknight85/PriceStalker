import { MigrationContext } from '../config/migrate';

/**
 * Remove inherited country defaults from new accounts and rebuild the
 * disposable exchange-rate cache around the Frankfurter v2 EUR reference base.
 * Existing user preferences are deliberately preserved.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE users
        ALTER COLUMN currency DROP DEFAULT,
        ALTER COLUMN locale DROP DEFAULT,
        ALTER COLUMN preferred_currency DROP DEFAULT;
      ALTER TABLE site_configs
        ALTER COLUMN default_currency DROP DEFAULT;
      ALTER TABLE exchange_rates
        ADD COLUMN IF NOT EXISTS rate_date DATE,
        ADD COLUMN IF NOT EXISTS source VARCHAR(100);
    `);
    await client.query('DELETE FROM exchange_rates');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  // Intentionally a no-op: restoring country-specific defaults would affect
  // future accounts and cannot restore a discarded cache safely.
};
