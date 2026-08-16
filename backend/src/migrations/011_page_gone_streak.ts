import { MigrationContext } from '../config/migrate';

/**
 * Counter of consecutive page-gone (404/410) scrape results per product.
 * A product is only flagged not_available (paused + notified) after several
 * consecutive hits, so a transient CDN/bot-wall 404 no longer pauses
 * monitoring and spams notifications (2026-08-16 digitec incident).
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS page_gone_streak INTEGER NOT NULL DEFAULT 0;
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
    await client.query('ALTER TABLE products DROP COLUMN IF EXISTS page_gone_streak;');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
