import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductRescanService } from '../../src/services/domain/product/add/rescan';
import { productRepository } from '../../src/models';
import { scrapeProductWithVoting } from '../../src/services/scraper';
import { assertUrlIsSafe } from '../../src/utils/system/url-safety';

vi.mock('../../src/models', () => ({
  productRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/services/scraper', () => ({
  scrapeProductWithVoting: vi.fn(),
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn(),
}));

const mockFindById = productRepository.findById as unknown as ReturnType<typeof vi.fn>;
const mockScrape = scrapeProductWithVoting as unknown as ReturnType<typeof vi.fn>;
const mockAssertUrlIsSafe = assertUrlIsSafe as unknown as ReturnType<typeof vi.fn>;

describe('ProductRescanService', () => {
  let service: ProductRescanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductRescanService();
  });

  it('throws "Product not found" if the product does not exist for the user', async () => {
    mockFindById.mockResolvedValueOnce(null);

    await expect(service.scanProduct(1, 999)).rejects.toThrow('Product not found');
    expect(mockAssertUrlIsSafe).not.toHaveBeenCalled();
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('enforces SSRF protection on stored product URL before rescraping', async () => {
    mockFindById.mockResolvedValueOnce({
      id: 5,
      url: 'http://169.254.169.254/latest/meta-data/',
      user_id: 1,
    });
    mockAssertUrlIsSafe.mockRejectedValueOnce(new Error('Cloud metadata endpoint is not allowed'));

    await expect(service.scanProduct(1, 5)).rejects.toThrow('Cloud metadata endpoint is not allowed');
    expect(mockAssertUrlIsSafe).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/', {
      policy: 'allow-private-lan',
    });
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('maps price candidates, member price, and original price, and truncates name and HTML', async () => {
    const longName = 'Product '.repeat(50); // 400 chars
    const massiveHtml = '<div>HTML CONTENT</div>'.repeat(6000); // > 100k chars

    mockFindById.mockResolvedValueOnce({
      id: 12,
      url: 'https://shop.example.com/item/12',
      user_id: 2,
    });
    mockAssertUrlIsSafe.mockResolvedValueOnce(undefined);
    mockScrape.mockResolvedValueOnce({
      name: longName,
      imageUrl: 'https://shop.example.com/img.jpg',
      stockStatus: 'in_stock',
      html: massiveHtml,
      priceCandidates: [
        {
          price: 99.99,
          currency: 'USD',
          method: 'custom-selector',
          context: 'Primary selector',
          confidence: 0.95,
          selector: '.price',
        },
      ],
      memberPrice: {
        price: 89.99,
        currency: 'USD',
      },
      originalPrice: {
        price: 119.99,
        currency: 'USD',
      },
    });

    const result = await service.scanProduct(2, 12);

    expect(result.id).toBe(12);
    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe('manual_rescan');
    expect(result.url).toBe('https://shop.example.com/item/12');
    expect(result.name?.length).toBe(255);
    expect(result.html?.length).toBe(100_000);

    // Assert candidates list contains base, member, and original price candidates
    expect(result.priceCandidates).toHaveLength(3);
    expect(result.priceCandidates[0]).toEqual({
      price: 99.99,
      currency: 'USD',
      method: 'custom-selector',
      context: 'Primary selector',
      confidence: 0.95,
      selector: '.price',
    });
    expect(result.priceCandidates[1]).toEqual({
      price: 89.99,
      currency: 'USD',
      method: 'member-price',
      context: 'Member / loyalty price',
      confidence: 0.9,
      selector: undefined,
    });
    expect(result.priceCandidates[2]).toEqual({
      price: 119.99,
      currency: 'USD',
      method: 'original-price',
      context: 'Original / RRP price',
      confidence: 0.85,
      selector: undefined,
    });
  });

  it('handles rescan results without member price, original price, or html', async () => {
    mockFindById.mockResolvedValueOnce({
      id: 15,
      url: 'https://shop.example.com/item/15',
      user_id: 3,
    });
    mockAssertUrlIsSafe.mockResolvedValueOnce(undefined);
    mockScrape.mockResolvedValueOnce({
      name: null,
      imageUrl: null,
      stockStatus: 'out_of_stock',
      html: null,
      priceCandidates: [],
      memberPrice: null,
      originalPrice: null,
    });

    const result = await service.scanProduct(3, 15);
    expect(result.name).toBeNull();
    expect(result.html).toBeNull();
    expect(result.stockStatus).toBe('out_of_stock');
    expect(result.priceCandidates).toEqual([]);
  });
});
