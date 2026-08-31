import { MigrationContext } from '../config/migrate';

/**
 * Repairs selector settings that 001_baseline stored as invalid JSON, and
 * broadens the image evidence shown to AI auto-mapping.
 *
 * 001_baseline seeds system_settings with Postgres E'' escape strings. In an
 * E'' string \" is an escape sequence meaning a bare quote, so the JSON
 * escaping was stripped on the way in and any selector containing a quoted
 * attribute was stored unparseable:
 *
 *   stored:   ["link[rel="preload"][as="image"]", ...]
 *   intended: ["link[rel=\"preload\"][as=\"image\"]", ...]
 *
 * 006_seed_generic_selectors only writes rows whose value IS NULL, so it never
 * repaired them, and SettingsCache.getArray silently swallows the parse error
 * and falls back to its hardcoded default. The result was invisible:
 *
 *   generic_stock_selectors      12 seeded entries -> 5 hardcoded fallbacks
 *   generic_ai_image_selectors    9 seeded entries -> 9 narrower fallbacks
 *   generic_ai_price_selectors    9 seeded entries -> 9 hardcoded fallbacks
 *
 * Stock detection has therefore been running on the reduced generic set on every
 * install, and AI auto-mapping was shown a narrower set of image candidates than
 * extraction actually uses -- the cause of the over-specific learned image
 * selectors in issue #101.
 *
 * Validity is checked in TypeScript rather than SQL: the IS JSON predicate needs
 * Postgres 16, and a cast inside a WHERE is evaluated against rows the key
 * filter has not excluded yet, which fails the whole statement on the first bad
 * row. Values are written as bind parameters, which is what avoids the escaping
 * problem that caused this in the first place.
 *
 * Only unparseable rows are rewritten. Anything an administrator has edited into
 * valid JSON is left exactly as it is.
 */

const CANONICAL_ARRAYS: Record<string, string[]> = {
  "generic_ai_image_selectors": [
    "link[rel=\"preload\"][as=\"image\"]",
    "[itemprop=\"image\"]",
    "[property=\"og:image\"]",
    "img#landingImage",
    "img#main-image",
    "img.main-image",
    "img.hero-image",
    "img[class*=\"product-image\" i]",
    "img[class*=\"product__image\" i]",
    "img[class*=\"product\" i]",
    "img[class*=\"gallery\" i]",
    "img[data-testid*=\"image\" i]",
    "[data-automation-test-id*=\"image\" i]",
    "[data-testid*=\"image\" i]",
    ".product-image img",
    ".main-image img",
    "[data-zoom-image]"
  ],
  "generic_ai_price_selectors": [
    "[class*=\"price\" i]",
    "[class*=\"Price\" i]",
    "[data-testid*=\"price\" i]",
    "[data-automation*=\"price\" i]",
    "[data-automation*=\"Price\" i]",
    "[itemprop=\"price\"]",
    "[data-price]",
    "[data-price-amount]",
    "[data-product-price]"
  ],
  "generic_deal_price_selectors": [
    ".price-item--sale",
    ".special-price .price",
    ".sale-price",
    ".deal-price"
  ],
  "generic_exclusion_selectors": [
    ".site-wide-ad"
  ],
  "generic_image_selectors": [
    "[itemprop=\"image\"]",
    "[property=\"og:image\"]",
    "link[rel=\"preload\"][as=\"image\"]",
    "[data-automation-test-id*=\"image\" i]",
    "[data-testid*=\"image\" i]",
    ".product-image img",
    ".main-image img",
    "[data-zoom-image]",
    "img[class*=\"product\"]",
    ".productthumbnail::attr(src)"
  ],
  "generic_in_stock_phrases": [
    "in stock",
    "instock",
    "add to cart",
    "add to basket",
    "add to bag",
    "buy now",
    "available now",
    "add to trolley",
    "clearance",
    "on sale",
    "special offer",
    "limited stock",
    "available",
    "ready to ship",
    "dispatched within",
    "dispatched from"
  ],
  "generic_member_price_selectors": [
    ".member-price",
    ".perks-price",
    ".club-price"
  ],
  "generic_name_selectors": [
    "meta[property=\"og:title\"]::attr(content)",
    "meta[name=\"twitter:title\"]::attr(content)",
    "[itemprop=\"name\"]",
    "[data-automation-test-id*=\"title\" i]",
    "[data-automation-test-id*=\"name\" i]",
    "[data-testid*=\"title\" i]",
    "[data-testid*=\"name\" i]",
    "h1[class*=\"product\"]",
    "h1[class*=\"title\"]",
    ".product-title",
    "h1"
  ],
  "generic_original_price_selectors": [
    ".rrp",
    ".was-price",
    ".price-item--regular",
    ".old-price",
    "[class*=\"original\" i]",
    "[class*=\"rrp\" i]",
    "[class*=\"was-price\" i]",
    "[data-testid*=\"strikethrough-price\"]"
  ],
  "generic_out_of_stock_phrases": [
    "out of stock",
    "sold out",
    "currently unavailable",
    "not available",
    "backorder",
    "back-order",
    "notify me when available",
    "coming soon"
  ],
  "generic_pre_order_phrases": [
    "pre-order",
    "preorder",
    "available starting",
    "expected to ship",
    "release date",
    "pre-ordering"
  ],
  "generic_pre_order_price_selectors": [
    "[class*=\"preorder-price\" i]",
    "[class*=\"pre-order-price\" i]",
    "[data-testid*=\"preorder-price\" i]",
    "[data-testid*=\"pre-order-price\" i]",
    "[id*=\"preorder-price\" i]"
  ],
  "generic_price_selectors": [
    "meta[itemprop=\"lowPrice\"]::attr(content)",
    "[itemprop=\"lowPrice\"]",
    "[itemprop=\"price\"]",
    "meta[property=\"product:price:amount\"]::attr(content)",
    "meta[property=\"og:price:amount\"]::attr(content)",
    "[data-price-type=\"finalPrice\"] .price",
    "[data-price-amount]",
    "[data-product-price]",
    "[data-test=\"price\"]",
    "[data-test=\"product-price\"]",
    "[data-test=\"current-price\"]",
    "[data-automation-test-id*=\"price\" i]",
    "[data-testid*=\"price\" i]",
    "[data-test-id*=\"price\" i]",
    ".price-item--sale",
    ".price-item--regular",
    ".woocommerce-Price-amount.amount",
    ".summary .price .amount",
    "[data-price]",
    "[data-price-amount]",
    ".price-box .price",
    ".special-price .price",
    ".price",
    ".product-price",
    ".current-price",
    ".sale-price",
    ".final-price",
    ".offer-price",
    "#price",
    "[class*=\"price\" i]"
  ],
  "generic_retailer_name_selectors": [
    "meta[property=\"og:site_name\"]::attr(content)",
    "meta[name=\"application-name\"]::attr(content)",
    "[itemprop=\"brand\"] [itemprop=\"name\"]",
    "[itemprop=\"brand\"]::attr(content)",
    "a[class*=\"logo\" i]::attr(aria-label)",
    "a[id*=\"logo\" i]::attr(aria-label)"
  ],
  "generic_stock_selectors": [
    "[itemprop=\"availability\"]",
    ".stock-status",
    ".availability",
    "[data-automation-test-id*=\"stock\" i]",
    "[data-automation-test-id*=\"availability\" i]",
    "[data-automation-test-id*=\"buy-box\" i]",
    "[data-testid*=\"stock\" i]",
    "[data-testid*=\"availability\" i]",
    "[data-test-id*=\"stock\" i]",
    "[data-test-id*=\"availability\" i]",
    "[class*=\"stock-status\" i]",
    "[class*=\"availability\" i]"
  ]
};

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const keys = Object.keys(CANONICAL_ARRAYS);
    const { rows } = await client.query<{ key: string; value: string | null }>(
      'SELECT key, value FROM system_settings WHERE key = ANY($1::text[])',
      [keys]
    );

    const stored = new Map(rows.map((r) => [r.key, r.value]));

    for (const key of keys) {
      const canonical = JSON.stringify(CANONICAL_ARRAYS[key]);

      if (!stored.has(key)) {
        await client.query(
          'INSERT INTO system_settings (key, value) VALUES ($1, $2::text) ON CONFLICT (key) DO NOTHING',
          [key, canonical]
        );
        continue;
      }

      const value = stored.get(key);
      let parsable = false;
      if (value !== null && value !== undefined) {
        try {
          parsable = Array.isArray(JSON.parse(value));
        } catch {
          parsable = false;
        }
      }

      if (!parsable) {
        await client.query(
          'UPDATE system_settings SET value = $1::text, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
          [canonical, key]
        );
      }
    }

    // #101: broaden the AI image evidence even where the row is already valid.
    // Only replace the original narrow seed, so a tuned list is preserved.
    const NARROW_AI_IMAGE = [
      'link[rel="preload"][as="image"]',
      'img#landingImage',
      'img#main-image',
      'img.main-image',
      'img.hero-image',
      'img[class*="product-image" i]',
      'img[class*="product__image" i]',
      'img[class*="gallery" i]',
      'img[data-testid*="image" i]',
    ];
    const current = await client.query<{ value: string | null }>(
      'SELECT value FROM system_settings WHERE key = $1',
      ['generic_ai_image_selectors']
    );
    if (current.rows.length > 0 && current.rows[0].value) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(current.rows[0].value);
      } catch {
        parsed = null;
      }
      if (Array.isArray(parsed) && JSON.stringify(parsed) === JSON.stringify(NARROW_AI_IMAGE)) {
        await client.query(
          'UPDATE system_settings SET value = $1::text, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
          [JSON.stringify(CANONICAL_ARRAYS.generic_ai_image_selectors), 'generic_ai_image_selectors']
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  // Intentionally a no-op: restoring unparseable JSON serves nothing.
};
