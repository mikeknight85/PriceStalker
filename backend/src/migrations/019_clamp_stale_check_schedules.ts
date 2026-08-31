import { MigrationContext } from '../config/migrate';

/**
 * Corrects check schedules written before the jitter was bounded (issue #138).
 *
 * Three timing randomisers used to compound -- +/-15% jitter, x1.5 during quiet
 * hours, and a 10% chance to double -- so a product set to check every 6 hours
 * could be scheduled more than 20 hours out. That is now capped at 1.5x the
 * configured interval, but the cap only applies when a *new* schedule is
 * computed. Every `next_check_at` already sitting in the database keeps its old
 * value until the product's next check, which for the worst cases is more than
 * a day away -- so upgrading alone leaves the user looking at exactly the
 * countdown they reported.
 *
 * Only rows that exceed the new bound are touched, so a schedule the current
 * code would have produced is left exactly as it is.
 *
 * The new time is anchored on `last_checked`, matching what
 * productLifecycleRepository.update does when an interval changes: elapsed time
 * counts toward the interval, so a product that is already overdue becomes due
 * rather than being given a fresh full wait.
 *
 * Idempotent: after this runs no row exceeds the bound, so a second run matches
 * nothing.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE products
      SET next_check_at = GREATEST(
            -- Spread anything that lands in the past across a few minutes
            -- rather than making every stale product due in the same tick. On
            -- a large install the alternative is a burst of scrapes at boot,
            -- all to the same handful of retailers.
            CURRENT_TIMESTAMP + ((id % 10) * INTERVAL '30 seconds'),
            last_checked + (refresh_interval || ' seconds')::interval
          )
      WHERE last_checked IS NOT NULL
        AND next_check_at IS NOT NULL
        AND refresh_interval IS NOT NULL
        AND EXTRACT(EPOCH FROM (next_check_at - last_checked)) > refresh_interval * 1.5
    `);

    if (result.rowCount) {
      console.log(
        `[019] Corrected ${result.rowCount} check schedule(s) that exceeded 1.5x the configured interval.`
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Intentionally does nothing.
 *
 * The old values were the bug. There is no record of what each row held before
 * this ran, and restoring them would mean deliberately re-scheduling products
 * further out than the interval their owner chose.
 */
export const down = async () => {
  // No-op. See above.
};
