const { scrapeProductWithVoting } = require('./dist/services/scraper/index');
const { priceHistoryRepository } = require('./dist/models/repositories/product.repository');
const pool = require('./dist/app/database').default;
const { logger } = require('./dist/utils/logger');

async function run() {
  const url = 'http://dev.home.enuff.com/original-price-test.html';
  console.log(`Scraping mock page: ${url}`);

  try {
    const res = await scrapeProductWithVoting(url);
    
    console.log('\nExtraction Results:');
    console.log(`Primary Price: ${res.price?.currency} ${res.price?.price} (Method: ${res.selectedMethod})`);
    console.log(`Member Price: ${res.memberPrice?.currency} ${res.memberPrice?.price}`);
    console.log(`Original Price: ${res.originalPrice?.currency} ${res.originalPrice?.price}`);
    
    // Test persistence (using a dummy product ID if needed, but let's just check the data structure)
    console.log('\nPersistence Structure Check:');
    if (res.price) {
      console.log(`- Standard Record: ${res.price.price}`);
    }
    if (res.memberPrice) {
      console.log(`- Member Record: ${res.memberPrice.price}`);
    }
    if (res.originalPrice) {
      console.log(`- Original Record: ${res.originalPrice.price}`);
    }

    // Verify consensus steps
    console.log('\nExtraction Steps:');
    res.extractionSteps.forEach(step => console.log(`  ${step}`));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

run();
