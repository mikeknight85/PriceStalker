import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from '../src/server.js';
import { PriceStalkerApiClient } from '../src/client/api.js';

describe('MCP Server Registration', () => {
  let client: PriceStalkerApiClient;

  beforeEach(() => {
    client = new PriceStalkerApiClient({
      baseUrl: 'http://localhost:3000',
      apiToken: 'pst_mock'
    });
  });

  it('creates MCP server instance without throwing', () => {
    const server = createMcpServer(client);
    expect(server).toBeDefined();
  });
});
