import 'dotenv/config';
import { execSync } from 'child_process';

/**
 * Extraction Priority Integration Test (Production-Safe)
 * 
 * Verifies that the scraper correctly follows the priority hierarchy.
 * Runs INSIDE the production container on vodka to use the real environment.
 * 
 * Usage: 
 *   pnpm --filter pricestalker-backend exec tsx tests/integration/test-extraction-priority.ts --remote
 */

async function runTest() {
  const isRemote = process.argv.includes('--remote');
  
  if (!isRemote) {
    console.error('This test must be run with --remote to execute on vodka.');
    process.exit(1);
  }

  const tests = [
    {
      name: 'Red Hot Deal (Deal Priority over Standard)',
      url: 'http://192.168.50.200:5080/shop/red-hot-deal.html',
      expected: 135
    },
    {
      name: 'Deal vs Member (Deal Priority over Member)',
      url: 'http://192.168.50.200:5080/shop/deal-v-member.html',
      expected: 90
    }
  ];

  console.log(`\n--- Starting Extraction Priority Tests (REMOTE ON VODKA) ---\n`);

  // 1. We'll create a small runner script that runs INSIDE the container
  // This script uses the already-compiled .js files and production node_modules
  const runnerJs = `
const { scrapeProductWithVoting } = require('./dist/services/scraper');

async function execute() {
  const tests = ${JSON.stringify(tests)};
  for (const t of tests) {
    console.log('Testing: ' + t.name);
    try {
      const result = await scrapeProductWithVoting(t.url, undefined, undefined, undefined, false, true);
      const actual = result.price?.price;
      const success = actual === t.expected;
      console.log('URL:    ' + t.url);
      console.log('Result: ' + (success ? '✅ PASS' : '❌ FAIL') + ' (Actual: ' + actual + ', Expected: ' + t.expected + ')');
      console.log('Method: ' + result.selectedMethod);
      console.log('Candidates:');
      result.priceCandidates.forEach(c => {
        console.log('  - ' + c.method.padEnd(15) + ' | ' + c.price + ' | ' + c.context);
      });
      console.log('-------------------\\n');
    } catch (e) {
      console.error('Error: ' + e.message);
    }
  }
}
execute().catch(console.error);
`;

  // 2. Sync and execute
  try {
    // Write runner.js to vodka host
    console.log('Transferring runner to vodka...');
    execSync(`ssh steven@192.168.50.200 "cat <<EOF > /opt/usb/docker-compose/pricestalker/source/backend/tests/integration/runner.js\n${runnerJs}\nEOF"`);
    
    // Copy runner.js into container
    console.log('Copying runner into container...');
    execSync(`ssh steven@192.168.50.200 "docker cp /opt/usb/docker-compose/pricestalker/source/backend/tests/integration/runner.js pricestalker-backend:/app/runner-temp.js"`);

    // Run it
    console.log('Executing inside container...\n');
    execSync(`ssh steven@192.168.50.200 "docker exec -w /app pricestalker-backend node runner-temp.js"`, { stdio: 'inherit' });

    // Cleanup
    execSync(`ssh steven@192.168.50.200 "docker exec pricestalker-backend rm /app/runner-temp.js"`);
  } catch (error: any) {
    console.error('Execution failed:', error.message);
  }
}

runTest().catch(console.error);
