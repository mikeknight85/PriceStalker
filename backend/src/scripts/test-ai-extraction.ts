import { scrapeProductWithVoting } from '../services/scraper';
import { pool } from '../models';

async function main() {
  const url = process.argv[2] || 'https://www.mwave.com.au/product/respawn-ninja-pro-forged-gaming-pc-amd-ryzen-5600-gigabyte-geforce-rtx-5060-ac95938';
  const userId = 1;

  console.log(`Running AI Extraction & Verification Test for URL: ${url}`);
  console.log('===========================================================');

  const result = await scrapeProductWithVoting(
    url,
    userId,
    undefined,
    undefined,
    false, // skipAiVerification = false
    false  // skipAiExtraction = false
  );

  console.log('\nResult:');
  console.log(`- name: ${result.name}`);
  console.log(`- price: ${result.price ? `${result.price.currency} ${result.price.price}` : 'null'}`);
  console.log(`- selectedMethod: ${result.selectedMethod}`);
  console.log(`- aiStatus: ${result.aiStatus}`);
  console.log(`- needsReview: ${result.needsReview}`);
  console.log('\nExtraction Steps:');
  result.extractionSteps?.forEach(step => console.log(`  ↳ ${step}`));

  // Close database pool so the script exits
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
