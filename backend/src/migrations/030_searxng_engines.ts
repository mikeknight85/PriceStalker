import { MigrationContext } from '../config/migrate';

/**
 * Migration 030: SearXNG Search Engines Configuration
 *
 * Adds system_settings key for configurable SearXNG search engines:
 * - searxng_engines: comma-separated list of search engines to query.
 *
 * Defaults to empty string ('') so that by default PriceStalker respects and inherits
 * the SearXNG instance's own settings.yml configured active search engines.
 * Administrators can switch to custom engine selection in Admin -> System Settings.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES 
        ('searxng_engines', '', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DELETE FROM system_settings 
      WHERE key IN ('searxng_engines');
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
