import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PriceStalkerApiClient } from '../client/api.js';

export function registerResources(server: McpServer, client: PriceStalkerApiClient) {
  // 1. pricestalker://retailers/{domain}
  server.resource(
    'retailer-config',
    new ResourceTemplate('pricestalker://retailers/{domain}', { list: undefined }),
    async (uri, { domain }) => {
      try {
        const config = await client.getRetailerByDomain(domain as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(config || { error: `Retailer ${domain} not found.` }, null, 2),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: error.message }, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );

  // 2. pricestalker://scrapes/recent-errors
  server.resource(
    'recent-scrape-errors',
    'pricestalker://scrapes/recent-errors',
    async (uri) => {
      try {
        const logs = await client.getLogs({ level: 'error', limit: 20 });
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(logs, null, 2),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: error.message }, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );

  // 3. pricestalker://deals/active
  server.resource(
    'active-deals',
    'pricestalker://deals/active',
    async (uri) => {
      try {
        const items = await client.getItems();
        const deals = items
          .filter(i => i.target_price !== null && (i.best_price ?? Infinity) <= (i.target_price ?? 0))
          .map(i => ({
            id: i.id,
            name: i.name,
            best_price: i.best_price,
            target_price: i.target_price,
            currency: i.currency,
            store_count: i.stores?.length || 0
          }));

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ count: deals.length, deals }, null, 2),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: error.message }, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );

  // 4. pricestalker://system/health
  server.resource(
    'system-health',
    'pricestalker://system/health',
    async (uri) => {
      try {
        const [db, version] = await Promise.all([
          client.getDbHealth().catch(e => ({ status: 'unknown', error: e.message })),
          client.getVersion().catch(e => ({ version: 'unknown', error: e.message }))
        ]);

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ version: version.version, database: db }, null, 2),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: error.message }, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );
}
