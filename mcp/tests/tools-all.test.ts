import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceStalkerApiClient } from '../src/client/api.js';
import { createMcpServer } from '../src/server.js';

describe('MCP Tools and Protocol Integration', () => {
  let client: PriceStalkerApiClient;

  beforeEach(() => {
    client = new PriceStalkerApiClient({
      baseUrl: 'http://localhost:3000',
      apiToken: 'pst_test'
    });
  });

  it('registers all tools properly', () => {
    const server = createMcpServer(client);
    expect(server).toBeDefined();
  });
});
