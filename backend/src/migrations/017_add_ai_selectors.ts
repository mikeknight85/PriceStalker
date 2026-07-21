import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add ai_selectors column to retailer_configs
    await client.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS ai_selectors JSONB DEFAULT NULL');

    // 2. Insert generic fallback price selectors
    const genericPriceSelectors = JSON.stringify([
      '[class*="price" i]',
      '[class*="Price" i]',
      '[data-testid*="price" i]',
      '[data-automation*="price" i]',
      '[data-automation*="Price" i]',
      '[itemprop="price"]',
      '[data-price]',
      '[data-price-amount]',
      '[data-product-price]'
    ]);
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('generic_ai_price_selectors', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [genericPriceSelectors]);

    // 3. Insert generic fallback image selectors
    const genericImageSelectors = JSON.stringify([
      'link[rel="preload"][as="image"]',
      'img#landingImage',
      'img#main-image',
      'img.main-image',
      'img.hero-image',
      'img[class*="product-image" i]',
      'img[class*="product__image" i]',
      'img[class*="gallery" i]',
      'img[data-testid*="image" i]'
    ]);
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('generic_ai_image_selectors', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [genericImageSelectors]);

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

    // 1. Drop column
    await client.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS ai_selectors');

    // 2. Remove settings keys
    await client.query("DELETE FROM system_settings WHERE key IN ('generic_ai_price_selectors', 'generic_ai_image_selectors')");

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
