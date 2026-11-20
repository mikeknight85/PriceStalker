import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductDiscoveryService } from '../../src/services/domain/product/add/discovery';
import { scrapeProductWithVoting } from '../../src/services/scraper';
import { assertUrlIsSafe } from '../../src/utils/system/url-safety';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';

import { productRepository, type ProductWithLatestPrice } from '../../src/models';
import { productPersistenceService } from '../../src/services/domain/product/ProductPersistenceService';

function mockProduct(overrides?: Partial<ProductWithLatestPrice>): ProductWithLatestPrice {
  return {
    id: 42,
    user_id: 1,
    url: 'https://example.com/product',
    name: 'Test Product',
    image_url: null,
    refresh_interval: 3600,
    last_checked: null,
    next_check_at: null,
    stock_status: 'in_stock',
    price_drop_threshold: null,
    target_price: null,
    notify_back_in_stock: false,
    ai_status: 'unverified',
    ai_verification_disabled: false,
    requires_client_scrape: false,
    price: null,
    currency: null,
    last_price_change: null,
    ...overrides,
  };
}

vi.mock('../../src/services/scraper', () => ({
  scrapeProductWithVoting: vi.fn(),
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn(),
}));

vi.mock('../../src/models', () => ({
  productRepository: {
    create: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../src/services/domain/product/ProductPersistenceService', () => ({
  productPersistenceService: {
    saveScrapeResult: vi.fn(),
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

  it('sanitizes generic modal noise in product name before creating product', async () => {
    vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
      name: 'Cart limit reached',
      retailerName: 'Telstra',
      price: { price: 379, currency: 'AUD' },
      imageUrl: 'https://example.com/buds.jpg',
      url: 'https://example.com/product',
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false,
    } as unknown as ScrapedProductWithVoting);

    vi.mocked(productRepository.create).mockResolvedValueOnce(mockProduct({ id: 42, name: null }));
    vi.mocked(productRepository.findById).mockResolvedValueOnce(mockProduct({ id: 42, name: null }));

    const result = await service.initiateProductDiscovery(1, 'https://example.com/product', null);

    expect(productRepository.create).toHaveBeenCalledWith(
      1,
      'https://example.com/product',
      null, // "Cart limit reached" should be rejected and sanitized to null
      'https://example.com/buds.jpg',
      expect.any(Number),
      'in_stock',
      null,
      null
    );
    expect(result.needsReview).toBe(false);
  });

  it('preserves valid canonical product name when creating product', async () => {
    vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
      name: 'Google Pixel Buds Pro 2 Hazel',
      retailerName: 'Telstra',
      price: { price: 379, currency: 'AUD' },
      imageUrl: 'https://example.com/buds.jpg',
      url: 'https://example.com/product',
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false,
    } as unknown as ScrapedProductWithVoting);

    vi.mocked(productRepository.create).mockResolvedValueOnce(mockProduct({ id: 43, name: 'Google Pixel Buds Pro 2 Hazel' }));
    vi.mocked(productRepository.findById).mockResolvedValueOnce(mockProduct({ id: 43, name: 'Google Pixel Buds Pro 2 Hazel' }));

    const result = await service.initiateProductDiscovery(1, 'https://example.com/product', null);

    expect(productRepository.create).toHaveBeenCalledWith(
      1,
      'https://example.com/product',
      'Google Pixel Buds Pro 2 Hazel',
      'https://example.com/buds.jpg',
      expect.any(Number),
      'in_stock',
      null,
      null
    );
    expect(result.needsReview).toBe(false);
  });

  it('preserves real products containing the word cart', async () => {
    vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
      name: 'EZGO 48V Heavy Duty Golf Cart Battery',
      retailerName: 'BatteryStore',
      price: { price: 189, currency: 'USD' },
      imageUrl: 'https://example.com/battery.jpg',
      url: 'https://example.com/product',
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false,
    } as unknown as ScrapedProductWithVoting);

    vi.mocked(productRepository.create).mockResolvedValueOnce(mockProduct({ id: 44, name: 'EZGO 48V Heavy Duty Golf Cart Battery' }));
    vi.mocked(productRepository.findById).mockResolvedValueOnce(mockProduct({ id: 44, name: 'EZGO 48V Heavy Duty Golf Cart Battery' }));

    const result = await service.initiateProductDiscovery(1, 'https://example.com/product', null);

    expect(productRepository.create).toHaveBeenCalledWith(
      1,
      'https://example.com/product',
      'EZGO 48V Heavy Duty Golf Cart Battery',
      'https://example.com/battery.jpg',
      expect.any(Number),
      'in_stock',
      null,
      null
    );
    expect(result.needsReview).toBe(false);
  });
});
