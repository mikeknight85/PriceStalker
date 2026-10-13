import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PriceStalkerApiClient } from '../client/api.js';
import { formatScrubbedJson, scrubSensitiveData } from '../utils/scrubber.js';

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
            text: formatScrubbedJson(config || { error: `Retailer ${domain} not found.` }),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: formatScrubbedJson({ error: scrubSensitiveData(error.message) }),
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
            text: formatScrubbedJson(logs),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: formatScrubbedJson({ error: scrubSensitiveData(error.message) }),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );

  // 3. pricestalker://system/health
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
            text: formatScrubbedJson({
              status: 'running',
              version: version.version,
              database: db
            }),
            mimeType: 'application/json'
          }]
        };
      } catch (error: any) {
        return {
          contents: [{
            uri: uri.href,
            text: formatScrubbedJson({ error: scrubSensitiveData(error.message) }),
            mimeType: 'application/json'
          }]
        };
      }
    }
  );
}
