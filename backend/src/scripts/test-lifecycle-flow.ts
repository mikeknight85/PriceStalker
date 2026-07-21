import { 
  productRepository, 
  priceHistoryRepository, 
  retailerRepository 
} from '../models';

import { productAddService, productRefreshService } from '../services/domain/product';

const url1 = 'http://dev.home.enuff.com/shop/lifecycle-demo-1.html';
const url2 = 'http://dev.home.enuff.com/shop/lifecycle-demo-2.html';
const userId = 1;

async function main() {
  console.log('--- STARTING LIFECYCLE FLOW TEST ---');

  // 0. Setup config for test domain
  const config = await retailerRepository.getByDomain('dev.home.enuff.com');
  const priceSelectors = [
    '#original-price',
    '#sale-price',
    '#member-price'
  ];

  if (config) {
    await retailerRepository.upsert({ ...config, price_selectors: priceSelectors });
  }

  // 1. ADD Product 1 (Standard Scrape)
  console.log('\n[Phase 1] Adding Product 1 (Lifecycle Demo 1)');
  const res1 = await productAddService.addProduct(userId, url1, {});
  console.log(`- Product 1 Added: ${res1.name}`);
  console.log(`- Current Price: ${res1.current_price}`);

  // 2. ADD Product 2 (Member Price Test)
  console.log('\n[Phase 2] Adding Product 2 (Lifecycle Demo 2)');
  const res2 = await productAddService.addProduct(userId, url2, {});
  console.log(`- Product 2 Added: ${res2.name}`);
  console.log(`- Current Price: ${res2.current_price}`);

  // 3. REFRESH Product 1 (Simulate Price Drop)
  console.log('\n[Phase 3] Refreshing Product 1');
  const refreshRes1 = await productRefreshService.refreshProduct(res1);
  console.log(`- Product 1 Refreshed. New Stock: ${refreshRes1.stockStatus}`);

  // 4. Verify History
  console.log('\n[Phase 4] Verifying History');
  const prices1 = await priceHistoryRepository.findByProductId(res1.id);
  console.log(`- Product 1 Price History Count: ${prices1.length}`);

  // 5. Cleanup
  console.log('\n[Phase 5] Cleaning up');
  await productRepository.delete(res1.id, userId);
  await productRepository.delete(res2.id, userId);

  // Restore original config
  const updatedConfig = await retailerRepository.getByDomain('dev.home.enuff.com');
  if (updatedConfig) {
    await retailerRepository.upsert({ ...updatedConfig, price_selectors: [] });
  }

  console.log('\n--- LIFECYCLE FLOW TEST COMPLETE ---');
}

main().catch(console.error);
