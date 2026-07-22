import { MigrationContext } from '../config/migrate';

/**
 * Seed the generic (retailer-agnostic) extraction selectors.
 *
 * These `generic_*` settings are the default selector ruleset the scraper uses
 * for any site without a per-domain `retailer_configs` row. The code has a
 * hardcoded fallback, but it is minimal; the real, tuned defaults lived only in
 * the upstream author's production database and were never in the repo -- the
 * same "reference data isn't schema" gap that left the currency tables empty.
 *
 * The consequence was thin extraction on unconfigured sites: `generic_price_
 * selectors` did not exist in the database at all, so the generic-CSS price
 * tier fell back to the simple hardcoded list and frequently found nothing --
 * a likely cause of "Cannot Extract Price" on new domains.
 *
 * Values are the upstream author's tuned production set (selectors and phrases
 * only -- no credentials, keys, or infrastructure URLs were imported).
 *
 * Safe and idempotent: inserts a missing key, and fills a key whose stored
 * value is empty (`''`, `'[]'`, or NULL), but never overwrites a non-empty
 * existing value -- so an admin's customised selectors in Admin -> Global
 * Selectors are preserved, and re-running changes nothing.
 */
const GENERIC_DEFAULTS: [string, string][] = [
  ["default_referrer", "https://www.google.com/"],
  ["default_user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"],
  ["generic_ai_image_selectors", "[\"link[rel=\\\"preload\\\"][as=\\\"image\\\"]\",\"img#landingImage\",\"img#main-image\",\"img.main-image\",\"img.hero-image\",\"img[class*=\\\"product-image\\\" i]\",\"img[class*=\\\"product__image\\\" i]\",\"img[class*=\\\"gallery\\\" i]\",\"img[data-testid*=\\\"image\\\" i]\"]"],
  ["generic_ai_price_selectors", "[\"[class*=\\\"price\\\" i]\",\"[class*=\\\"Price\\\" i]\",\"[data-testid*=\\\"price\\\" i]\",\"[data-automation*=\\\"price\\\" i]\",\"[data-automation*=\\\"Price\\\" i]\",\"[itemprop=\\\"price\\\"]\",\"[data-price]\",\"[data-price-amount]\",\"[data-product-price]\"]"],
  ["generic_deal_price_selectors", "[\".price-item--sale\",\".special-price .price\",\".sale-price\",\".deal-price\"]"],
  ["generic_exclusion_selectors", "[\".site-wide-ad\"]"],
  ["generic_image_selectors", "[\"[itemprop=\\\"image\\\"]\",\"[property=\\\"og:image\\\"]\",\"link[rel=\\\"preload\\\"][as=\\\"image\\\"]\",\"[data-automation-test-id*=\\\"image\\\" i]\",\"[data-testid*=\\\"image\\\" i]\",\".product-image img\",\".main-image img\",\"[data-zoom-image]\",\"img[class*=\\\"product\\\"]\",\".productthumbnail::attr(src)\"]"],
  ["generic_in_stock_phrases", "[\"in stock\",\"instock\",\"add to cart\",\"add to basket\",\"add to bag\",\"buy now\",\"available now\",\"add to trolley\",\"clearance\",\"on sale\",\"special offer\",\"limited stock\",\"available\",\"ready to ship\",\"dispatched within\",\"dispatched from\"]"],
  ["generic_member_price_selectors", "[\".member-price\",\".perks-price\",\".club-price\"]"],
  ["generic_name_selectors", "[\"meta[property=\\\"og:title\\\"]::attr(content)\",\"meta[name=\\\"twitter:title\\\"]::attr(content)\",\"[itemprop=\\\"name\\\"]\",\"[data-automation-test-id*=\\\"title\\\" i]\",\"[data-automation-test-id*=\\\"name\\\" i]\",\"[data-testid*=\\\"title\\\" i]\",\"[data-testid*=\\\"name\\\" i]\",\"h1[class*=\\\"product\\\"]\",\"h1[class*=\\\"title\\\"]\",\".product-title\",\"h1\"]"],
  ["generic_original_price_selectors", "[\".rrp\",\".was-price\",\".price-item--regular\",\".old-price\",\"[class*=\\\"original\\\" i]\",\"[class*=\\\"rrp\\\" i]\",\"[class*=\\\"was-price\\\" i]\",\"[data-testid*=\\\"strikethrough-price\\\"]\"]"],
  ["generic_out_of_stock_phrases", "[\"out of stock\",\"sold out\",\"currently unavailable\",\"not available\",\"backorder\",\"back-order\",\"notify me when available\",\"coming soon\"]"],
  ["generic_pre_order_phrases", "[\"pre-order\",\"preorder\",\"available starting\",\"expected to ship\",\"release date\",\"pre-ordering\"]"],
  ["generic_pre_order_price_selectors", "[\"[class*=\\\"preorder-price\\\" i]\",\"[class*=\\\"pre-order-price\\\" i]\",\"[data-testid*=\\\"preorder-price\\\" i]\",\"[data-testid*=\\\"pre-order-price\\\" i]\",\"[id*=\\\"preorder-price\\\" i]\"]"],
  ["generic_price_selectors", "[\"meta[itemprop=\\\"lowPrice\\\"]::attr(content)\",\"[itemprop=\\\"lowPrice\\\"]\",\"[itemprop=\\\"price\\\"]\",\"meta[property=\\\"product:price:amount\\\"]::attr(content)\",\"meta[property=\\\"og:price:amount\\\"]::attr(content)\",\"[data-price-type=\\\"finalPrice\\\"] .price\",\"[data-price-amount]\",\"[data-product-price]\",\"[data-test=\\\"price\\\"]\",\"[data-test=\\\"product-price\\\"]\",\"[data-test=\\\"current-price\\\"]\",\"[data-automation-test-id*=\\\"price\\\" i]\",\"[data-testid*=\\\"price\\\" i]\",\"[data-test-id*=\\\"price\\\" i]\",\".price-item--sale\",\".price-item--regular\",\".woocommerce-Price-amount.amount\",\".summary .price .amount\",\"[data-price]\",\"[data-price-amount]\",\".price-box .price\",\".special-price .price\",\".price\",\".product-price\",\".current-price\",\".sale-price\",\".final-price\",\".offer-price\",\"#price\",\"[class*=\\\"price\\\" i]\"]"],
  ["generic_retailer_name_selectors", "[\"meta[property=\\\"og:site_name\\\"]::attr(content)\",\"meta[name=\\\"application-name\\\"]::attr(content)\",\"[itemprop=\\\"brand\\\"] [itemprop=\\\"name\\\"]\",\"[itemprop=\\\"brand\\\"]::attr(content)\",\"a[class*=\\\"logo\\\" i]::attr(aria-label)\",\"a[id*=\\\"logo\\\" i]::attr(aria-label)\"]"],
  ["generic_stock_selectors", "[\"[itemprop=\\\"availability\\\"]\",\".stock-status\",\".availability\",\"[data-automation-test-id*=\\\"stock\\\" i]\",\"[data-automation-test-id*=\\\"availability\\\" i]\",\"[data-automation-test-id*=\\\"buy-box\\\" i]\",\"[data-testid*=\\\"stock\\\" i]\",\"[data-testid*=\\\"availability\\\" i]\",\"[data-test-id*=\\\"stock\\\" i]\",\"[data-test-id*=\\\"availability\\\" i]\",\"[class*=\\\"stock-status\\\" i]\",\"[class*=\\\"availability\\\" i]\"]"],
  ["jsonld_image_key", "image"],
  ["jsonld_name_key", "name"],
  ["jsonld_price_key", "price"],
  ["prefer_jsonld_image", "true"],
];

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of GENERIC_DEFAULTS) {
      await client.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
         WHERE system_settings.value IS NULL
            OR system_settings.value = ''
            OR system_settings.value = '[]'`,
        [key, value]
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
  // Intentionally a no-op: removing these would break extraction and there is
  // no way to distinguish seeded rows from admin-edited ones.
};
