import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../client/api.js';
import { formatScrubbedJson, scrubSensitiveData } from '../utils/scrubber.js';

export function registerTools(server: McpServer, client: PriceStalkerApiClient) {
  // 1. get_system_health
  server.tool(
    'get_system_health',
    'Get system health metrics including database connection status and application version',
    {},
    async () => {
      try {
        const [dbHealth, version] = await Promise.all([
          client.getDbHealth().catch(e => ({ status: 'unknown', error: e.message })),
          client.getVersion().catch(e => ({ version: 'unknown', error: e.message }))
        ]);

        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson({
              status: 'running',
              version: version.version,
              database: dbHealth
            })
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get system health: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 2. query_system_logs
  server.tool(
    'query_system_logs',
    'Query and filter PriceStalker system logs for errors, scraper traces, and activity (capped and redacted)',
    {
      level: z.enum(['info', 'warn', 'error']).optional().describe('Filter by log level'),
      context: z.string().optional().describe('Filter by log context (e.g. Scraper, Products, Admin, System)'),
      search: z.string().optional().describe('Free text search query within log messages'),
      limit: z.number().optional().describe('Number of logs to retrieve (capped at 50, default: 30)')
    },
    async ({ level, context, search, limit }) => {
      try {
        // Enforce server-side limit to prevent blowing model context
        const effectiveLimit = Math.min(Math.max(1, limit ?? 30), 50);
        const result = await client.getLogs({ level, context, search, limit: effectiveLimit });

        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson({
              total: result.total,
              retrieved: result.logs.length,
              logs: result.logs
            })
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to query system logs: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 3. list_items
  server.tool(
    'list_items',
    'List all tracked items with their best prices and store listings',
    {},
    async () => {
      try {
        const items = await client.getItems();
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(items)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list items: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 4. get_item
  server.tool(
    'get_item',
    'Get full details for a tracked product or store listing by its ID',
    {
      id: z.number().describe('Product or store listing ID')
    },
    async ({ id }) => {
      try {
        const product = await client.getItem(id);
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(product)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get item #${id}: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 5. search_items
  server.tool(
    'search_items',
    'Perform a product search via SearXNG',
    {
      query: z.string().describe('Search query string')
    },
    async ({ query }) => {
      try {
        const results = await client.searchItems(query);
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(results)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Search failed for "${query}": ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 6. get_price_history
  server.tool(
    'get_price_history',
    'Get recorded price and stock history for a tracked product',
    {
      productId: z.number().describe('Product ID'),
      days: z.number().optional().describe('Number of days of history (optional)')
    },
    async ({ productId, days }) => {
      try {
        const [priceHistory, stockHistory] = await Promise.all([
          client.getPriceHistory(productId, days),
          client.getStockHistory(productId, days ?? 30).catch(() => ({ history: [] }))
        ]);

        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson({
              priceHistory,
              stockHistory: stockHistory.history
            })
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get price history for product #${productId}: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 7. get_retailer_config
  server.tool(
    'get_retailer_config',
    'Fetch the scraping selector configuration and DSL rules for a retailer domain',
    {
      domain: z.string().describe('The retailer domain (e.g. bestbuy.com, amazon.com)')
    },
    async ({ domain }) => {
      try {
        const config = await client.getRetailerByDomain(domain);
        if (!config) {
          return {
            content: [{
              type: 'text',
              text: `No retailer configuration found for domain "${domain}".`
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(config)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get retailer config for "${domain}": ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 8. refresh_product_price
  server.tool(
    'refresh_product_price',
    'Trigger an immediate live price scrape for a specific tracked product (requires mcp:write scope)',
    {
      productId: z.number().describe('Product ID to refresh')
    },
    async ({ productId }) => {
      try {
        const result = await client.refreshProductPrice(productId);
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(result)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to refresh product #${productId}: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );

  // 9. flush_system_caches
  server.tool(
    'flush_system_caches',
    'Invalidate all PriceStalker internal caches: retailer configs, regional mappings, system settings (requires admin:system scope)',
    {},
    async () => {
      try {
        const result = await client.clearCaches();
        return {
          content: [{
            type: 'text',
            text: formatScrubbedJson(result)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to flush system caches: ${scrubSensitiveData(error.message)}` }]
        };
      }
    }
  );
}
