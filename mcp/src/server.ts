import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PriceStalkerApiClient } from './client/api.js';
import { registerShoppingTools } from './tools/shopping/index.js';
import { registerTrackingTools } from './tools/tracking/index.js';
import { registerDeveloperTools } from './tools/developer/index.js';
import { registerSystemTools } from './tools/system/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export function createMcpServer(client: PriceStalkerApiClient): McpServer {
  const server = new McpServer({
    name: 'PriceStalker',
    version: '2.1.0'
  });

  // Register all capabilities
  registerShoppingTools(server, client);
  registerTrackingTools(server, client);
  registerDeveloperTools(server, client);
  registerSystemTools(server, client);
  registerResources(server, client);
  registerPrompts(server, client);

  return server;
}

export async function runStdioServer(client: PriceStalkerApiClient) {
  const server = createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
