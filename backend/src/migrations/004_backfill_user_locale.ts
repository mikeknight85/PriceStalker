import { MigrationContext } from '../config/migrate';

/**
 * Back-fill users.locale, which 000_v1_compat left NULL.
 *
 * 000 added `locale` without a default, deliberately avoiding v2's upstream
 * `en-AU` so that an install would not silently adopt Australian formatting.
 * That reasoning was right for `currency` -- v2 converts prices against it, so
 * a wrong value misreports money -- but wrong for `locale`, which only affects
 * how dates and numbers are rendered.
 *
 * The consequence was a crash: `Date#toLocaleDateString(null)` throws, and with
 * no error boundary that blanked the product price-history page for every
 * migrated user. The formatting helpers are now null-safe as well; this
 * migration removes the bad data rather than relying solely on that guard.
 *
 * Locale is derived from the currency each user already had derived for them,
 * so formatting matches the money they actually track. Anything unrecognised is
 * left NULL, which now means "use the browser's own locale" -- a better default
 * than imposing one.
 */
const CURRENCY_TO_LOCALE: Record<string, string> = {
  CHF: 'de-CH',
  EUR: 'de-DE',
  GBP: 'en-GB',
  USD: 'en-US',
  CAD: 'en-CA',
  AUD: 'en-AU',
  NZD: 'en-NZ',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  INR: 'en-IN',
  BRL: 'pt-BR',
  PLN: 'pl-PL',
  SEK: 'sv-SE',
  NOK: 'nb-NO',
  DKK: 'da-DK',
  KRW: 'ko-KR',
  RUB: 'ru-RU',
};

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [currency, locale] of Object.entries(CURRENCY_TO_LOCALE)) {
      await client.query(
        `UPDATE users SET locale = $1 WHERE locale IS NULL AND currency = $2`,
        [locale, currency]
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

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  // Intentionally a no-op. Reverting would mean deciding which locales were
  // set by this migration and which the user chose, and NULL is the state that
  // caused the original crash.
};
