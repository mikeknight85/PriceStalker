import { Command } from 'commander';
import { PriceStalkerApiClient } from '../client/api.js';
import { runStdioServer } from '../server.js';

export function createCli(clientFactory: (options: any) => PriceStalkerApiClient): Command {
  const program = new Command();

  program
    .name('pricestalker')
    .description('PriceStalker CLI and Model Context Protocol (MCP) Server')
    .version('2.1.0')
    .option('--url <url>', 'PriceStalker backend URL (or via PRICESTALKER_URL env)', process.env.PRICESTALKER_URL || 'http://localhost:3000')
    .option('--token <token>', 'PriceStalker API Token (or via PRICESTALKER_TOKEN env)', process.env.PRICESTALKER_TOKEN || '');

  // 1. MCP Server Mode
  program
    .command('mcp')
    .description('Start the Model Context Protocol (MCP) server over stdio')
    .action(async () => {
      const opts = program.opts();
      const client = clientFactory(opts);
      await runStdioServer(client);
    });

  // 2. Items Search / List
  program
    .command('items')
    .description('List and search tracked items')
    .option('-q, --query <query>', 'Search filter')
    .option('--in-stock', 'Filter in-stock items only')
    .action(async (cmdOpts) => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        const items = await client.getItems();
        let filtered = items;
        if (cmdOpts.query) {
          const q = cmdOpts.query.toLowerCase();
          filtered = filtered.filter(i => i.name?.toLowerCase().includes(q));
        }
        if (cmdOpts.inStock) {
          filtered = filtered.filter(i => i.stores?.some(s => s.stock_status === 'in_stock'));
        }

        console.log(`Found ${filtered.length} item(s):\n`);
        for (const item of filtered) {
          const priceStr = item.best_price !== null && item.best_price !== undefined
            ? `${item.currency || '$'}${item.best_price}`
            : 'N/A';
          console.log(`• [ID: ${item.id}] ${item.name}`);
          console.log(`  Best Price: ${priceStr} | Stores: ${item.stores?.length || 0} | Target: ${item.target_price ?? 'None'}`);
        }
      } catch (err: any) {
        console.error(`Error fetching items: ${err.message}`);
        process.exit(1);
      }
    });

  // 3. Deals List
  program
    .command('deals')
    .description('List active price drops and items below target price')
    .option('--below-target', 'Only show items below target price')
    .action(async (cmdOpts) => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        const items = await client.getItems();
        console.log('Active Deals and Price Drops:\n');
        let count = 0;
        for (const item of items) {
          const target = item.target_price;
          for (const s of item.stores || []) {
            if (s.current_price === null) continue;
            const isBelow = target !== null && target !== undefined && s.current_price <= target;
            if (cmdOpts.belowTarget && !isBelow) continue;

            count++;
            console.log(`• ${item.name} @ ${s.retailer_name || s.domain}`);
            console.log(`  Current: ${s.currency || '$'}${s.current_price} (Target: ${target ?? 'None'}) [${s.stock_status}]`);
            console.log(`  URL: ${s.url}\n`);
          }
        }
        if (count === 0) console.log('No active deals found matching criteria.');
      } catch (err: any) {
        console.error(`Error fetching deals: ${err.message}`);
        process.exit(1);
      }
    });

  // 4. Meta Extract (Dry-run)
  program
    .command('extract <url>')
    .description('Extract product info from a URL without saving')
    .action(async (url) => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        console.log(`Extracting from ${url}...`);
        const result = await client.testRetailerConfig(url, {});
        console.log('\nResult:');
        console.log(`Title:       ${result.name ?? 'Not found'}`);
        console.log(`Price:       ${typeof result.price === 'object' ? JSON.stringify(result.price) : (result.price ?? 'Not found')}`);
        console.log(`Currency:    ${result.currency ?? 'Not found'}`);
        console.log(`Stock:       ${result.stockStatus ?? 'Unknown'}`);
        console.log(`Image:       ${result.imageUrl ?? 'None'}`);
      } catch (err: any) {
        console.error(`Extraction failed: ${err.message}`);
        process.exit(1);
      }
    });

  // 5. Inspect Candidate Prices
  program
    .command('inspect <url>')
    .description('Inspect all candidate prices found across the DOM, meta tags, and JSON-LD')
    .action(async (url) => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        console.log(`Inspecting price candidates on ${url}...`);
        const result = await client.testRetailerConfig(url, {});
        console.log(`\nDiscovered ${result.priceCandidates?.length || 0} candidate price(s):`);
        console.log(JSON.stringify(result.priceCandidates || [], null, 2));
      } catch (err: any) {
        console.error(`Inspection failed: ${err.message}`);
        process.exit(1);
      }
    });

  // 6. System Health
  program
    .command('health')
    .description('Check PriceStalker backend health and database status')
    .action(async () => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        const [db, ver] = await Promise.all([
          client.getDbHealth().catch(e => ({ status: 'unknown', error: e.message })),
          client.getVersion().catch(e => ({ version: 'unknown', error: e.message }))
        ]);
        console.log('PriceStalker System Health:');
        console.log(`Version:  ${ver.version}`);
        console.log(`Database: ${JSON.stringify(db)}`);
      } catch (err: any) {
        console.error(`Health check failed: ${err.message}`);
        process.exit(1);
      }
    });

  // 7. Flush Caches
  program
    .command('flush')
    .description('Flush system and retailer configuration caches')
    .action(async () => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        const res = await client.clearCaches();
        console.log(`Success: ${res.message}`);
      } catch (err: any) {
        console.error(`Flush failed: ${err.message}`);
        process.exit(1);
      }
    });

  return program;
}
