import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { PriceStalkerApiClient } from '../src/client/api.js';

vi.mock('axios');

describe('PriceStalkerApiClient', () => {
  let client: PriceStalkerApiClient;
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (axios.create as any).mockReturnValue(mockAxiosInstance);
    client = new PriceStalkerApiClient({
      baseUrl: 'http://localhost:3000',
      apiToken: 'pst_test_token'
    });
  });

  it('initializes axios with correct baseURL and auth header', () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer pst_test_token'
      }
    });
  });

  it('getItems returns array of items', async () => {
    const mockItems = [{ id: 1, name: 'Headphones', target_price: 100 }];
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockItems });

    const items = await client.getItems();
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products/items');
    expect(items).toEqual(mockItems);
  });

  it('addProduct sends url and options', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({ data: { id: 1, name: 'Test' } });

    const res = await client.addProduct('https://example.com/item', { target_price: 50 });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/products', {
      url: 'https://example.com/item',
      target_price: 50
    });
    expect(res).toEqual({ id: 1, name: 'Test' });
  });

  it('testRetailerConfig posts to admin test endpoint', async () => {
    const mockResult = { success: true, price: 99.99 };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

    const res = await client.testRetailerConfig('https://example.com/item', { price_selectors: ['.price'] });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/retailers/test', {
      url: 'https://example.com/item',
      config: { price_selectors: ['.price'] }
    });
    expect(res).toEqual(mockResult);
  });

  it('clearCaches sends clear-settings-cache command', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({ data: { success: true, message: 'Caches cleared' } });

    const res = await client.clearCaches();
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/commands', {
      command: 'clear-settings-cache'
    });
    expect(res.success).toBe(true);
  });
});
