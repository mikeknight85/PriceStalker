import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These rules decide what becomes a product's authoritative price. Getting one
 * wrong does not throw -- it quietly writes a wrong number into history, or
 * quietly writes nothing, and the symptom only shows up on a chart weeks later.
 */

const priceHistory = {
  create: vi.fn().mockResolvedValue({}),
  getLatest: vi.fn().mockResolvedValue(null),
};
const product = {
  updateAnchorPrice: vi.fn().mockResolvedValue(undefined),
  updateExtractionMethod: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/models', () => ({
  priceHistoryRepository: priceHistory,
  productRepository: product,
  stockHistoryRepository: { recordChange: vi.fn() },
}));

const warn = vi.fn();
const info = vi.fn();
vi.mock('../../src/utils/system/logger', () => ({
  logger: {
    warn: (...a: unknown[]) => warn(...a),
    info: (...a: unknown[]) => info(...a),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const CLIENT = { query: vi.fn() } as never;

async function record(scraped: Record<string, unknown>, source = 'refresh') {
  const { ProductPersistenceService } = await import(
    '../../src/services/domain/product/ProductPersistenceService'
  );
  const service = new ProductPersistenceService();
  // recordPrices is private; the rules under test are entirely inside it.
  await (service as never as { recordPrices: Function }).recordPrices(CLIENT, 42, scraped, source);
}

const price = (p: number, currency: string | null = 'USD') => ({ price: p, currency });

describe('Price history persistence rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    priceHistory.getLatest.mockResolvedValue(null);
  });

  describe('everything runs on the caller transaction', () => {
    it('passes the transaction client to every price write and read', async () => {
      await record({ price: price(10), selectedMethod: 'css' });

      // The bug this replaces: these used the module-level pool, so a
      // price-history row committed on its own and survived a rollback of the
      // product write it belonged to.
      expect(priceHistory.getLatest).toHaveBeenCalledWith(42, 'standard', CLIENT);
      expect(priceHistory.create.mock.calls[0].at(-1)).toBe(CLIENT);
      expect(product.updateAnchorPrice).toHaveBeenCalledWith(42, 10, CLIENT);
      expect(product.updateExtractionMethod).toHaveBeenCalledWith(42, 'css', CLIENT);
    });
  });

  describe('currency is part of change detection', () => {
    it('records when only the currency changed', async () => {
      priceHistory.getLatest.mockResolvedValue({ price: 100, currency: 'USD' });

      await record({ price: price(100, 'AUD') });

      // Comparing the number alone wrote no row, so the product kept reporting
      // the old currency indefinitely.
      expect(priceHistory.create).toHaveBeenCalledTimes(1);
      expect(priceHistory.create.mock.calls[0][2]).toBe('AUD');
    });

    it('does not record when price and currency are both unchanged', async () => {
      priceHistory.getLatest.mockResolvedValue({ price: 100, currency: 'USD' });
      await record({ price: price(100, 'USD') });
      expect(priceHistory.create).not.toHaveBeenCalled();
    });

    it('compares correctly when the driver returns the price as a string', async () => {
      priceHistory.getLatest.mockResolvedValue({ price: '100.00', currency: 'USD' });
      await record({ price: price(100, 'USD') });
      expect(priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('prices awaiting review are not authoritative', () => {
    it('does not record a refresh price flagged for review', async () => {
      await record({ price: price(9.99), needsReview: true });

      expect(priceHistory.create).not.toHaveBeenCalled();
      // Nor may it become the anchor: that would make an unconfirmed
      // extraction the baseline for drift detection.
      expect(product.updateAnchorPrice).not.toHaveBeenCalled();
      expect(info.mock.calls.flat().join(' ')).toContain('awaiting review');
    });

    it('records when the user confirms it, because that is the review', async () => {
      await record({ price: price(9.99), needsReview: true }, 'manual-confirm');
      expect(priceHistory.create).toHaveBeenCalledTimes(1);
    });

    it('holds back member and original prices for the same reason', async () => {
      await record({
        price: price(10),
        memberPrice: price(8),
        originalPrice: price(12),
        needsReview: true,
      });
      expect(priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('missing currency is reported for every price type', () => {
    it('warns and skips a standard price with no currency', async () => {
      await record({ price: price(10, null) });
      expect(priceHistory.create).not.toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(' ')).toContain('no currency resolved');
    });

    it('warns and skips a member price with no currency', async () => {
      // These were skipped silently, so a retailer whose member price never had
      // a resolvable currency looked identical to one with no member price.
      await record({ memberPrice: price(8, null) });
      expect(priceHistory.create).not.toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(' ')).toContain('member-price');
    });

    it('warns and skips an original price with no currency', async () => {
      await record({ originalPrice: price(12, null) });
      expect(priceHistory.create).not.toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(' ')).toContain('original-price');
    });
  });

  describe('normal recording still works', () => {
    it('records a first price', async () => {
      await record({ price: price(19.99, 'EUR') });
      expect(priceHistory.create).toHaveBeenCalledWith(42, 19.99, 'EUR', undefined, null, 'standard', CLIENT);
    });

    it('records all three price types when they change', async () => {
      await record({ price: price(10), memberPrice: price(8), originalPrice: price(12) });
      const types = priceHistory.create.mock.calls.map((c) => c[5]);
      expect(types).toEqual(['standard', 'member-price', 'original-price']);
    });

    it('records an unchanged price on manual confirmation', async () => {
      priceHistory.getLatest.mockResolvedValue({ price: 10, currency: 'USD' });
      await record({ price: price(10) }, 'manual-confirm');
      expect(priceHistory.create).toHaveBeenCalledTimes(1);
    });
  });
});
