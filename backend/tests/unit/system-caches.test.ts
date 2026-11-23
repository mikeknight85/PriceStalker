import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegionalMappingCache } from '../../src/utils/system/cache/RegionalMappingCache';
import { RetailerConfigCache } from '../../src/utils/system/cache/RetailerConfigCache';

const { regionalRepoMock, retailerRepoMock } = vi.hoisted(() => ({
  regionalRepoMock: {
    getAll: vi.fn(),
  },
  retailerRepoMock: {
    getConfigForUrl: vi.fn(),
  },
}));

vi.mock('../../src/models', () => ({
  regionalCurrencyRepository: regionalRepoMock,
  retailerRepository: retailerRepoMock,
}));

describe('System Caches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RegionalMappingCache', () => {
    let cache: RegionalMappingCache;

    beforeEach(() => {
      cache = new RegionalMappingCache();
    });

    it('caches mappings and avoids redundant repository calls within TTL', async () => {
      regionalRepoMock.getAll.mockResolvedValueOnce([
        { id: 1, country_code: 'AU', currency: 'AUD', pattern: '.com.au', match_type: 'tld' },
      ]);

      const res1 = await cache.getMappings();
      expect(res1).toHaveLength(1);
      expect(regionalRepoMock.getAll).toHaveBeenCalledTimes(1);

      // Second call must hit memory cache
      const res2 = await cache.getMappings();
      expect(res2).toEqual(res1);
      expect(regionalRepoMock.getAll).toHaveBeenCalledTimes(1);

      // Clearing cache forces fresh fetch
      cache.clear();
      regionalRepoMock.getAll.mockResolvedValueOnce([
        { id: 1, country_code: 'AU', currency: 'AUD', pattern: '.com.au', match_type: 'tld' },
      ]);
      await cache.getMappings();
      expect(regionalRepoMock.getAll).toHaveBeenCalledTimes(2);
    });

    it('derives currency hint for TLD matches', async () => {
      regionalRepoMock.getAll.mockResolvedValueOnce([
        { id: 1, country_code: 'CA', currency: 'CAD', pattern: '.ca', match_type: 'tld' },
        { id: 2, country_code: 'UK', currency: 'GBP', pattern: '.co.uk', match_type: 'tld' },
      ]);

      const hintCa = await cache.getHintForUrl('https://www.bestbuy.ca/en-ca/product/123');
      expect(hintCa).toBe('CAD');

      const hintUk = await cache.getHintForUrl('https://amazon.co.uk/dp/B08');
      expect(hintUk).toBe('GBP');

      const hintUnknown = await cache.getHintForUrl('https://example.com/p');
      expect(hintUnknown).toBeNull();
    });

    it('derives lookup domain for path patterns', async () => {
      regionalRepoMock.getAll.mockResolvedValueOnce([
        { id: 3, country_code: 'AU', currency: 'AUD', pattern: '/au/', match_type: 'path' },
      ]);

      const lookup = await cache.getLookupDomain('https://www.apple.com/au/shop/buy-iphone');
      expect(lookup).toBe('apple.com/au');

      const regular = await cache.getLookupDomain('https://www.apple.com/shop/buy-iphone');
      expect(regular).toBe('apple.com');
    });
  });

  describe('RetailerConfigCache', () => {
    let cache: RetailerConfigCache;

    beforeEach(() => {
      cache = new RetailerConfigCache();
    });

    it('caches retailer config and supports domain-level invalidation', async () => {
      retailerRepoMock.getConfigForUrl.mockResolvedValueOnce({
        id: 1,
        domain: 'apple.com',
        price_selector: '.price',
      });

      const config1 = await cache.getConfig('apple.com');
      expect(config1?.id).toBe(1);
      expect(retailerRepoMock.getConfigForUrl).toHaveBeenCalledTimes(1);

      // Second call uses memory cache
      const config2 = await cache.getConfig('apple.com');
      expect(config2).toBe(config1);
      expect(retailerRepoMock.getConfigForUrl).toHaveBeenCalledTimes(1);

      // Invalidate specific domain
      cache.invalidate('apple.com');
      retailerRepoMock.getConfigForUrl.mockResolvedValueOnce({
        id: 1,
        domain: 'apple.com',
        price_selector: '.updated-price',
      });

      const config3 = await cache.getConfig('apple.com');
      expect(config3?.price_selector).toBe('.updated-price');
      expect(retailerRepoMock.getConfigForUrl).toHaveBeenCalledTimes(2);
    });

    it('clears all entries on global invalidation', async () => {
      retailerRepoMock.getConfigForUrl.mockResolvedValue({ id: 2, domain: 'store.test' });

      await cache.getConfig('store.test');
      cache.invalidate(); // full clear
      await cache.getConfig('store.test');

      expect(retailerRepoMock.getConfigForUrl).toHaveBeenCalledTimes(2);
    });
  });
});
