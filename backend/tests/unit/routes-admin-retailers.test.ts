import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const retailerServiceMock = {
  getAllRetailers: vi.fn(),
  getRetailerForUrl: vi.fn(),
  getRetailerByDomain: vi.fn(),
  testRetailerConfig: vi.fn(),
  upsertRetailer: vi.fn(),
  deleteRetailer: vi.fn(),
};

vi.mock('../../src/services/domain/retailer', () => ({
  retailerService: retailerServiceMock,
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Retailers Routes (/api/admin/retailers)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/admin/retailers')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/admin/retailers', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/admin/retailers', () => {
    it('returns all retailers', async () => {
      retailerServiceMock.getAllRetailers.mockResolvedValueOnce([{ id: 1, domain: 'amazon.com' }]);

      const res = await fetch(`${baseUrl}/api/admin/retailers`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([{ id: 1, domain: 'amazon.com' }]);
      expect(retailerServiceMock.getAllRetailers).toHaveBeenCalledWith(false);
    });
  });

  describe('GET /api/admin/retailers/lookup', () => {
    it('returns 400 when url query parameter is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/retailers/lookup`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('URL query parameter is required');
    });

    it('returns 404 when no configuration found for URL', async () => {
      retailerServiceMock.getRetailerForUrl.mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/admin/retailers/lookup?url=https://unknown.test/item`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('No configuration found for this URL');
    });

    it('returns config when found', async () => {
      retailerServiceMock.getRetailerForUrl.mockResolvedValueOnce({ id: 2, domain: 'store.test' });

      const res = await fetch(`${baseUrl}/api/admin/retailers/lookup?url=https://store.test/item`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ id: 2, domain: 'store.test' });
    });
  });

  describe('GET /api/admin/retailers/domain/:domain', () => {
    it('returns 404 when domain is not found', async () => {
      retailerServiceMock.getRetailerByDomain.mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/admin/retailers/domain/notfound.com`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Retailer not found');
    });

    it('returns retailer when domain exists', async () => {
      retailerServiceMock.getRetailerByDomain.mockResolvedValueOnce({ id: 3, domain: 'bestbuy.com' });

      const res = await fetch(`${baseUrl}/api/admin/retailers/domain/bestbuy.com`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.domain).toBe('bestbuy.com');
    });
  });

  describe('POST /api/admin/retailers/test', () => {
    it('returns 400 when url is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/retailers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('URL is required');
    });

    it('runs extraction test on valid payload', async () => {
      retailerServiceMock.testRetailerConfig.mockResolvedValueOnce({ price: 49.99, title: 'Item' });

      const res = await fetch(`${baseUrl}/api/admin/retailers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/p', config: { price_selector: '.price' } }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.price).toBe(49.99);
    });
  });

  describe('POST /api/admin/retailers (upsert)', () => {
    it('upserts retailer config successfully', async () => {
      retailerServiceMock.upsertRetailer.mockResolvedValueOnce({ id: 1, domain: 'shop.com' });

      const res = await fetch(`${baseUrl}/api/admin/retailers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'shop.com', name: 'Shop' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(1);
    });
  });

  describe('DELETE /api/admin/retailers/:id', () => {
    it('returns 400 for invalid ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/retailers/invalid`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when retailer to delete is not found', async () => {
      retailerServiceMock.deleteRetailer.mockResolvedValueOnce(false);

      const res = await fetch(`${baseUrl}/api/admin/retailers/999`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });

    it('deletes retailer successfully', async () => {
      retailerServiceMock.deleteRetailer.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/admin/retailers/1`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
