import { MigrationContext } from '../config/migrate';

/**
 * Phrases the browser scraper waits out as challenge interstitials.
 *
 * These are *phrases*, matched against the document title and against the page
 * body only when the body is small enough to be a wall page rather than a
 * product page (`scraper/src/utils/challenge.ts`). That scoping is why
 * "press and hold" and "access denied" can be on this list at all: both are
 * ordinary product copy and SPA i18n strings on working pages, and an unscoped
 * match against a 1.6MB DOM would put every scrape of those retailers into the
 * auto-resolve loop.
 *
 * Deliberately *not* seeded here: `datadome`, `perimeterx` and
 * `captcha-delivery`. The first two are the vendors' own sensor scripts, which
 * the edge injects into every protected page and not only into challenges --
 * the same mistake as matching Akamai's `/akam/<n>/pixel_` on its own, which
 * `transport/detection.ts` documents and #226 deliberately avoided. The
 * challenge-only markers (`px-captcha`, `geo.captcha-delivery`, `dd-captcha`)
 * live in the scraper's code instead, because they are facts about the vendors
 * rather than something an administrator should have to maintain.
 */
const DEFAULT_CHALLENGE_PHRASES = JSON.stringify([
  'are you a robot',
  'just a moment',
  'access denied',
  'verify you are human',
  'pardon our interruption',
  'security check',
  'attention required',
  'access is temporarily restricted',
  'unusual activity',
  'access to this page has been denied',
  'press & hold',
  'press and hold',
]);

/**
 * Seeds `generic_challenge_phrases` into `system_settings` so challenge detection
 * phrases are configurable by administrators without container rebuilds.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO system_settings (key, value)
      VALUES (
        'generic_challenge_phrases',
        $1
      )
      ON CONFLICT (key) DO NOTHING;
    `,
      [DEFAULT_CHALLENGE_PHRASES]
    );

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
      DELETE FROM system_settings
      WHERE key = 'generic_challenge_phrases';
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
