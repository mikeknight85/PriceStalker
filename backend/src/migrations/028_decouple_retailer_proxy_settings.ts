import { MigrationContext } from '../config/migrate';

/**
 * Migration 028: Decouple Retailer Proxy Settings
 *
 * Separates the monolithic `use_proxy` flag on `retailer_configs` into:
 * - `use_proxy_http`: Routes standard Axios HTTP requests through the proxy.
 * - `use_proxy_browser`: Routes remote Puppeteer/Chromium requests through the proxy.
 *
 * The legacy `use_proxy` column is retained to ensure rolling back to older
 * images does not crash, and existing `use_proxy = true` configurations are
 * backfilled into both flags.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE public.retailer_configs
        ADD COLUMN IF NOT EXISTS use_proxy_http boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS use_proxy_browser boolean NOT NULL DEFAULT false;
    `);

    // Backfill existing use_proxy setting so behavior is preserved
    await client.query(`
      UPDATE public.retailer_configs
      SET use_proxy_http = COALESCE(use_proxy, false),
          use_proxy_browser = COALESCE(use_proxy, false)
      WHERE use_proxy = true;
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

    // Sync back to use_proxy if either was enabled
    await client.query(`
      UPDATE public.retailer_configs
      SET use_proxy = COALESCE(use_proxy_http, false) OR COALESCE(use_proxy_browser, false);
    `);

    await client.query(`
      ALTER TABLE public.retailer_configs
        DROP COLUMN IF EXISTS use_proxy_http,
        DROP COLUMN IF EXISTS use_proxy_browser;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
