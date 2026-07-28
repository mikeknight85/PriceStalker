import { MigrationContext } from '../config/migrate';

/**
 * Add Iceland to the deliberately curated regional currency reference data.
 *
 * ISK is supported by the application's exchange-rate provider, but was
 * absent from the original reference seed. The migration only inserts missing
 * rows so installations with locally maintained reference data are untouched.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO global_currencies
         (country_territory, currency_name, iso, symbol, locale, separation, position)
       SELECT 'Iceland', 'Icelandic Króna', 'ISK', 'kr', 'is-IS', ',', 'after'
       WHERE NOT EXISTS (SELECT 1 FROM global_currencies WHERE iso = 'ISK')`
    );

    await client.query(
      `INSERT INTO regional_currency_mappings (pattern, currency, match_type, active)
       SELECT '.is', 'ISK', 'tld', true
       WHERE NOT EXISTS (SELECT 1 FROM regional_currency_mappings WHERE pattern = '.is')`
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  // Intentionally a no-op. These rows are reference data and may be relied on
  // by existing user settings or retailer mappings after the migration runs.
};
