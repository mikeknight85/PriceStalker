import { MigrationContext } from '../config/migrate';

/**
 * Seed the currency reference tables.
 *
 * `global_currencies` and `regional_currency_mappings` are read-only to the
 * application -- nothing in the codebase ever inserts into them. Upstream they
 * were populated by hand in a live database, and `database/init.sql` was a
 * schema-only dump, so the rows existed nowhere in the repository. A fresh
 * install therefore came up with both tables empty, which leaves the
 * Account Settings -> Regional currency picker with nothing to offer and stops
 * the scraper inferring a currency from a site's domain.
 *
 * Seeded here so the data is version-controlled rather than being something an
 * operator has to know to insert.
 *
 * Idempotent: rows are keyed on `iso` / `pattern`, so an install that already
 * has this data (including the one these values were reconstructed for) is
 * untouched, and an operator's own additions survive.
 *
 * `separation` records the decimal separator and `position` whether the symbol
 * leads or trails. Neither is read by the current code -- the display path uses
 * Intl with the locale -- but both are part of the table's contract.
 */
type Currency = [
  country: string,
  name: string,
  iso: string,
  symbol: string,
  locale: string,
  separation: string,
  position: string,
];

const CURRENCIES: Currency[] = [
  ['Switzerland', 'Swiss Franc', 'CHF', 'CHF', 'de-CH', '.', 'before'],
  ['United States', 'US Dollar', 'USD', '$', 'en-US', '.', 'before'],
  ['Eurozone', 'Euro', 'EUR', '€', 'de-DE', ',', 'after'],
  ['United Kingdom', 'Pound Sterling', 'GBP', '£', 'en-GB', '.', 'before'],
  ['Australia', 'Australian Dollar', 'AUD', 'A$', 'en-AU', '.', 'before'],
  ['Canada', 'Canadian Dollar', 'CAD', 'C$', 'en-CA', '.', 'before'],
  ['New Zealand', 'New Zealand Dollar', 'NZD', 'NZ$', 'en-NZ', '.', 'before'],
  ['Japan', 'Japanese Yen', 'JPY', '¥', 'ja-JP', '.', 'before'],
  ['China', 'Chinese Yuan', 'CNY', '¥', 'zh-CN', '.', 'before'],
  ['India', 'Indian Rupee', 'INR', '₹', 'en-IN', '.', 'before'],
  ['Brazil', 'Brazilian Real', 'BRL', 'R$', 'pt-BR', ',', 'before'],
  ['Mexico', 'Mexican Peso', 'MXN', 'MX$', 'es-MX', '.', 'before'],
  ['Poland', 'Polish Zloty', 'PLN', 'zl', 'pl-PL', ',', 'after'],
  ['Sweden', 'Swedish Krona', 'SEK', 'kr', 'sv-SE', ',', 'after'],
  ['Norway', 'Norwegian Krone', 'NOK', 'kr', 'nb-NO', ',', 'after'],
  ['Denmark', 'Danish Krone', 'DKK', 'kr', 'da-DK', ',', 'after'],
  ['Czechia', 'Czech Koruna', 'CZK', 'Kc', 'cs-CZ', ',', 'after'],
  ['Hungary', 'Hungarian Forint', 'HUF', 'Ft', 'hu-HU', ',', 'after'],
  ['Romania', 'Romanian Leu', 'RON', 'lei', 'ro-RO', ',', 'after'],
  ['Turkey', 'Turkish Lira', 'TRY', '₺', 'tr-TR', ',', 'before'],
  ['Russia', 'Russian Ruble', 'RUB', '₽', 'ru-RU', ',', 'after'],
  ['South Korea', 'South Korean Won', 'KRW', '₩', 'ko-KR', '.', 'before'],
  ['Singapore', 'Singapore Dollar', 'SGD', 'S$', 'en-SG', '.', 'before'],
  ['Hong Kong', 'Hong Kong Dollar', 'HKD', 'HK$', 'zh-HK', '.', 'before'],
  ['South Africa', 'South African Rand', 'ZAR', 'R', 'en-ZA', ',', 'before'],
  ['Israel', 'Israeli New Shekel', 'ILS', '₪', 'he-IL', '.', 'before'],
  ['United Arab Emirates', 'UAE Dirham', 'AED', 'AED', 'ar-AE', '.', 'before'],
  ['Thailand', 'Thai Baht', 'THB', '฿', 'th-TH', '.', 'before'],
  ['Malaysia', 'Malaysian Ringgit', 'MYR', 'RM', 'ms-MY', '.', 'before'],
  ['Philippines', 'Philippine Peso', 'PHP', '₱', 'en-PH', '.', 'before'],
  ['Indonesia', 'Indonesian Rupiah', 'IDR', 'Rp', 'id-ID', ',', 'before'],
  ['Vietnam', 'Vietnamese Dong', 'VND', '₫', 'vi-VN', ',', 'after'],
  ['Chile', 'Chilean Peso', 'CLP', 'CLP$', 'es-CL', ',', 'before'],
  ['Argentina', 'Argentine Peso', 'ARS', 'ARS$', 'es-AR', ',', 'before'],
  ['Colombia', 'Colombian Peso', 'COP', 'COP$', 'es-CO', ',', 'before'],
  ['Ukraine', 'Ukrainian Hryvnia', 'UAH', '₴', 'uk-UA', ',', 'after'],
];

/**
 * Domain suffix -> currency, used to infer a price's currency from the site it
 * was scraped from. Matched against the hostname, so `.de` also covers
 * `shop.example.de`.
 */
const TLD_MAPPINGS: [pattern: string, currency: string][] = [
  ['.ch', 'CHF'], ['.li', 'CHF'],
  ['.de', 'EUR'], ['.at', 'EUR'], ['.fr', 'EUR'], ['.it', 'EUR'], ['.es', 'EUR'],
  ['.nl', 'EUR'], ['.be', 'EUR'], ['.ie', 'EUR'], ['.pt', 'EUR'], ['.fi', 'EUR'],
  ['.gr', 'EUR'], ['.sk', 'EUR'], ['.si', 'EUR'], ['.ee', 'EUR'], ['.lv', 'EUR'],
  ['.lt', 'EUR'], ['.lu', 'EUR'], ['.cy', 'EUR'], ['.mt', 'EUR'],
  ['.uk', 'GBP'], ['.co.uk', 'GBP'],
  ['.com.au', 'AUD'], ['.au', 'AUD'],
  ['.ca', 'CAD'], ['.co.nz', 'NZD'], ['.nz', 'NZD'],
  ['.jp', 'JPY'], ['.co.jp', 'JPY'], ['.cn', 'CNY'], ['.in', 'INR'],
  ['.br', 'BRL'], ['.com.br', 'BRL'], ['.mx', 'MXN'], ['.com.mx', 'MXN'],
  ['.pl', 'PLN'], ['.se', 'SEK'], ['.no', 'NOK'], ['.dk', 'DKK'],
  ['.cz', 'CZK'], ['.hu', 'HUF'], ['.ro', 'RON'], ['.tr', 'TRY'],
  ['.ru', 'RUB'], ['.kr', 'KRW'], ['.co.kr', 'KRW'],
  ['.sg', 'SGD'], ['.hk', 'HKD'], ['.za', 'ZAR'], ['.co.za', 'ZAR'],
  ['.il', 'ILS'], ['.ae', 'AED'], ['.th', 'THB'], ['.my', 'MYR'],
  ['.ph', 'PHP'], ['.id', 'IDR'], ['.vn', 'VND'],
  ['.cl', 'CLP'], ['.ar', 'ARS'], ['.com.ar', 'ARS'], ['.co', 'COP'], ['.ua', 'UAH'],
];

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [country, name, iso, symbol, locale, separation, position] of CURRENCIES) {
      await client.query(
        `INSERT INTO global_currencies
           (country_territory, currency_name, iso, symbol, locale, separation, position)
         SELECT $1, $2, $3::varchar, $4, $5, $6::varchar, $7::varchar
         WHERE NOT EXISTS (SELECT 1 FROM global_currencies WHERE iso = $3::varchar)`,
        [country, name, iso, symbol, locale, separation, position]
      );
    }

    for (const [pattern, currency] of TLD_MAPPINGS) {
      await client.query(
        `INSERT INTO regional_currency_mappings (pattern, currency, match_type, active)
         SELECT $1::varchar, $2::varchar, 'tld', true
         WHERE NOT EXISTS (SELECT 1 FROM regional_currency_mappings WHERE pattern = $1::varchar)`,
        [pattern, currency]
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
  // Intentionally a no-op. Removing these rows would break currency selection
  // and re-create the empty-dropdown bug, and there is no way to tell seeded
  // rows apart from ones an operator has since edited.
};
