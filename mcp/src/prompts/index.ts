import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../client/api.js';

export function registerPrompts(server: McpServer, client: PriceStalkerApiClient) {
  // 1. debug-retailer prompt
  server.prompt(
    'debug-retailer',
    'Interactive workflow to inspect a broken retailer, evaluate live candidates, and update selector config',
    {
      domain: z.string().describe('The retailer domain (e.g. bestbuy.com)'),
      sample_url: z.string().url().describe('A live sample product URL from this retailer')
    },
    ({ domain, sample_url }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please help me debug and fix the scraper configuration for the retailer domain "${domain}".
Here is a live sample product URL to test: ${sample_url}

Please perform the following steps:
1. Fetch and inspect the live page using the "inspect_url_prices" tool on ${sample_url}.
2. Compare the candidate prices found (deal price vs regular price vs original price).
3. Use "generate_retailer_selectors" to get recommended CSS selectors.
4. Test the candidate selectors using "test_retailer_config".
5. If the extracted price and name look correct, explain your findings and offer to save the config using "save_retailer_config".`
        }
      }]
    })
  );

  // 2. deal-advisor prompt
  server.prompt(
    'deal-advisor',
    'Compile an intelligent purchase advisory report across all tracked items',
    {},
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze my tracked items in PriceStalker and give me an intelligent shopping advice report:
1. List all active price drops and items currently below my target price using "list_deals_and_drops".
2. For any top deals, analyze their price history trends using "analyze_price_trend".
3. Group the items into "Strong Buy (at all-time low)", "Fair Deal", and "Wait (likely to drop further)".`
        }
      }]
    })
  );

  // 3. batch-ingest prompt
  server.prompt(
    'batch-ingest',
    'Extract, preview, and batch track products from freeform text or wishlists',
    {
      notes_or_text: z.string().describe('Freeform text containing product links')
    },
    ({ notes_or_text }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Here is a list of product links or notes to track:

${notes_or_text}

Please:
1. Extract all product URLs from the text.
2. For each URL, run "meta_extract_url" to preview the product title, current price, and store.
3. Present the list to me in a clean summary table.
4. Ask if I want to track all of them with default or custom target prices.`
        }
      }]
    })
  );
}
