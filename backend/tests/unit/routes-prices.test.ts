import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const historyService = {
  getPriceHistory: vi.fn(),
  getProduct: vi.fn(),
  getStockHistory: vi.fn(),
};

const refreshService = {
  refreshProduct: vi.fn(),
};

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 42;
    next();
  },
}));

vi.mock('../../src/middleware/scope', () => ({
  requireScopeByMethod: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/services/domain/product', () => ({
  productHistoryService: historyService,
  productRefreshService: refreshService,
}));

vi.mock('../../src/utils/system/route-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/system/route-helpers')>();
  return {
    ...actual,
    callerIsAdmin: vi.fn().mockResolvedValue(false),
  };
});

describe('Prices Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/prices')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/prices', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/prices/:productId/history', () => {
    it('returns 400 for non-numeric product ID', async () => {
      const res = await fetch(`${baseUrl}/api/prices/notanumber/history`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid product ID');
    });

    it('returns price history for valid product ID', async () => {
      const mockHistory = {
        prices: [{ price: 99.99, recorded_at: '2026-01-01' }],
        stats: { min: 99.99, max: 99.99, avg: 99.99 },
      };
      historyService.getPriceHistory.mockResolvedValue(mockHistory);

      const res = await fetch(`${baseUrl}/api/prices/123/history?days=60`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockHistory);
      expect(historyService.getPriceHistory).toHaveBeenCalledWith(123, 42, 60, false);
    });
  });

  describe('POST /api/prices/:productId/refresh', () => {
    it('returns 400 for invalid product ID', async () => {
      const res = await fetch(`${baseUrl}/api/prices/invalid/refresh`, { method: 'POST' });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid product ID');
    });

    it('returns 404 when product is not found or not owned by user', async () => {
      historyService.getProduct.mockResolvedValue(null);

      const res = await fetch(`${baseUrl}/api/prices/999/refresh`, { method: 'POST' });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Product not found');
    });

    it('refreshes price successfully when product is in stock', async () => {
      const mockProduct = { id: 10, name: 'Widget' };
      historyService.getProduct.mockResolvedValue(mockProduct);
      refreshService.refreshProduct.mockResolvedValue({
        currentPrice: 49.99,
        stockStatus: 'in_stock',
      });

      const res = await fetch(`${baseUrl}/api/prices/10/refresh`, { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Price refreshed successfully');
      expect(data.currentPrice).toBe(49.99);
      expect(refreshService.refreshProduct).toHaveBeenCalledWith(mockProduct);
    });

    it('reports out-of-stock message when refreshed product is out of stock', async () => {
      const mockProduct = { id: 11, name: 'Rare Widget' };
      historyService.getProduct.mockResolvedValue(mockProduct);
      refreshService.refreshProduct.mockResolvedValue({
        currentPrice: null,
        stockStatus: 'out_of_stock',
      });

      const res = await fetch(`${baseUrl}/api/prices/11/refresh`, { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Product is currently out of stock');
      expect(data.stockStatus).toBe('out_of_stock');
    });
  });

  describe('GET /api/prices/:productId/stock-history', () => {
    it('returns 400 for invalid product ID', async () => {
      const res = await fetch(`${baseUrl}/api/prices/invalid/stock-history`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid product ID');
    });

    it('returns stock history for valid product ID with default 30 days', async () => {
      const mockStockHistory = [
        { status: 'in_stock', changed_at: '2026-01-01' },
      ];
      historyService.getStockHistory.mockResolvedValue(mockStockHistory);

      const res = await fetch(`${baseUrl}/api/prices/50/stock-history`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockStockHistory);
      expect(historyService.getStockHistory).toHaveBeenCalledWith(50, 42, 30, false);
    });
  });
});
