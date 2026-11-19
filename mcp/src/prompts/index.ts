import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../client/api.js';

export function registerPrompts(server: McpServer, _client: PriceStalkerApiClient) {
  // debug-retailer prompt
  server.prompt(
    'debug-retailer',
    'Interactive diagnostic workflow to investigate broken retailer scraping rules and prepare a selector diff for the Admin UI',
    {
      domain: z.string().describe('The retailer domain to investigate (e.g. bestbuy.com, amazon.com)')
    },
    ({ domain }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please help me diagnose and debug the scraping configuration for retailer domain "${domain}".

Please perform the following diagnostic steps:
1. Call "get_retailer_config" with domain "${domain}" to inspect current selector rules and flags (use_browser_scraper, user_agent, etc.).
2. Call "query_system_logs" filtering for context="Scraper" and level="error" with search="${domain}" to examine recent failure reasons or HTTP blocks.
3. Call "list_items" to identify any tracked products belonging to this retailer domain, and inspect their price/stock trends with "get_price_history".
4. Analyze the errors and selector rules.
5. Provide a clear diagnosis and propose a concrete configuration diff or JSON snippet that I can review and apply in the PriceStalker Admin Panel (Admin -> Retailers -> ${domain}). Do not attempt to write directly to the database.`
        }
      }]
    })
  );
}
