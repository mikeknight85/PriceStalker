import { describe, it, expect, vi, beforeEach } from 'vitest';
import pool from '../../src/config/database';
import { getStoreContext, hostOf } from '../../src/services/domain/product/repositories/store-context';

vi.mock('../../src/config/database', () => ({
  default: {
    query: vi.fn(),
  },
}));

const mockQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

describe('store-context repository & hostOf helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hostOf', () => {
    it('extracts hostname and strips leading www.', () => {
      expect(hostOf('https://www.digitec.ch/en/s1/product/123')).toBe('digitec.ch');
      expect(hostOf('http://www.sub.example.com/item')).toBe('sub.example.com');
      expect(hostOf('https://amazon.co.uk/dp/B0001')).toBe('amazon.co.uk');
    });

    it('handles domains without www.', () => {
      expect(hostOf('https://galaxus.de/p/999')).toBe('galaxus.de');
      expect(hostOf('http://localhost:3000/test')).toBe('localhost');
      expect(hostOf('http://192.168.1.50/store')).toBe('192.168.1.50');
    });

    it('returns null on invalid or malformed URLs without throwing', () => {
      expect(hostOf('')).toBeNull();
      expect(hostOf('not-a-url')).toBeNull();
      expect(hostOf('://bad-scheme')).toBeNull();
      expect(hostOf(null as any)).toBeNull();
      expect(hostOf(undefined as any)).toBeNull();
    });
  });

  describe('getStoreContext', () => {
    it('returns store name and count from database query result', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            store_name: 'Digitec',
            store_count: 3,
          },
        ],
      });

      const context = await getStoreContext(42);
      expect(context).toEqual({
        storeName: 'Digitec',
        storeCount: 3,
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][1]).toEqual([42]);
    });

    it('returns null storeName and 1 storeCount when query returns 0 rows', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const context = await getStoreContext(999);
      expect(context).toEqual({
        storeName: null,
        storeCount: 1,
      });
    });

    it('clamps storeCount to at least 1 when row.store_count is 0 or null', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            store_name: 'Single Shop',
            store_count: 0,
          },
        ],
      });

      const context1 = await getStoreContext(1);
      expect(context1).toEqual({
        storeName: 'Single Shop',
        storeCount: 1,
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            store_name: 'No Sibling Shop',
            store_count: null,
          },
        ],
      });

      const context2 = await getStoreContext(2);
      expect(context2).toEqual({
        storeName: 'No Sibling Shop',
        storeCount: 1,
      });
    });

    it('handles null store_name gracefully in row', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            store_name: null,
            store_count: 4,
          },
        ],
      });

      const context = await getStoreContext(10);
      expect(context).toEqual({
        storeName: null,
        storeCount: 4,
      });
    });

    it('catches database error and safely falls back without throwing', async () => {
      mockQuery.mockRejectedValueOnce(new Error('PostgreSQL connection terminated unexpectedly'));

      const context = await getStoreContext(5);
      expect(context).toEqual({
        storeName: null,
        storeCount: 1,
      });
    });
  });
});
