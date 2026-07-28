import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { ApiError } from './error';
import { queryClient } from './queryClient';
import { syncProductCaches } from './productCache';
import type { Product, ProductWithStats } from '../types/api';

const location = { origin: 'http://localhost', pathname: '/products', search: '', hash: '', href: '' };
const storage = new Map<string, string>();

const product: ProductWithStats = {
  id: 1, user_id: 1, url: 'https://example.test/product', name: 'Original', image_url: null,
  refresh_interval: 3600, last_checked: null, next_check_at: null, stock_status: 'in_stock',
  price_drop_threshold: null, target_price: null, notify_back_in_stock: false,
  ai_verification_disabled: false, ai_extraction_disabled: false, checking_paused: false,
  category: null, created_at: '2026-01-01T00:00:00Z', current_price: 10, member_price: null,
  original_price: null, currency: 'USD', converted_price: null, converted_currency: null,
  ai_status: null, stats: { min_price: 8, max_price: 12, avg_price: 10, price_count: 3 },
};

beforeEach(() => {
  vi.stubGlobal('window', { location });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  storage.clear();
  location.href = '';
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('returns decoded data and sends auth/query parameters', async () => {
    storage.set('token', 'token-value');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get<{ enabled: boolean }>('/settings/discovery/status', { params: { q: 'test' } })).resolves.toEqual({ enabled: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/discovery/status?q=test', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-value' }),
    }));
  });

  it('throws ApiError for an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Conflict' }), { status: 409 })));
    await expect(api.post('/products', {})).rejects.toMatchObject({ status: 409, message: 'Conflict' } satisfies Partial<ApiError>);
  });

  it('merges a product mutation into caches without losing detail stats', () => {
    queryClient.setQueryData(['products'], [product]);
    queryClient.setQueryData(['products', product.id], product);
    const updated: Product = { ...product, name: 'Renamed' };

    syncProductCaches(updated);

    expect(queryClient.getQueryData<Product[]>(['products'])?.[0].name).toBe('Renamed');
    expect(queryClient.getQueryData<ProductWithStats>(['products', product.id])?.stats).toEqual(product.stats);
  });
});
