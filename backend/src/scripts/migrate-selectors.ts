import { pool } from '../models';

async function main() {
  console.log('Starting selector migration to database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Default price selectors
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
    console.log('✅ Seeded generic_ai_price_selectors in system_settings.');

    // Default image selectors
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
    console.log('✅ Seeded generic_ai_image_selectors in system_settings.');

    await client.query('COMMIT');
    console.log('Migration script completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during selector migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
