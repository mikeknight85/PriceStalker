import { scrapeProductWithVoting } from '../services/scraper/orchestration';
import { pool } from '../models';

async function main() {
  const url = process.argv[2] || 'https://www.jbhifi.com.au/products/dyson-washg1-2-in-1-hard-floor-cleaner';
  console.log(`Testing Scrape for URL: ${url}`);
  
  try {
    const result = await scrapeProductWithVoting(url);
    console.log('\n====================================');
    console.log('Scrape Result:');
    console.log(`- Name: ${result.name}`);
    console.log(`- Price: ${result.price ? `${result.price.price} ${result.price.currency}` : 'None'}`);
    console.log(`- Member Price: ${result.memberPrice ? `${result.memberPrice.price} ${result.memberPrice.currency}` : 'None'}`);
    console.log(`- Original Price: ${result.originalPrice ? `${result.originalPrice.price} ${result.originalPrice.currency}` : 'None'}`);
    console.log(`- Stock Status: ${result.stockStatus}`);
    console.log(`- AI Status: ${result.aiStatus}`);
    console.log(`- Needs Review: ${result.needsReview}`);
    console.log(`- Image URL: ${result.imageUrl}`);
    console.log('\nImage Candidates:');
    console.log(JSON.stringify(result.imageCandidates, null, 2));
    console.log('\nPrice Candidates:');
    console.log(JSON.stringify(result.priceCandidates, null, 2));
    console.log('====================================');
  } catch (err) {
    console.error('Test scrape execution failed:', err);
  } finally {
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
