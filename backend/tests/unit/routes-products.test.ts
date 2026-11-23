import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const historyService = {
  getUserProducts: vi.fn(),
  getUserItems: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
};

const addService = {
  addProduct: vi.fn(),
  scanProduct: vi.fn(),
  confirmProductSelection: vi.fn(),
};

const searchServiceMock = {
  search: vi.fn(),
};

const itemRepoMock = {
  attachListing: vi.fn(),
  detachListing: vi.fn(),
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
  productAddService: addService,
}));

vi.mock('../../src/services/domain/product/SearchService', () => ({
  SearchService: class {
    search = searchServiceMock.search;
  },
}));

vi.mock('../../src/models', () => ({
  itemRepository: itemRepoMock,
}));

vi.mock('../../src/utils/system/route-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/system/route-helpers')>();
  return {
    ...actual,
    callerIsAdmin: vi.fn().mockResolvedValue(false),
  };
});

describe('Product Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/products')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/products', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/products', () => {
    it('returns products for the authenticated user', async () => {
      historyService.getUserProducts.mockResolvedValueOnce([{ id: 1, name: 'Item 1' }]);

      const res = await fetch(`${baseUrl}/api/products`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([{ id: 1, name: 'Item 1' }]);
      expect(historyService.getUserProducts).toHaveBeenCalledWith(42);
    });
  });

  describe('GET /api/products/items', () => {
    it('returns grouped items for the authenticated user', async () => {
      historyService.getUserItems.mockResolvedValueOnce([{ id: 10, title: 'Grouped Item' }]);

      const res = await fetch(`${baseUrl}/api/products/items`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([{ id: 10, title: 'Grouped Item' }]);
      expect(historyService.getUserItems).toHaveBeenCalledWith(42);
    });
  });

  describe('POST /api/products/items/:itemId/listings', () => {
    it('returns 400 when itemId is invalid', async () => {
      const res = await fetch(`${baseUrl}/api/products/items/abc/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 5 }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid product id');
    });

    it('returns 400 when productId is missing or invalid', async () => {
      const res = await fetch(`${baseUrl}/api/products/items/10/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'invalid' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('A productId is required');
    });

    it('links store listing to item on valid parameters', async () => {
      itemRepoMock.attachListing.mockResolvedValueOnce({ id: 10, product_count: 2 });

      const res = await fetch(`${baseUrl}/api/products/items/10/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 5 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ id: 10, product_count: 2 });
      expect(itemRepoMock.attachListing).toHaveBeenCalledWith(5, 10, 42);
    });
  });

  describe('POST /api/products/:id/detach', () => {
    it('returns 400 on invalid id', async () => {
      const res = await fetch(`${baseUrl}/api/products/abc/detach`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid store id');
    });

    it('detaches listing successfully', async () => {
      itemRepoMock.detachListing.mockResolvedValueOnce({ id: 11, title: 'Detached Item' });

      const res = await fetch(`${baseUrl}/api/products/5/detach`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ id: 11, title: 'Detached Item' });
      expect(itemRepoMock.detachListing).toHaveBeenCalledWith(5, 42);
    });
  });

  describe('POST /api/products (add)', () => {
    it('returns 400 when url is missing', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('URL is required');
    });

    it('returns 201 when product is added directly', async () => {
      addService.addProduct.mockResolvedValueOnce({ id: 1, name: 'Added Product', needsReview: false });

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/item' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(1);
    });

    it('returns 200 when product addition requires review', async () => {
      addService.addProduct.mockResolvedValueOnce({ needsReview: true, extractedPrice: 20 });

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/item' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.needsReview).toBe(true);
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns 400 for invalid ID', async () => {
      const res = await fetch(`${baseUrl}/api/products/xyz`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid product ID');
    });

    it('returns 404 when product is not found', async () => {
      historyService.getProduct.mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/products/999`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Product not found');
    });

    it('returns product when found', async () => {
      historyService.getProduct.mockResolvedValueOnce({ id: 999, name: 'Sample' });

      const res = await fetch(`${baseUrl}/api/products/999`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(999);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('returns 400 for invalid ID', async () => {
      const res = await fetch(`${baseUrl}/api/products/xyz`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when product to update is not found', async () => {
      historyService.updateProduct.mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/products/999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns updated product', async () => {
      historyService.updateProduct.mockResolvedValueOnce({ id: 999, name: 'Updated Name' });

      const res = await fetch(`${baseUrl}/api/products/999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('returns 400 for invalid ID', async () => {
      const res = await fetch(`${baseUrl}/api/products/xyz`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when product to delete is not found', async () => {
      historyService.deleteProduct.mockResolvedValueOnce(false);

      const res = await fetch(`${baseUrl}/api/products/999`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });

    it('returns success message on delete', async () => {
      historyService.deleteProduct.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/products/999`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Product deleted successfully');
    });
  });

  describe('POST /api/products/:id/scan and /confirm', () => {
    it('returns 400 on invalid ID for scan', async () => {
      const res = await fetch(`${baseUrl}/api/products/invalid/scan`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
    });

    it('handles 404 for scan', async () => {
      addService.scanProduct.mockRejectedValueOnce(new Error('Product not found'));

      const res = await fetch(`${baseUrl}/api/products/123/scan`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });

    it('handles successful scan', async () => {
      addService.scanProduct.mockResolvedValueOnce({ scanned: true });

      const res = await fetch(`${baseUrl}/api/products/123/scan`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.scanned).toBe(true);
    });

    it('confirms product selection', async () => {
      addService.confirmProductSelection.mockResolvedValueOnce({ id: 123, confirmed: true });

      const res = await fetch(`${baseUrl}/api/products/123/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 29.99 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.confirmed).toBe(true);
    });
  });

  describe('GET /api/products/search', () => {
    it('returns 400 when search query q is missing', async () => {
      const res = await fetch(`${baseUrl}/api/products/search`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Search query (q) is required');
    });

    it('returns search results for valid query', async () => {
      searchServiceMock.search.mockResolvedValueOnce([{ title: 'Match', url: 'https://ex.com' }]);

      const res = await fetch(`${baseUrl}/api/products/search?q=phone`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([{ title: 'Match', url: 'https://ex.com' }]);
      expect(searchServiceMock.search).toHaveBeenCalledWith('phone');
    });
  });
});
