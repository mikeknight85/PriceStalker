import { MigrationContext } from '../config/migrate';

/**
 * Seeds recommendation/carousel exclusion selectors and marketplace multi-seller
 * out-of-stock phrases into system_settings, and repairs unscoped Amazon price selectors
 * (issues #236, #283).
 *
 * 1. generic_exclusion_selectors:
 *    Prunes recommendation carousels, sponsored items, related products, and accessory
 *    widgets before candidate extraction runs.
 *
 * 2. generic_out_of_stock_phrases:
 *    Adds marketplace multi-seller / buying option phrases ("see all buying options",
 *    "available from these sellers", etc.) so suppressed buy-box pages are recognized
 *    as out-of-stock rather than extracting unrelated carousel prices.
 *
 * 3. retailer_configs Amazon price selector repair:
 *    Replaces bare un-scoped `.a-offscreen` utility selectors on Amazon domains with
 *    properly scoped buy-box price selectors.
 */

const NEW_EXCLUSION_SELECTORS = [
  '.site-wide-ad',
  '[class*="carousel" i]',
  '[class*="recommendation" i]',
  '[class*="sponsored" i]',
  '[class*="similar-products" i]',
  '[class*="related-products" i]',
  '[id*="recommendations" i]',
  '[id*="similarities" i]',
  '[id*="bundle" i]',
  '[id*="accessory" i]',
  '#desktop-dp-sims_purchase-similarities-sims-feature',
  '#sp_detail',
  '#sp_detail2',
  '#rhf',
  '#huc-v2-subcart-feature-div'
];

const NEW_OOS_PHRASES = [
  'out of stock',
  'sold out',
  'unavailable',
  'currently unavailable',
  'not available',
  'backorder',
  'back-order',
  'notify me when available',
  'coming soon',
  'temporarily out of stock',
  'see all buying options',
  'available from these sellers',
  'buying options',
  'other sellers on',
  'view all offers',
  'options from',
  'discontinued',
  'nicht lieferbar'
];

const REPAIRED_AMAZON_PRICE_SELECTORS = JSON.stringify([
  '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
  '.apex-pricetopay-value .a-offscreen',
  '#corePrice_feature_div .a-price .a-offscreen',
  '#tp_price_block_total_price_ww .a-price .a-offscreen'
]);

function mergeArrays(existingJson: string | null | undefined, toMerge: string[]): string {
  let list: string[] = [];
  if (existingJson) {
    try {
      const parsed = JSON.parse(existingJson);
      if (Array.isArray(parsed)) {
        list = parsed.filter(item => typeof item === 'string');
      }
    } catch {
      // If unparseable, start with empty list
    }
  }

  for (const item of toMerge) {
    if (!list.includes(item)) {
      list.push(item);
    }
  }

  return JSON.stringify(list);
}

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Merge generic_exclusion_selectors
    const exclRes = await client.query(
      `SELECT value FROM system_settings WHERE key = 'generic_exclusion_selectors'`
    );
    const updatedExclusions = mergeArrays(exclRes.rows[0]?.value, NEW_EXCLUSION_SELECTORS);

    await client.query(
      `
      INSERT INTO system_settings (key, value)
      VALUES ('generic_exclusion_selectors', $1)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value;
      `,
      [updatedExclusions]
    );

    // 2. Merge generic_out_of_stock_phrases
    const oosRes = await client.query(
      `SELECT value FROM system_settings WHERE key = 'generic_out_of_stock_phrases'`
    );
    const updatedOos = mergeArrays(oosRes.rows[0]?.value, NEW_OOS_PHRASES);

    await client.query(
      `
      INSERT INTO system_settings (key, value)
      VALUES ('generic_out_of_stock_phrases', $1)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value;
      `,
      [updatedOos]
    );

    // 3. Repair Amazon retailer configs that have bare or un-scoped .a-offscreen
    await client.query(
      `
      UPDATE retailer_configs
      SET price_selectors = $1
      WHERE domain ILIKE '%amazon%'
        AND (
          price_selectors::text = '[".a-offscreen"]'
          OR (price_selectors::text LIKE '%.a-offscreen%' AND NOT (price_selectors::text LIKE '%corePrice%'))
        );
      `,
      [REPAIRED_AMAZON_PRICE_SELECTORS]
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
    // Idempotent no-op for down: settings and healed selectors remain safe
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
