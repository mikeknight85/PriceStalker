import { acquireStandardHtml } from '../services/scraper/acquisition/standard';
import { acquireRemoteHtml } from '../services/scraper/acquisition/remote';
import { productPersistenceService } from '../services/domain/product/ProductPersistenceService';
import { productRepository, retailerRepository } from '../models';
import { pool } from '../models';
import * as cheerio from 'cheerio';

async function main() {
  const urlArg = process.argv[2];
  
  if (!urlArg) {
    console.log('--- PriceGhost Consensus & Scraper Tester ---');
    console.log('Usage:');
    console.log('  npx tsx src/scripts/test-consensus.ts <url>                # Compare scraping methods');
    console.log('  npx tsx src/scripts/test-consensus.ts --simulate-vote       # Test Voting & Learning Loop');
    console.log('===========================================================');
    process.exit(0);
  }

  // Option 1: Simulate Voting & Learning Loop
  if (urlArg === '--simulate-vote') {
    console.log('--- Simulating Voting & Selector Learning Loop ---');
    
    const testDomain = `mock-test-retailer-${Date.now()}.com`;
    const testUrl = `https://www.${testDomain}/product-12345`;
    const userId = 1;

    console.log(`1. Creating temporary product for domain: ${testDomain}`);
    
    // Create mock product
    const product = await productRepository.create(
      userId,
      testUrl,
      'Test Learning Product',
      'https://example.com/image.jpg',
      3600,
      'in_stock',
      'confirmed',
      'Test Category'
    );
    console.log(`   Mock product created with ID: ${product.id}`);

    // Create initial empty retailer config
    console.log(`2. Creating empty retailer config for domain: ${testDomain}`);
    await retailerRepository.upsert({
      domain: testDomain,
      name: 'Test Learner Retailer',
      active: true,
      price_selectors: [],
    });

    // Mock scrape data containing candidates
    const mockedScrapedData: any = {
      name: 'Test Learning Product',
      imageUrl: 'https://example.com/image.jpg',
      stockStatus: 'in_stock',
      price: { price: 150.00, currency: 'AUD' },
      priceCandidates: [
        { price: 150.00, currency: 'AUD', method: 'deal-price', selector: '.my-winning-deal-selector', confidence: 0.95 },
        { price: 180.00, currency: 'AUD', method: 'standard', selector: '.my-standard-selector', confidence: 0.80 }
      ],
      selectedMethod: 'deal-price',
      html: '<html><body><span class="my-winning-deal-selector">150.00</span></body></html>'
    };

    // Simulate User Vote on a specific selector
    const manualSelector = '.my-winning-deal-selector';
    console.log(`3. Simulating User Vote on selector: '${manualSelector}'`);
    await productPersistenceService.saveScrapeResult(
      product.id,
      userId,
      mockedScrapedData,
      'manual-confirm',
      manualSelector
    );

    // Verify database learning
    console.log('4. Verifying if the retailer config learned the selector...');
    const updatedConfig = await retailerRepository.getByDomain(testDomain);
    
    console.log('\n====================================');
    const hasLearned = updatedConfig && (
      updatedConfig.deal_price_selectors?.includes(manualSelector) ||
      updatedConfig.price_selectors?.includes(manualSelector)
    );
    if (hasLearned) {
      console.log(`✅ SUCCESS: Retailer config learned the selector!`);
      console.log(`Domain:     ${updatedConfig.domain}`);
      console.log(`Learned Price Selectors:`, updatedConfig.price_selectors);
      console.log(`Learned Deal Selectors:`, updatedConfig.deal_price_selectors);
    } else {
      console.log(`❌ FAILURE: Retailer config did not learn the selector.`);
    }
    console.log('====================================');

    // Cleanup
    console.log('Cleaning up mock database records...');
    await pool.query('DELETE FROM price_history WHERE product_id = $1', [product.id]);
    await pool.query('DELETE FROM products WHERE id = $1', [product.id]);
    await pool.query('DELETE FROM retailer_configs WHERE domain = $1', [testDomain]);
    
    await pool.end();
    return;
  }

  // Option 2: Compare Scraping Methods
  const url = urlArg;
  let domain = '';
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace('www.', '');
  } catch (err) {
    console.error('Error: Please enter a valid URL.');
    process.exit(1);
  }

  console.log(`--- Comparing Scraping Methods for: ${url} ---`);
  console.log(`Domain: ${domain}`);
  console.log('===========================================================');

  // A. Direct HTTP (Axios)
  console.log('\nTesting Method 1: Standard HTTP (Axios)...');
  const startHttp = Date.now();
  const stepsHttp: string[] = [];
  try {
    const htmlHttp = await acquireStandardHtml({
      url,
      domain,
      extractionSteps: stepsHttp
    });
    const duration = Date.now() - startHttp;
    console.log(`✅ Standard HTTP Success in ${duration}ms!`);
    console.log(`HTML Length: ${htmlHttp.length} bytes`);
  } catch (err: any) {
    console.error(`❌ Standard HTTP Failed:`, err.message);
  }

  // B. Remote Scraper (Puppeteer on ruski)
  console.log('\nTesting Method 2: Remote Scraper (Puppeteer on ruski)...');
  const startRemote = Date.now();
  const stepsRemote: string[] = [];
  try {
    const htmlRemote = await acquireRemoteHtml({
      url,
      domain,
      extractionSteps: stepsRemote
    });
    const duration = Date.now() - startRemote;
    if (htmlRemote) {
      console.log(`✅ Remote Scraper Success in ${duration}ms!`);
      console.log(`HTML Length: ${htmlRemote.length} bytes`);
    } else {
      console.error(`❌ Remote Scraper returned empty HTML.`);
    }
  } catch (err: any) {
    console.error(`❌ Remote Scraper Failed:`, err.message);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
