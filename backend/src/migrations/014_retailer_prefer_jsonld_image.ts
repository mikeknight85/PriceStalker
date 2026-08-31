import { MigrationContext } from '../config/migrate';

/**
 * Per-retailer override for the JSON-LD image preference (issue #103).
 *
 * `prefer_jsonld_image` was a single system-wide setting, so a retailer whose
 * structured data points at a directory, a thumbnail or an outright invalid
 * asset could not be excluded without turning JSON-LD preference off for every
 * retailer.
 *
 * The column is deliberately nullable, giving three states rather than two:
 *
 *   true   prefer JSON-LD images for this retailer
 *   false  prefer the configured CSS/generic selectors for this retailer
 *   NULL   inherit the global prefer_jsonld_image setting
 *
 * NULL is the default, so every existing retailer keeps behaving exactly as it
 * does today and the global setting stays in charge until an administrator
 * deliberately overrides one retailer.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.retailer_configs
    ADD COLUMN IF NOT EXISTS prefer_jsonld_image boolean;
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.retailer_configs
    DROP COLUMN IF EXISTS prefer_jsonld_image;
  `);
};
