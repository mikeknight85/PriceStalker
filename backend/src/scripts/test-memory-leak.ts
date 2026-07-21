import { scrapeProductWithVoting } from '../services/scraper/orchestration';
import { pool } from '../models';

async function main() {
  const url = 'http://dev.home.enuff.com/shop/oos-accessory-trap.html';
  console.log(`Running memory leak verification against: ${url}`);
  
  if (typeof global.gc !== 'function') {
    console.warn('Warning: global.gc is not exposed. Run node with --expose-gc flag to test garbage collection.');
  }

  const iterations = 100;
  let initialHeap = 0;

  for (let i = 1; i <= iterations; i++) {
    try {
      await scrapeProductWithVoting(url);
    } catch (e) {}

    // Call GC every 10 iterations to force garbage collection programmatically
    if (global.gc && i % 10 === 0) {
      global.gc();
      const heapUsed = process.memoryUsage().heapUsed;
      if (i === 10) {
        initialHeap = heapUsed; // Set initial baseline after initial warmup
      }
      console.log(`Iteration ${i}/${iterations} | Heap Used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  if (global.gc) {
    global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const diffMB = (finalHeap - initialHeap) / 1024 / 1024;
    console.log(`\nFinal Memory Telemetry:`);
    console.log(`- Initial Heap (Warmup): ${(initialHeap / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Final Heap: ${(finalHeap / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Memory Growth: ${diffMB.toFixed(2)} MB`);

    if (diffMB > 8) { // Allow slight overhead, fail if > 8 MB growth
      console.error('❌ Memory leak detected! Heap grew by more than 8 MB.');
      process.exit(1);
    } else {
      console.log('✅ Heap memory is stable. No memory leaks detected.');
    }
  }
  
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
