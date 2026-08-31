import { MigrationContext } from '../config/migrate';

/**
 * Records why a product is unavailable, and who paused it (issue #73).
 *
 * Three gaps this closes:
 *
 * 1. **No reason was stored.** A product went to `not_available` and the
 *    notification history said "404/410" regardless of whether the page had
 *    actually 404'd, redirected to the home page, or served a soft 404.
 *
 * 2. **Site failures were invisible.** A timeout, DNS failure or refused
 *    connection produced `unknown`, which preserved the previous status,
 *    incremented nothing and recorded nothing. A retailer could be down for a
 *    week with no trace on the product.
 *
 * 3. **A pause had no author.** `checking_paused` is set both by a user and by
 *    the system after a page-gone streak, and nothing distinguished them, so the
 *    UI could not say whether monitoring stopped by choice or by failure.
 *
 * All three columns are nullable or defaulted, so existing rows are unaffected
 * and an image rollback leaves nothing broken.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS unavailable_reason text,
      ADD COLUMN IF NOT EXISTS auto_paused boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS failure_streak integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_failure_at timestamp with time zone;
  `);

  // A product already paused and already marked unavailable was paused by the
  // system, since that is the only way both become true together. Backfilling
  // this one inference is safe and stops existing unavailable products showing
  // as though a user had paused them.
  await pool.query(`
    UPDATE public.products
       SET auto_paused = true
     WHERE checking_paused = true
       AND stock_status = 'not_available'
       AND auto_paused = false;
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.products
      DROP COLUMN IF EXISTS unavailable_reason,
      DROP COLUMN IF EXISTS auto_paused,
      DROP COLUMN IF EXISTS failure_streak,
      DROP COLUMN IF EXISTS last_failure_at;
  `);
};
