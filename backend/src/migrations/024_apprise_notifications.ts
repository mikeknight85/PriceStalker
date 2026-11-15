import { MigrationContext } from '../config/migrate';

/**
 * Adds the per-user settings for the Apprise notification channel (issue #270).
 *
 * Apprise is configured the way the other channels are: columns on `users`,
 * read by `user-settings.repository.ts` and handed to the provider registry.
 *
 * - `apprise_url` is the apprise-api base URL, e.g. `http://apprise:8000`.
 * - `apprise_config_key` selects a stored configuration (`/notify/<key>`).
 *   Empty means stateless mode, where `apprise_urls` carries the targets.
 * - `apprise_urls` holds Apprise service URLs. They embed credentials, so the
 *   UI treats them like the Discord and webhook URLs.
 * - `apprise_tag` routes within a stored configuration.
 *
 * `apprise_enabled` defaults to false. The older channels default to true, which
 * only works because each also requires its credentials before it activates; a
 * new channel should not appear switched on before anyone has configured it.
 *
 * Idempotency: every column is added with `IF NOT EXISTS`, so this is safe on a
 * fresh database, on one restored from `init.sql`, and on a second run.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS apprise_url              TEXT,
        ADD COLUMN IF NOT EXISTS apprise_config_key       TEXT,
        ADD COLUMN IF NOT EXISTS apprise_urls             TEXT,
        ADD COLUMN IF NOT EXISTS apprise_tag              TEXT,
        ADD COLUMN IF NOT EXISTS apprise_enabled          BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS apprise_message_template TEXT
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Drops the columns. Rolling back loses every user's Apprise configuration;
 * nothing else reads them.
 */
export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS apprise_message_template,
        DROP COLUMN IF EXISTS apprise_enabled,
        DROP COLUMN IF EXISTS apprise_tag,
        DROP COLUMN IF EXISTS apprise_urls,
        DROP COLUMN IF EXISTS apprise_config_key,
        DROP COLUMN IF EXISTS apprise_url
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
