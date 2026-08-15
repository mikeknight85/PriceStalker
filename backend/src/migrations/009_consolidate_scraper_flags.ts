import { MigrationContext } from '../config/migrate';

/**
 * Consolidates the legacy use_browser / is_js_heavy / use_remote_scraper flags
 * into a single use_browser_scraper flag. All three legacy flags routed to the
 * same remote-scraper acquisition path, so the OR of them is behaviourally
 * identical.
 *
 * The legacy columns are intentionally NOT dropped here: production tracks the
 * :beta tag and may need to roll back to an image that still writes them, so
 * one shipped release must tolerate both schemas. A later migration removes
 * the columns once no supported image writes them.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE public.retailer_configs
      ADD COLUMN IF NOT EXISTS use_browser_scraper boolean DEFAULT false;
    `);

    // OR each legacy flag into the consolidated one, guarding on column
    // existence so the migration survives databases where the legacy columns
    // were already removed (restored dumps, partly-migrated schemas).
    await client.query(`
      DO $$
      DECLARE
        legacy_column text;
      BEGIN
        FOREACH legacy_column IN ARRAY ARRAY['use_browser', 'is_js_heavy', 'use_remote_scraper']
        LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'retailer_configs'
              AND column_name = legacy_column
          ) THEN
            EXECUTE format(
              'UPDATE public.retailer_configs
               SET use_browser_scraper = COALESCE(use_browser_scraper, false) OR COALESCE(%I, false)',
              legacy_column
            );
          END IF;
        END LOOP;
      END $$;
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
      ALTER TABLE public.retailer_configs
      ADD COLUMN IF NOT EXISTS use_browser boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_js_heavy boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS use_remote_scraper boolean DEFAULT false;
    `);

    // Lossy on purpose: the original three-way distinction is discarded by up,
    // so restore sets all three flags wherever the consolidated flag was set.
    // A subsequent up ORs them back to the same consolidated value.
    await client.query(`
      UPDATE public.retailer_configs
      SET use_browser = use_browser_scraper,
          is_js_heavy = use_browser_scraper,
          use_remote_scraper = use_browser_scraper;
    `);

    await client.query(`
      ALTER TABLE public.retailer_configs
      DROP COLUMN IF EXISTS use_browser_scraper;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
