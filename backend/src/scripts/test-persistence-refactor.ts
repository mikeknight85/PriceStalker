import { productPersistenceService } from '../services/domain/product/ProductPersistenceService';
import { productRepository, priceHistoryRepository, stockHistoryRepository } from '../models';
import pool from '../config/database';
import { ScrapedProductWithVoting } from '../types/scraper';

async function main() {
  console.log('--- STARTING PERSISTENCE REFACTOR VERIFICATION ---');

  const userId = 1;
  const testUrl = 'http://dev.home.enuff.com/refactor-test-' + Date.now() + '.html';

  try {
    // 1. Create a mock product
    console.log('1. Creating mock product...');
    const product = await productRepository.create(
      userId,
      testUrl,
      'Loading...', // Generic name to test sanitization
      'http://example.com/placeholder.png' // Placeholder to test sanitization
    );
    console.log(`   Product created with ID: ${product.id}`);

    // 2. Prepare mock scrape result
    const scrapedData: ScrapedProductWithVoting = {
      url: testUrl,
      name: 'Valid Product Name',
      imageUrl: 'http://example.com/real-image.jpg',
      price: { price: 99.99, currency: 'AUD' },
      priceCandidates: [],
      stockStatus: 'out_of_stock',
      html: '<html><body>Refactor Test</body></html>',
      needsReview: false,
      aiStatus: 'confirmed',
      extractionSteps: ['Refactor verification test'],
      selectedMethod: 'custom-css'
    };

    // 3. Trigger persistence
    console.log('2. Triggering saveScrapeResult...');
    await productPersistenceService.saveScrapeResult(product.id, userId, scrapedData, 'refresh');

    // 4. Verify updates
    console.log('3. Verifying database updates...');
    const updated = await productRepository.findById(product.id, userId);
    
    console.log(`   - Name updated: ${updated?.name === 'Valid Product Name' ? '✅' : '❌ (' + updated?.name + ')'}`);
    console.log(`   - Image updated: ${updated?.image_url === 'http://example.com/real-image.jpg' ? '✅' : '❌'}`);
    console.log(`   - Stock status: ${updated?.stock_status === 'out_of_stock' ? '✅' : '❌'}`);

    const latestPrice = await priceHistoryRepository.getLatest(product.id, 'standard');
    console.log(`   - Price recorded: ${latestPrice?.price === 99.99 ? '✅' : '❌'}`);

    const stockHistory = await stockHistoryRepository.getByProductId(product.id);
    const hasChange = stockHistory.some(h => h.status === 'out_of_stock');
    console.log(`   - Stock history recorded: ${hasChange ? '✅' : 'short'}`);

    // 5. Cleanup
    console.log('4. Cleaning up...');
    await productRepository.delete(product.id, userId);
    console.log('   Done.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
