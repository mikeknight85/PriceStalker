import { Command } from 'commander';
import { PriceStalkerApiClient } from '../client/api.js';
import { runStdioServer } from '../server.js';
import { scrubSensitiveData } from '../utils/scrubber.js';

export function createCli(clientFactory: (options: any) => PriceStalkerApiClient): Command {
  const program = new Command();

  program
    .name('pricestalker')
    .description('PriceStalker CLI and Model Context Protocol (MCP) Server')
    .version('2.2.0')
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

  // 2. Items List
  program
    .command('items')
    .description('List and search tracked items')
    .option('-q, --query <query>', 'Search filter')
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

        console.log(`Found ${filtered.length} item(s):\n`);
        for (const item of filtered) {
          const priceStr = item.best_price !== null && item.best_price !== undefined
            ? `${item.currency || '$'}${item.best_price}`
            : 'N/A';
          console.log(`• [ID: ${item.id}] ${scrubSensitiveData(item.name)}`);
          console.log(`  Best Price: ${priceStr} | Stores: ${item.stores?.length || 0} | Target: ${item.target_price ?? 'None'}`);
        }
      } catch (err: any) {
        console.error(`Error fetching items: ${scrubSensitiveData(err.message)}`);
        process.exit(1);
      }
    });

  // 3. System Health
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
        console.log(`Database: ${JSON.stringify(scrubSensitiveData(db), null, 2)}`);
      } catch (err: any) {
        console.error(`Health check failed: ${scrubSensitiveData(err.message)}`);
        process.exit(1);
      }
    });

  // 4. Flush Caches
  program
    .command('flush')
    .description('Flush system and retailer configuration caches (requires admin:system scope)')
    .action(async () => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        const res = await client.clearCaches();
        console.log(`Success: ${res.message}`);
      } catch (err: any) {
        console.error(`Flush failed: ${scrubSensitiveData(err.message)}`);
        process.exit(1);
      }
    });

  // 5. Debug Extract URL
  program
    .command('extract <url>')
    .description('Live debug extraction against a URL (requires mcp:extract scope and debug page enabled in Admin)')
    .option('--bypass', 'Use raw HTTP bypass fetch instead of standard scraper')
    .option('--ai', 'Enable AI extraction fallback')
    .action(async (url, cmdOpts) => {
      const opts = program.opts();
      const client = clientFactory(opts);
      try {
        console.log(`Extracting from ${scrubSensitiveData(url)}...`);
        const result = await client.debugExtract({
          url,
          mode: cmdOpts.bypass ? 'bypass' : 'standard',
          use_ai: !!cmdOpts.ai
        });
        console.log('\nExtraction Result:');
        console.log(`Title:       ${result.name ?? 'Not found'}`);
        console.log(`Price:       ${typeof result.price === 'object' ? JSON.stringify(result.price) : (result.price ?? 'Not found')}`);
        console.log(`Currency:    ${result.currency ?? 'Not found'}`);
        console.log(`Stock:       ${result.stockStatus ?? 'Unknown'}`);
        console.log(`Candidates:  ${result.priceCandidates?.length || 0} candidate(s)`);
        if (result.priceCandidates && result.priceCandidates.length > 0) {
          console.log('\nPrice Candidates:');
          console.log(JSON.stringify(scrubSensitiveData(result.priceCandidates), null, 2));
        }
      } catch (err: any) {
        console.error(`Extraction failed: ${scrubSensitiveData(err.message)}`);
        process.exit(1);
      }
    });

  return program;
}
