import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../../client/api.js';

export function registerSystemTools(server: McpServer, client: PriceStalkerApiClient) {
  // 1. test_notification_channel
  server.tool(
    'test_notification_channel',
    'Dispatch a live test notification to verify channel credentials and formatting',
    {
      channel: z.enum(['telegram', 'discord', 'pushover', 'ntfy', 'gotify', 'email', 'webhook']).describe('Notification channel to test'),
      target: z.string().optional().describe('Optional target override (e.g. email address, chat ID, webhook URL)')
    },
    async ({ channel, target }) => {
      try {
        const result = await client.testNotificationChannel(channel, target);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ channel, result }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to test notification channel ${channel}: ${error.message}` }]
        };
      }
    }
  );

  // 2. test_ai_provider
  server.tool(
    'test_ai_provider',
    'Verify connectivity, credentials, and model availability for an AI provider',
    {
      provider: z.enum(['gemini', 'vertex', 'anthropic', 'deepseek', 'groq', 'mistral', 'openai', 'openrouter', 'openai-compatible', 'ollama']).describe('AI Provider to test'),
      api_key: z.string().optional().describe('API key (if testing credentials before saving)'),
      model: z.string().optional().describe('Model identifier'),
      base_url: z.string().optional().describe('Base URL (required for ollama and openai-compatible)')
    },
    async ({ provider, api_key, model, base_url }) => {
      try {
        const result = await client.testAiProvider(provider, {
          api_key,
          model,
          base_url
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ provider, result }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to test AI provider ${provider}: ${error.message}` }]
        };
      }
    }
  );

  // 3. flush_system_caches
  server.tool(
    'flush_system_caches',
    'Invalidate all PriceStalker internal caches (retailer configs, regional mappings, system settings)',
    {},
    async () => {
      try {
        const result = await client.clearCaches();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to flush system caches: ${error.message}` }]
        };
      }
    }
  );

  // 4. query_system_logs
  server.tool(
    'query_system_logs',
    'Query and filter PriceStalker system logs for errors, scraper traces, and activity',
    {
      level: z.enum(['info', 'warn', 'error']).optional().describe('Filter by log level'),
      context: z.string().optional().describe('Filter by log context (e.g. Scraper, Products, Admin, System)'),
      search: z.string().optional().describe('Free text search query within log messages'),
      limit: z.number().optional().describe('Max number of logs to retrieve (default: 30)')
    },
    async ({ level, context, search, limit = 30 }) => {
      try {
        const result = await client.getLogs({ level, context, search, limit });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total: result.total,
              retrieved: result.logs.length,
              logs: result.logs
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to query system logs: ${error.message}` }]
        };
      }
    }
  );

  // 5. get_system_health
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
            text: JSON.stringify({
              status: 'running',
              version: version.version,
              database: dbHealth
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get system health: ${error.message}` }]
        };
      }
    }
  );
}
