import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductDiscoveryService } from '../../src/services/domain/product/add/discovery';
import { scrapeProductWithVoting } from '../../src/services/scraper';
import { assertUrlIsSafe } from '../../src/utils/system/url-safety';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';

vi.mock('../../src/services/scraper', () => ({
  scrapeProductWithVoting: vi.fn(),
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn(),
}));

vi.mock('../../src/models', () => ({
  productRepository: {
    create: vi.fn(),
  },
}));

describe('ProductDiscoveryService Scrape Failure Reporting', () => {
  const service = new ProductDiscoveryService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports browser scraper failure with actionable details', async () => {
    vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
      name: null,
      retailerName: null,
      price: null,
      imageUrl: null,
      url: 'https://example.com/product',
      stockStatus: 'unknown',
      priceCandidates: [],
      needsReview: false,
      failureReason: 'browser_scraper_failed',
      failureDetail: 'timeout of 45000ms exceeded',
    } as unknown as ScrapedProductWithVoting);

    await expect(service.initiateProductDiscovery(1, 'https://example.com/product', null))
      .rejects.toThrow('The Browser Scraper failed to fetch the page (timeout of 45000ms exceeded). Check the Browser Scraper container and settings in Admin -> System.');
  });

  it('reports bot challenge when plain scrape is blocked', async () => {
    vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
      name: null,
      retailerName: null,
      price: null,
      imageUrl: null,
      url: 'https://example.com/product',
      stockStatus: 'unknown',
      priceCandidates: [],
      needsReview: false,
      failureReason: 'bot_challenge',
      failureDetail: 'Imperva/Incapsula Challenge',
    } as unknown as ScrapedProductWithVoting);

    await expect(service.initiateProductDiscovery(1, 'https://example.com/product', null))
      .rejects.toThrow('The retailer blocked the request (Imperva/Incapsula Challenge). Enable the Browser Scraper for this retailer under Admin -> Retailers, or configure a proxy, then try again.');
  });
});
