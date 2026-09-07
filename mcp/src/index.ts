#!/usr/bin/env node
import 'dotenv/config';
import { PriceStalkerApiClient } from './client/api.js';
import { createCli } from './cli/index.js';
import { runStdioServer } from './server.js';

function getClient(options: { url?: string; token?: string }) {
  const url = options.url || process.env.PRICESTALKER_URL || 'http://localhost:3000';
  const token = options.token || process.env.PRICESTALKER_TOKEN || '';
  return new PriceStalkerApiClient({ baseUrl: url, apiToken: token });
}

async function main() {
  const args = process.argv.slice(2);

  // If invoked with no arguments and stdin is not a TTY (i.e. spawned as sub-process by Claude/Cursor MCP host)
  // or explicitly with "mcp", start MCP server directly.
  if (args.length === 0 && !process.stdin.isTTY) {
    const client = getClient({});
    await runStdioServer(client);
    return;
  }

  const cli = createCli(getClient);
  await cli.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('PriceStalker CLI Error:', err);
  process.exit(1);
});
