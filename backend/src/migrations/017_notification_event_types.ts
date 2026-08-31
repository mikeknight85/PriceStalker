import { MigrationContext } from '../config/migrate';

/**
 * Records the actual event on a notification instead of a broad category
 * (issue #93).
 *
 * The orchestrator stored one of three catch-all types, so distinct events
 * became indistinguishable the moment they were persisted:
 *
 *   back in stock       -> stock_alert
 *   product unavailable -> system_alert    (labelled "Tracking Issue")
 *   price announced     -> price_alert
 *
 * `price_drop` and `target_price` were already stored as themselves, which is
 * why those two are the only ones the history page can currently filter
 * usefully.
 *
 * The backfill is exact rather than a guess: each legacy type had exactly one
 * producer, so the original event is recoverable.
 *
 *   stock_alert  <- notifyBackInStock only
 *   price_alert  <- notifyPriceAnnounced only
 *   system_alert <- notifyNotAvailable only
 *
 * `product_restored` is not in that list because it did not exist until today,
 * so no historical row can be one.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE notifications SET type = 'back_in_stock'  WHERE type = 'stock_alert';
    `);
    await client.query(`
      UPDATE notifications SET type = 'price_announced' WHERE type = 'price_alert';
    `);
    await client.query(`
      UPDATE notifications SET type = 'not_available'   WHERE type = 'system_alert';
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
    await client.query(`UPDATE notifications SET type = 'stock_alert'  WHERE type = 'back_in_stock';`);
    await client.query(`UPDATE notifications SET type = 'price_alert'  WHERE type = 'price_announced';`);
    // product_restored collapses into the same category it would have had.
    await client.query(`UPDATE notifications SET type = 'system_alert' WHERE type IN ('not_available', 'product_restored');`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
