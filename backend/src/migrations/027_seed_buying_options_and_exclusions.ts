import { MigrationContext } from '../config/migrate';

/**
 * Seeds recommendation/carousel exclusion selectors and marketplace multi-seller
 * out-of-stock phrases into system_settings, and repairs unscoped Amazon price selectors
 * (issues #236, #283).
 *
 * 1. generic_exclusion_selectors:
 *    Prunes recommendation carousels, sponsored items, related products, and accessory
 *    widgets before candidate extraction runs. Excludes broad patterns like `[class*="carousel"]`
 *    and `[id*="bundle"]` which could match legitimate product galleries or bundles.
 *
 * 2. generic_out_of_stock_phrases:
 *    Adds marketplace multi-seller / buying option phrases ("see all buying options",
 *    "available from these sellers") so suppressed buy-box pages are recognized
 *    as out-of-stock rather than extracting unrelated carousel prices.
 *
 * 3. retailer_configs Amazon price selector repair & exclusion selectors:
 *    Replaces bare un-scoped `.a-offscreen` utility selectors on Amazon domains with
 *    properly scoped buy-box price selectors, while preserving already-scoped selectors
 *    like `.apex-pricetopay-value .a-offscreen`. Also seeds Amazon-specific exclusion
 *    selectors (#sp_detail, #desktop-dp-sims, etc.) directly into Amazon retailer configs.
 */

const NEW_EXCLUSION_SELECTORS = [
  '.site-wide-ad',
  '[class*="recommendation" i]',
  '[class*="sponsored" i]',
  '[class*="similar-products" i]',
  '[class*="related-products" i]',
  '[id*="recommendations" i]',
  '[id*="similarities" i]',
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
  'temporarily out of stock',
  'see all buying options',
  'available from these sellers',
  'discontinued',
  'nicht lieferbar'
];

const AMAZON_EXCLUSION_SELECTORS = [
  '#sp_detail',
  '#sp_detail2',
  '#rhf',
  '#huc-v2-subcart-feature-div',
  '#desktop-dp-sims_purchase-similarities-sims-feature',
  '#similarities_feature_div'
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
      const parsed = typeof existingJson === 'string' ? JSON.parse(existingJson) : existingJson;
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

    // 3. Snapshot Amazon configs before modifying them for a reversible down rollback
    await client.query(`
      CREATE TABLE IF NOT EXISTS _backup_027_amazon_configs (
        id integer PRIMARY KEY,
        price_selectors jsonb,
        exclusion_selectors jsonb
      );
    `);

    await client.query(`
      INSERT INTO _backup_027_amazon_configs (id, price_selectors, exclusion_selectors)
      SELECT id, price_selectors, exclusion_selectors
      FROM retailer_configs
      WHERE domain ILIKE '%amazon%'
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Repair Amazon retailer configs that have bare un-scoped .a-offscreen
    await client.query(
      `
      UPDATE retailer_configs
      SET price_selectors = $1::jsonb
      WHERE domain ILIKE '%amazon%'
        AND (
          price_selectors::text = '[".a-offscreen"]'
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(price_selectors, '[]'::jsonb)) elem
            WHERE elem = '.a-offscreen'
          )
        );
      `,
      [REPAIRED_AMAZON_PRICE_SELECTORS]
    );

    // 5. Seed Amazon-specific exclusion selectors into retailer_configs
    const amazonRows = await client.query<{ id: number; exclusion_selectors: any }>(
      `SELECT id, exclusion_selectors FROM retailer_configs WHERE domain ILIKE '%amazon%'`
    );
    for (const row of amazonRows.rows) {
      const mergedExclusions = mergeArrays(
        typeof row.exclusion_selectors === 'string'
          ? row.exclusion_selectors
          : JSON.stringify(row.exclusion_selectors || []),
        AMAZON_EXCLUSION_SELECTORS
      );
      await client.query(
        `UPDATE retailer_configs SET exclusion_selectors = $1::jsonb WHERE id = $2`,
        [mergedExclusions, row.id]
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Restore original retailer_configs from snapshot if snapshot table exists
    const tableCheck = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_backup_027_amazon_configs';
    `);

    if (tableCheck.rows.length > 0) {
      await client.query(`
        UPDATE retailer_configs rc
        SET price_selectors = b.price_selectors,
            exclusion_selectors = b.exclusion_selectors
        FROM _backup_027_amazon_configs b
        WHERE rc.id = b.id;
      `);
      await client.query(`DROP TABLE IF EXISTS _backup_027_amazon_configs;`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
