import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { PriceStalkerApiClient } from '../src/client/api.js';

vi.mock('axios');

describe('PriceStalkerApiClient', () => {
  let client: PriceStalkerApiClient;
  const mockAxiosInstance: any = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      response: {
        use: vi.fn()
      }
    }
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (axios.create as any).mockReturnValue(mockAxiosInstance);
    client = new PriceStalkerApiClient({
      baseUrl: 'http://localhost:3001',
      apiToken: 'ps_test_token_123'
    });
  });

  it('initializes axios with correct baseURL and auth header', () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ps_test_token_123'
      }
    });
  });

  it('clearCaches sends clear-settings-cache to singular /api/admin/command', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { success: true, message: 'System caches cleared successfully' }
    });

    const res = await client.clearCaches();
    // Confirms fix for issue #163 route bug (/api/admin/commands -> /api/admin/command)
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/command', {
      command: 'clear-settings-cache'
    });
    expect(res.success).toBe(true);
  });

  it('getItems fetches /api/products/items', async () => {
    const mockItems = [{ id: 1, name: 'GPU', target_price: 500 }];
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockItems });

    const res = await client.getItems();
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products/items');
    expect(res).toEqual(mockItems);
  });

  it('getItem fetches /api/products/:id', async () => {
    const mockProduct = { id: 42, name: 'Monitor', current_price: 299 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockProduct });

    const res = await client.getItem(42);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products/42');
    expect(res).toEqual(mockProduct);
  });

  it('searchItems queries /api/products/search', async () => {
    const mockResults = [{ title: 'Keyboard', url: 'https://store.example/kb' }];
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResults });

    const res = await client.searchItems('mechanical keyboard');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products/search', {
      params: { q: 'mechanical keyboard' }
    });
    expect(res).toEqual(mockResults);
  });

  it('getPriceHistory queries /api/prices/:id/history with optional days', async () => {
    const mockHistory = { history: [] };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockHistory });

    const res = await client.getPriceHistory(10, 60);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/prices/10/history', {
      params: { days: 60 }
    });
    expect(res).toEqual(mockHistory);
  });

  it('getStockHistory queries /api/prices/:id/stock-history', async () => {
    const mockStock = { history: [] };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockStock });

    const res = await client.getStockHistory(10, 30);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/prices/10/stock-history', {
      params: { days: 30 }
    });
    expect(res).toEqual(mockStock);
  });

  it('refreshProductPrice posts to /api/prices/:id/refresh', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({ data: { message: 'Refreshed' } });

    const res = await client.refreshProductPrice(5);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/prices/5/refresh');
    expect(res.message).toBe('Refreshed');
  });

  it('getRetailerByDomain queries /api/admin/retailers/domain/:domain', async () => {
    const mockConfig = { domain: 'amazon.com', name_selectors: ['#title'] };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockConfig });

    const res = await client.getRetailerByDomain('amazon.com');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/retailers/domain/amazon.com');
    expect(res).toEqual(mockConfig);
  });

  it('getRetailerByDomain returns null on 404', async () => {
    mockAxiosInstance.get.mockRejectedValueOnce({
      response: { status: 404 }
    });

    const res = await client.getRetailerByDomain('unknown.com');
    expect(res).toBeNull();
  });

  it('getLogs queries /api/admin/logs with filter params', async () => {
    const mockLogs = { logs: [], total: 0, page: 1, limit: 30 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockLogs });

    const res = await client.getLogs({ level: 'error', limit: 20 });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/logs', {
      params: { level: 'error', limit: 20 }
    });
    expect(res).toEqual(mockLogs);
  });

  it('getDbHealth and getVersion call correct endpoints', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { status: 'healthy' } })
      .mockResolvedValueOnce({ data: { version: '2.2.0' } });

    const [health, version] = await Promise.all([
      client.getDbHealth(),
      client.getVersion()
    ]);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/debug/db-health');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/system/version');
    expect(health.status).toBe('healthy');
    expect(version.version).toBe('2.2.0');
  });

  it('debugExtract posts to /api/admin/debug/extract with options', async () => {
    const mockResult = { success: true, price: 49.99, name: 'Sample Item' };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

    const res = await client.debugExtract({
      url: 'https://store.example/item',
      mode: 'standard',
      use_ai: true
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/debug/extract', {
      url: 'https://store.example/item',
      mode: 'standard',
      use_ai: true
    });
    expect(res).toEqual(mockResult);
  });
});
