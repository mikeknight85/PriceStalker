import { MigrationContext } from '../config/migrate';

/**
 * A configurable default check interval for newly added products (issue #239).
 *
 * The Add Product form opened on 12 hours and both product-add paths fell back
 * to the same 43200 seconds, so anybody who wanted a different cadence changed
 * the field on every single product -- which is tolerable once and is real
 * friction when bulk-adding a list straight after setup.
 *
 * Two places can answer it, because in a self-hosted multi-user instance two
 * different people have a claim on it:
 *
 * - `system_settings.default_refresh_interval` is the instance default, set by
 *   an administrator. It is the only one that applies to a user who has never
 *   opened Settings, and it is where somebody responsible for how hard this
 *   install leans on retailers sets the house cadence.
 * - `users.default_refresh_interval` is one person's own preference and wins
 *   over the instance default for the products they add. NULL means "follow the
 *   instance default", which is what every existing account gets.
 *
 * ## Existing products are untouched
 *
 * Deliberately no `UPDATE products`. `refresh_interval` on a listing is a
 * decision already taken -- in most cases by accepting the old 12-hour default
 * -- and a new default is about what the *next* product starts at. Changing a
 * schedule somebody is watching a countdown against is exactly the complaint
 * issue #138 was about.
 *
 * ## Seeding
 *
 * The instance default is seeded rather than left absent, so Admin -> System
 * shows the value in force instead of an empty field (CLAUDE.md: a table the
 * app reads from must be seeded by a migration). 43200 is the old hardcoded
 * value, so a fresh install and an upgraded one behave identically until
 * somebody changes it. `ON CONFLICT DO NOTHING` leaves an administrator's own
 * value alone if this ever runs twice.
 *
 * Idempotent: `ADD COLUMN IF NOT EXISTS` plus `ON CONFLICT DO NOTHING`, so it
 * is safe against a fresh database, one restored from `init.sql`, and one that
 * has already had this applied.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Nullable with no DEFAULT on purpose: NULL is a meaningful value here
    // ("follow the instance default"), and a column default would instead bake
    // today's instance setting into every existing row.
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS default_refresh_interval integer
    `);

    await client.query(`
      COMMENT ON COLUMN users.default_refresh_interval IS
        'Seconds between checks for products this user adds. NULL = follow system_settings.default_refresh_interval.'
    `);

    await client.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('default_refresh_interval', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO NOTHING`,
      ['43200']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Removes both halves of the setting.
 *
 * Nothing else reads either one, and no product row was changed going up, so
 * rolling back leaves every listing on the interval it already had and returns
 * new products to the hardcoded 12-hour fallback in
 * `utils/system/check-interval.ts`.
 */
export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS default_refresh_interval');
    await client.query(`DELETE FROM system_settings WHERE key = 'default_refresh_interval'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
