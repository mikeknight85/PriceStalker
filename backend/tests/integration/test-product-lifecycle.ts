import { execSync } from 'child_process';
import axios from 'axios';

/**
 * End-to-End Product Lifecycle Integration Test
 * 
 * Tests the full product lifecycle:
 * 1. Mock page creation on dev site.
 * 2. Initial product add (scanning and candidate detection -> needsReview: true).
 * 3. User confirmation (creating the product, price records, and next check rescheduling).
 * 4. DB inspection of confirmed product state.
 * 5. Price change detection (triggering refreshProduct -> verifying price history and anchor price drift).
 * 6. Stock status change detection (verifying stock history records).
 * 7. Page gone / 404 handling (verifying pausing and status update to not_available).
 * 8. Cascade delete (verifying clean DB cleanup).
 * 
 * Usage:
 *   npx tsx tests/integration/test-product-lifecycle.ts
 */

const SERVER = "steven@192.168.50.200";
const DEV_SITE_DIR = "/opt/usb/dev-home/html/shop";
const BACKEND_URL = "http://192.168.50.200:3003";
const ADMIN_TOKEN = "supersecret-priceghost-admin-token-2026";

const headers = {
  'Authorization': `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json',
  'Connection': 'close'
};

function runRemoteCommand(command: string): string {
  try {
    const formattedCommand = command.replace(/"/g, '\\"');
    const result = execSync(`ssh ${SERVER} "${formattedCommand}"`, { encoding: 'utf-8' });
    return result.trim();
  } catch (error: any) {
    throw new Error(`SSH Command failed: ${error.message}\nOutput: ${error.stdout || error.stderr}`);
  }
}

async function run() {
  const testId = Math.floor(Math.random() * 1000000);
  const mockFilename = `lifecycle-test-${testId}.html`;
  const mockFilePath = `${DEV_SITE_DIR}/${mockFilename}`;
  const mockUrl = `http://192.168.50.200:5080/shop/${mockFilename}`;

  console.log(`\n🚀 Starting End-to-End Product Lifecycle Test (ID: ${testId})`);
  console.log(`Mock URL: ${mockUrl}`);

  // ==========================================
  // STEP 1: Create initial mock page
  // ==========================================
  console.log('\n--- Step 1: Creating initial mock page on dev site ---');
  const initialHtml = `<!DOCTYPE html>
<html>
<head><title>LifeCycle Test Product</title></head>
<body>
  <h1 class="product-title">LifeCycle Test Product</h1>
  <img class="product-image" src="/images/lifecycle.jpg" />
  <div class="standard-cost">$199.99</div>
  <div class="amount">$150.00</div>
  <div class="stock">In Stock</div>
</body>
</html>`;

  runRemoteCommand(`cat <<'EOF' > ${mockFilePath}\n${initialHtml}\nEOF`);
  console.log('✅ Mock page created.');

  // ==========================================
  // STEP 2: Initial Add / Scan
  // ==========================================
  console.log('\n--- Step 2: Adding product (initial scan) ---');
  const scanResponse = await axios.post(`${BACKEND_URL}/api/products`, { url: mockUrl }, { headers });
  
  if (!scanResponse.data.needsReview) {
    throw new Error('Expected needsReview: true due to price conflict ($199.99 vs $150.00)');
  }
  console.log('✅ Correctly triggered needsReview: true.');
  console.log('Price candidates:', scanResponse.data.priceCandidates.map((c: any) => `${c.method}: ${c.price}`));

  // ==========================================
  // STEP 3: Confirm selection (Product Creation)
  // ==========================================
  console.log('\n--- Step 3: Confirming price selection (product creation) ---');
  const confirmPayload = {
    url: mockUrl,
    selectedPrice: 150.00,
    selectedMethod: 'custom-css',
    selectedCurrency: 'AUD',
    name: 'LifeCycle Test Product',
    imageUrl: 'http://192.168.50.200:5080/images/lifecycle.jpg',
    stockStatus: 'in_stock',
    html: initialHtml,
    selector: '.amount'
  };

  const confirmResponse = await axios.post(`${BACKEND_URL}/api/products`, confirmPayload, { headers });
  const productId = confirmResponse.data.id;
  if (!productId) {
    throw new Error('Product creation failed, no ID returned');
  }
  console.log(`✅ Product confirmed and created. ID: ${productId}`);

  // ==========================================
  // STEP 4: Inspect DB state of confirmed product
  // ==========================================
  console.log('\n--- Step 4: Checking DB state for confirmation changes ---');
  const dbInspectCmd = `docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT ai_status, anchor_price, preferred_extraction_method, last_checked, next_check_at, stock_status FROM products WHERE id = ${productId};"`;
  const dbResult = runRemoteCommand(dbInspectCmd);
  console.log(`DB Values (ai_status | anchor | method | last_checked | next_check_at | stock):`);
  console.log(dbResult);

  const parts = dbResult.split('|').map(s => s.trim());
  if (parts[0] !== 'confirmed') throw new Error('Expected ai_status to be "confirmed"');
  if (parseFloat(parts[1]) !== 150.00) throw new Error('Expected anchor price to be 150.00');
  if (parts[2] !== 'custom-css') throw new Error('Expected preferred method to be "custom-css"');
  if (parts[3] === '' || parts[3] === 'null') throw new Error('Expected last_checked to be set');
  if (parts[4] === '' || parts[4] === 'null') throw new Error('Expected next_check_at to be scheduled');
  if (parts[5] !== 'in_stock') throw new Error('Expected stock status to be "in_stock"');
  console.log('✅ Database properties matches verified confirmation schema.');

  // ==========================================
  // STEP 5: Simulate Price Change (Refresh)
  // ==========================================
  console.log('\n--- Step 5: Simulating a price change (drop to $99.99) ---');
  const updatedPriceHtml = `<!DOCTYPE html>
<html>
<head><title>LifeCycle Test Product</title></head>
<body>
  <h1 class="product-title">LifeCycle Test Product</h1>
  <div class="standard-cost">$199.99</div>
  <div class="amount">$99.99</div>
  <div class="stock">In Stock</div>
</body>
</html>`;

  runRemoteCommand(`cat <<'EOF' > ${mockFilePath}\n${updatedPriceHtml}\nEOF`);
  
  console.log('Triggering backend refresh inside container...');
  const inContainerRunner = `
const { productRefreshService } = require('./dist/services/domain/product');
const { productRepository } = require('./dist/models');
async function execute() {
  const product = await productRepository.findById(${productId}, 1);
  await productRefreshService.refreshProduct(product);
}
execute().catch(e => { console.error(e); process.exit(1); });
`;
  
  runRemoteCommand(`cat <<'EOF' > /opt/usb/docker-compose/priceghost/source/backend/runner-temp.js\n${inContainerRunner}\nEOF`);
  runRemoteCommand(`docker cp /opt/usb/docker-compose/priceghost/source/backend/runner-temp.js priceghost-backend:/app/backend/runner-temp.js`);
  runRemoteCommand(`docker exec priceghost-backend node runner-temp.js`);
  console.log('✅ Refresh completed inside container.');

  // Verify DB price history record and anchor price drift
  const priceHistoryResult = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT price FROM price_history WHERE product_id = ${productId} ORDER BY recorded_at DESC LIMIT 1;"`);
  console.log(`Latest Price in History: $${priceHistoryResult.trim()}`);
  if (parseFloat(priceHistoryResult) !== 99.99) {
    throw new Error('Expected price history record of $99.99');
  }

  const updatedAnchorResult = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT anchor_price FROM products WHERE id = ${productId};"`);
  console.log(`Drifted Anchor Price: $${updatedAnchorResult.trim()}`);
  if (parseFloat(updatedAnchorResult) !== 99.99) {
    throw new Error('Expected anchor price to drift to $99.99');
  }
  console.log('✅ Price change detected and recorded. Anchor price drifted correctly.');

  // ==========================================
  // STEP 6: Simulate Stock Status Change
  // ==========================================
  console.log('\n--- Step 6: Simulating a stock change (Out of Stock) ---');
  const outOfStockHtml = `<!DOCTYPE html>
<html>
<head><title>LifeCycle Test Product</title></head>
<body>
  <h1 class="product-title">LifeCycle Test Product</h1>
  <div class="standard-cost">$199.99</div>
  <div class="amount">$99.99</div>
  <div class="stock">Out of Stock</div>
</body>
</html>`;

  runRemoteCommand(`cat <<'EOF' > ${mockFilePath}\n${outOfStockHtml}\nEOF`);
  
  console.log('Triggering backend refresh...');
  runRemoteCommand(`docker exec priceghost-backend node runner-temp.js`);
  
  const stockInspect = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT stock_status FROM products WHERE id = ${productId};"`);
  console.log(`Stock Status in DB: ${stockInspect.trim()}`);
  if (stockInspect.trim() !== 'out_of_stock') {
    throw new Error('Expected stock status to change to "out_of_stock"');
  }

  const stockHistoryInspect = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT status FROM stock_status_history WHERE product_id = ${productId} ORDER BY changed_at DESC LIMIT 1;"`);
  console.log(`Stock History status: ${stockHistoryInspect.trim()}`);
  if (stockHistoryInspect.trim() !== 'out_of_stock') {
    throw new Error('Expected stock status history entry for "out_of_stock"');
  }
  console.log('✅ Stock status change recorded in history correctly.');

  // ==========================================
  // STEP 7: Simulate Page Gone (404/Soft 404)
  // ==========================================
  console.log('\n--- Step 7: Simulating page gone (404) ---');
  // Deleting the mock file will trigger 404 from Nginx
  runRemoteCommand(`rm -f ${mockFilePath}`);

  console.log('Triggering backend refresh...');
  runRemoteCommand(`docker exec priceghost-backend node runner-temp.js`);

  const goneInspectResult = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT stock_status, checking_paused FROM products WHERE id = ${productId};"`);
  console.log(`DB Values (stock_status | checking_paused): ${goneInspectResult.trim()}`);
  
  const goneParts = goneInspectResult.split('|').map(s => s.trim());
  if (goneParts[0] !== 'not_available') throw new Error('Expected stock status to be "not_available"');
  if (goneParts[1] !== 't') throw new Error('Expected checking_paused to be true (t)');
  console.log('✅ Soft 404 / Gone Page handled correctly: paused checks and updated status.');

  // ==========================================
  // STEP 8: Cascade Deletion
  // ==========================================
  console.log('\n--- Step 8: Verifying deletion and cascade cleanup ---');
  await axios.delete(`${BACKEND_URL}/api/products/${productId}`, { headers });
  console.log('✅ Delete API call made.');

  const productCount = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT count(*) FROM products WHERE id = ${productId};"`);
  const priceHistoryCount = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT count(*) FROM price_history WHERE product_id = ${productId};"`);
  const stockHistoryCount = runRemoteCommand(`docker exec priceghost-db psql -U postgres -d priceghost -t -c "SELECT count(*) FROM stock_status_history WHERE product_id = ${productId};"`);

  console.log(`Post-Delete Counts - Products: ${productCount.trim()}, Price History: ${priceHistoryCount.trim()}, Stock History: ${stockHistoryCount.trim()}`);
  if (parseInt(productCount) !== 0) throw new Error('Expected product to be deleted');
  if (parseInt(priceHistoryCount) !== 0) throw new Error('Expected price history to be cascaded');
  if (parseInt(stockHistoryCount) !== 0) throw new Error('Expected stock history to be cascaded');
  console.log('✅ Cascade deletion verified successfully.');

  // ==========================================
  // CLEANUP MOCKS & TEMPS
  // ==========================================
  console.log('\n--- Cleaning up temporary files ---');
  runRemoteCommand(`docker exec priceghost-backend rm -f runner-temp.js`);
  runRemoteCommand(`rm -f /opt/usb/docker-compose/priceghost/source/backend/runner-temp.js`);
  console.log('✅ Temporary files cleared.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! E2E Lifecycle is structurally sound! 🎉\n');
}

run().catch(error => {
  console.error('\n❌ TEST FAILED:', error.stack || error);
  // Attempt remote temp cleanup in case of crash
  try {
    runRemoteCommand(`docker exec priceghost-backend rm -f runner-temp.js`);
    runRemoteCommand(`rm -f /opt/usb/docker-compose/priceghost/source/backend/runner-temp.js`);
  } catch {}
  process.exit(1);
});
