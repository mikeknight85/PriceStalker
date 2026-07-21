import { MigrationContext } from '../config/migrate';

/**
 * v1 compatibility pre-flight.
 *
 * PROBLEM
 * v2 tracks schema state with umzug against a `migrations` table. A PriceStalker
 * v1 database has no such table, so umzug concludes nothing has run and starts at
 * 001_initial_schema. But 001 is written as CREATE TABLE IF NOT EXISTS, and on a v1
 * database those tables already exist -- so 001 no-ops on them and is then recorded
 * as executed. Migrations 002-022 subsequently ALTER a schema still in its v1 shape.
 * The upgrade reports success and the instance then fails on any feature touching
 * the 21 columns that were never created.
 *
 * APPROACH
 * This migration runs before 001 (umzug orders lexicographically) and adds exactly
 * the columns 001 would have created but cannot, because the tables already exist.
 * 001 is deliberately NOT stamped as executed: it still needs to run in order to
 * create the six tables v1 lacks (retailer_configs, system_logs, exchange_rates,
 * global_currencies, regional_currency_mappings, user_memberships) and to seed
 * system_settings. Every statement in 001 is IF NOT EXISTS or ON CONFLICT DO
 * NOTHING, so it is safe to run afterwards.
 *
 * On a fresh install the `users` table does not exist yet and this migration is a
 * no-op, leaving 001 to create everything as normal.
 *
 * The column list below was derived empirically: a reference database built by
 * running only 001 was diffed against a real v1 production database.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fresh install -> nothing to reconcile; 001 will create everything.
    const { rows } = await client.query(
      `SELECT to_regclass('public.users') IS NOT NULL AS is_existing`
    );
    if (!rows[0].is_existing) {
      await client.query('COMMIT');
      return;
    }

    // --- users: 17 columns from 001 -----------------------------------------
    // Note: currency/locale/preferred_currency are added WITHOUT the upstream
    // AUD/en-AU defaults. Back-filling those onto an existing install would
    // silently reinterpret every stored price, because v2 converts against them.
    // They are back-filled from observed data below instead.
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS currency                  VARCHAR(10),
        ADD COLUMN IF NOT EXISTS locale                    VARCHAR(10),
        ADD COLUMN IF NOT EXISTS preferred_currency        VARCHAR(10),
        ADD COLUMN IF NOT EXISTS categories                JSONB   DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS telegram_message_template TEXT,
        ADD COLUMN IF NOT EXISTS discord_message_template  TEXT,
        ADD COLUMN IF NOT EXISTS pushover_message_template TEXT,
        ADD COLUMN IF NOT EXISTS ntfy_message_template     TEXT,
        ADD COLUMN IF NOT EXISTS gotify_message_template   TEXT,
        ADD COLUMN IF NOT EXISTS email_enabled             BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS email_from                TEXT,
        ADD COLUMN IF NOT EXISTS email_to                  TEXT,
        ADD COLUMN IF NOT EXISTS email_subject_template    TEXT,
        ADD COLUMN IF NOT EXISTS email_body_template       TEXT,
        ADD COLUMN IF NOT EXISTS smtp_host                 TEXT,
        ADD COLUMN IF NOT EXISTS smtp_port                 INTEGER DEFAULT 587;
    `);

    // v1's webhook_body_template is v2's webhook_payload_template. Rename rather
    // than add, so a user's custom webhook body survives the upgrade.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='webhook_body_template')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='webhook_payload_template')
        THEN
          ALTER TABLE users RENAME COLUMN webhook_body_template TO webhook_payload_template;
        ELSE
          ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_payload_template TEXT;
        END IF;
      END $$;
    `);

    // Back-fill currency from what each user has actually recorded, rather than
    // imposing the upstream AUD default on every existing install.
    await client.query(`
      WITH user_currency AS (
        SELECT DISTINCT ON (p.user_id) p.user_id, h.currency
        FROM products p
        JOIN price_history h ON h.product_id = p.id
        WHERE h.currency IS NOT NULL
        GROUP BY p.user_id, h.currency
        ORDER BY p.user_id, count(*) DESC, h.currency
      )
      UPDATE users u
         SET currency           = COALESCE(uc.currency, 'USD'),
             preferred_currency = COALESCE(uc.currency, 'USD')
        FROM (SELECT id FROM users) allu
        LEFT JOIN user_currency uc ON uc.user_id = allu.id
       WHERE u.id = allu.id AND u.currency IS NULL;
    `);

    // --- products: 3 columns from 001 ---------------------------------------
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS ai_status  VARCHAR(20),
        ADD COLUMN IF NOT EXISTS category   TEXT,
        ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'standard';
    `);

    // --- price_history: 1 column from 001 -----------------------------------
    await client.query(`
      ALTER TABLE price_history
        ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'standard';
    `);

    // NOTE: v1's users.webhook_method has no v2 equivalent (v2's webhook sender is
    // POST-only). It is left in place rather than dropped, so the value survives if
    // configurable methods are ported forward later. It is simply unread by v2.

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  // Intentionally a no-op. Dropping these columns on a database that has since
  // been fully migrated by 002-022 would destroy live data; the forward path is
  // idempotent, so re-running up() is safe.
};
