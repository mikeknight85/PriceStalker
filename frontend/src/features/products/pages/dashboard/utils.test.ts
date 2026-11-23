import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredChoice,
  writeStoredChoice,
  isPriceReviewResponse,
  getWebsite,
  calculateDashboardSummary,
  clearDashboardStorage,
  DASHBOARD_STORAGE_KEYS,
  STOCK_STATUS_LABELS,
} from './utils';
import type { Product, PriceReviewResponse } from '../../../../types/api';

describe('dashboard utils', () => {
  let store: Record<string, string>;
  let mockStorage: Storage;

  beforeEach(() => {
    vi.restoreAllMocks();
    store = {};
    mockStorage = {
      getItem: vi.fn((k: string) => store[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
      length: 0,
    };
    (globalThis as any).localStorage = mockStorage;
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
  });

  describe('readStoredChoice & writeStoredChoice', () => {
    const allowed = ['active', 'paused', 'all'] as const;

    it('returns saved value if allowed', () => {
      writeStoredChoice('test_filter', 'paused');
      expect(readStoredChoice('test_filter', allowed, 'all')).toBe('paused');
    });

    it('returns fallback if value is not in allowed list', () => {
      writeStoredChoice('test_filter', 'invalid_option');
      expect(readStoredChoice('test_filter', allowed, 'all')).toBe('all');
    });

    it('returns fallback if nothing is stored', () => {
      expect(readStoredChoice('empty_key', allowed, 'active')).toBe('active');
    });

    it('handles localStorage throwing on read gracefully', () => {
      (mockStorage.getItem as any).mockImplementationOnce(() => {
        throw new Error('QuotaExceeded or SecurityError in private mode');
      });
      expect(readStoredChoice('test_filter', allowed, 'all')).toBe('all');
    });

    it('handles localStorage throwing on write gracefully', () => {
      (mockStorage.setItem as any).mockImplementationOnce(() => {
        throw new Error('Storage write failed');
      });
      expect(() => writeStoredChoice('test_filter', 'active')).not.toThrow();
    });
  });

  describe('isPriceReviewResponse', () => {
    it('returns true when needsReview is true', () => {
      const review: PriceReviewResponse = {
        needsReview: true,
        name: 'Sample',
        imageUrl: null,
        stockStatus: 'in_stock',
        priceCandidates: [],
        reviewReason: 'no_consensus',
        url: 'https://example.com/item',
      };
      expect(isPriceReviewResponse(review)).toBe(true);
    });

    it('returns false for regular Product', () => {
      const product: Product = {
        id: 1,
        name: 'Sample',
        url: 'https://example.com/p/1',
      } as any;
      expect(isPriceReviewResponse(product)).toBe(false);
    });
  });

  describe('getWebsite', () => {
    it('extracts hostname and removes www.', () => {
      expect(getWebsite('https://www.amazon.com/product/123')).toBe('amazon.com');
      expect(getWebsite('http://www.bestbuy.ca/item')).toBe('bestbuy.ca');
    });

    it('retains subdomain if not www', () => {
      expect(getWebsite('https://store.steampowered.com/app/10')).toBe('store.steampowered.com');
    });

    it('returns input url when url parsing fails', () => {
      expect(getWebsite('not-a-valid-url')).toBe('not-a-valid-url');
      expect(getWebsite('')).toBe('');
    });
  });

  describe('calculateDashboardSummary', () => {
    it('returns null for an empty product list', () => {
      expect(calculateDashboardSummary([])).toBeNull();
    });

    it('computes summary metrics correctly across product dataset', () => {
      const products: Product[] = [
        {
          id: 1,
          name: 'P1',
          url: 'https://a.com/1',
          retailer_name: 'Store A',
          category: 'Tech',
          current_price: 50,
          original_price: 100,
          target_price: 60,
          min_price: 50,
          price_change_7d: -20,
          checking_paused: false,
          stock_status: 'in_stock',
        } as any,
        {
          id: 2,
          name: 'P2',
          url: 'https://a.com/2',
          retailer_name: 'Store A',
          category: 'Tech',
          current_price: 80,
          original_price: 80,
          target_price: 70,
          min_price: 40,
          price_change_7d: -5,
          checking_paused: true,
          stock_status: 'out_of_stock',
        } as any,
        {
          id: 3,
          name: 'P3',
          url: 'https://b.com/3',
          retailer_name: 'Store B',
          category: 'Home',
          current_price: 25,
          original_price: 20,
          target_price: null,
          min_price: 30,
          price_change_7d: 5,
          checking_paused: false,
          stock_status: 'pre_order',
        } as any,
        {
          id: 4,
          name: 'P4',
          url: 'https://c.com/4',
          retailer_name: null,
          category: null,
          current_price: 10,
          original_price: null,
          target_price: 10,
          min_price: 10,
          price_change_7d: -50,
          checking_paused: false,
          stock_status: undefined,
        } as any,
      ];

      const summary = calculateDashboardSummary(products);
      expect(summary).not.toBeNull();
      if (!summary) return;

      expect(summary.totalProducts).toBe(4);
      expect(summary.pausedProducts).toBe(1);
      expect(summary.activeProducts).toBe(3);
      expect(summary.onSaleCount).toBe(1); // Only P1 has current_price < original_price

      // At target price: P1 (50 <= 60), P4 (10 <= 10)
      expect(summary.atTargetPrice.map(p => p.id)).toEqual([1, 4]);

      // At historical low: P1 (50 <= 50), P3 (25 <= 30), P4 (10 <= 10)
      expect(summary.atHistoricalLow.map(p => p.id)).toEqual([1, 3, 4]);

      // Biggest drops: drops are P4 (-50), P1 (-20), P2 (-5) sorted ascending
      expect(summary.biggestDrops.map(p => p.id)).toEqual([4, 1, 2]);

      // Retailer counts (Store A: 2, Store B: 1, Unknown: 1)
      expect(summary.retailerCounts).toEqual([
        { name: 'Store A', count: 2 },
        { name: 'Store B', count: 1 },
        { name: 'Unknown', count: 1 },
      ]);

      // Tag counts (Tech: 2, Home: 1, Untagged: 1)
      expect(summary.tagCounts).toEqual([
        { name: 'Tech', count: 2 },
        { name: 'Home', count: 1 },
        { name: 'Untagged', count: 1 },
      ]);

      // Stock counts
      const inStock = summary.stockCounts.find(s => s.name === STOCK_STATUS_LABELS.in_stock);
      const outOfStock = summary.stockCounts.find(s => s.name === STOCK_STATUS_LABELS.out_of_stock);
      const preOrder = summary.stockCounts.find(s => s.name === STOCK_STATUS_LABELS.pre_order);
      const unknown = summary.stockCounts.find(s => s.name === STOCK_STATUS_LABELS.unknown);

      expect(inStock?.count).toBe(1);
      expect(outOfStock?.count).toBe(1);
      expect(preOrder?.count).toBe(1);
      expect(unknown?.count).toBe(1);
    });
  });

  describe('clearDashboardStorage', () => {
    it('removes all dashboard storage keys', () => {
      for (const key of DASHBOARD_STORAGE_KEYS) {
        mockStorage.setItem(key, 'val');
      }
      expect(mockStorage.getItem(DASHBOARD_STORAGE_KEYS[0])).toBe('val');

      clearDashboardStorage();

      for (const key of DASHBOARD_STORAGE_KEYS) {
        expect(mockStorage.getItem(key)).toBeNull();
      }
    });

    it('survives if localStorage throws', () => {
      (mockStorage.removeItem as any).mockImplementationOnce(() => {
        throw new Error('Access denied');
      });
      expect(() => clearDashboardStorage()).not.toThrow();
    });
  });
});
