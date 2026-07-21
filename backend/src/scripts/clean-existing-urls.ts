import { pool } from '../models';
import { cleanUrl } from '../utils/scraping/urlHelper';

interface ProductRow {
  id: number;
  user_id: number;
  url: string;
}

async function main() {
  const apply = process.argv.includes('--apply') || process.argv.includes('-a');

  console.log('PriceGhost Existing URL Cleanup Tool');
  console.log('====================================');
  console.log(`Mode: ${apply ? '💥 APPLY (Database updates WILL be made)' : '🔍 DRY-RUN (No database updates)'}\n`);

  const client = await pool.connect();
  try {
    if (apply) {
      await client.query('BEGIN');
    }

    const productsResult = await client.query('SELECT id, user_id, url FROM products');
    const products: ProductRow[] = productsResult.rows;

    let cleanCount = 0;
    let updateCount = 0;
    let mergeCount = 0;

    for (const product of products) {
      const cleaned = cleanUrl(product.url);

      if (cleaned === product.url) {
        cleanCount++;
        continue;
      }

      // Check if another product with the same cleaned URL exists for the same user
      const duplicateCheck = await client.query(
        'SELECT id FROM products WHERE user_id = $1 AND url = $2 AND id != $3 LIMIT 1',
        [product.user_id, cleaned, product.id]
      );
      const duplicateProduct = duplicateCheck.rows[0];

      if (duplicateProduct) {
        mergeCount++;
        console.log(`[MERGE] Product #${product.id} -> #${duplicateProduct.id}`);
        console.log(`  From: ${product.url}`);
        console.log(`  To:   ${cleaned}`);

        if (apply) {
          // Merge price history
          await client.query(
            'UPDATE price_history SET product_id = $1 WHERE product_id = $2',
            [duplicateProduct.id, product.id]
          );

          // Merge stock history
          await client.query(
            'UPDATE stock_status_history SET product_id = $1 WHERE product_id = $2',
            [duplicateProduct.id, product.id]
          );

          // Delete duplicate product
          await client.query('DELETE FROM products WHERE id = $1', [product.id]);
        }
      } else {
        updateCount++;
        console.log(`[UPDATE] Product #${product.id}`);
        console.log(`  From: ${product.url}`);
        console.log(`  To:   ${cleaned}`);

        if (apply) {
          await client.query('UPDATE products SET url = $1 WHERE id = $2', [cleaned, product.id]);
        }
      }
    }

    console.log('\n====================================');
    console.log('Cleanup Statistics:');
    console.log(`- Already Clean: ${cleanCount}`);
    console.log(`- URLs to Update: ${updateCount}`);
    console.log(`- Duplicate URLs to Merge: ${mergeCount}`);
    console.log(`- Total Processed: ${products.length}`);

    if (apply) {
      await client.query('COMMIT');
      console.log('\nSuccessfully applied all updates and merged duplicate histories in database.');
    } else {
      console.log('\nDry run complete. No changes were saved. Run with --apply or -a to save changes.');
    }

  } catch (err) {
    if (apply) {
      await client.query('ROLLBACK');
      console.log('\nDatabase transaction rolled back due to error.');
    }
    console.error('Fatal error running cleanup:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
