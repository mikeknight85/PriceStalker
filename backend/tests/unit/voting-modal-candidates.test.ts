import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productDiscoveryService } from '../../src/services/domain/product/add/discovery';
import { productRescanService } from '../../src/services/domain/product/add/rescan';

// Hoist mock objects to resolve hoisting order references
const { mockCreate, mockFindById } = vi.hoisted(() => {
  return {
    mockCreate: vi.fn().mockResolvedValue({ id: 999 }),
    mockFindById: vi.fn().mockResolvedValue({
      id: 999,
      url: 'https://example.com/product',
      refresh_interval: 43200,
      category: 'Electronics',
    }),
  };
});

// Mock database connection
vi.mock('../../src/config/database', () => {
  return {
    default: {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    },
  };
});

// Mock models and repositories
vi.mock('../../src/models', () => {
  return {
    productRepository: {
      create: mockCreate,
      findById: mockFindById,
      update: vi.fn().mockResolvedValue({}),
    },
  };
});

// Mock scraper engine
const mockScrapedData = {
  name: 'Awesome Product',
  imageUrl: 'https://example.com/image.png',
  stockStatus: 'in_stock',
  price: { price: 99.99, currency: 'USD' },
  memberPrice: { price: 89.99, currency: 'USD' },
  originalPrice: { price: 120.00, currency: 'USD' },
  priceCandidates: [
    { price: 99.99, currency: 'USD', method: 'custom-css', confidence: 0.95 }
  ],
  needsReview: true,
  reviewReason: 'no_consensus',
  html: '<html>Product HTML</html>',
  aiStatus: null,
};

vi.mock('../../src/services/scraper', () => {
  return {
    scrapeProductWithVoting: vi.fn().mockImplementation(async () => {
      return { ...mockScrapedData };
    }),
  };
});

// Mock persistence service
vi.mock('../ProductPersistenceService', () => {
  return {
    productPersistenceService: {
      saveScrapeResult: vi.fn().mockResolvedValue({}),
    },
  };
});

describe('Voting Modal Backend Restructuring Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiateProductDiscovery should inject memberPrice and originalPrice as candidates and set reviewReason', async () => {
    const result = await productDiscoveryService.initiateProductDiscovery(1, 'https://example.com/product', 'Electronics');

    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe('no_consensus');
    expect(result.html).toBe('<html>Product HTML</html>'); // should be within 100KB limits

    // Price candidates should now include standard, member, and original RRP
    const candidates = result.priceCandidates;
    expect(candidates.length).toBe(3);

    // Standard candidate
    const standard = candidates.find(c => c.method === 'custom-css');
    expect(standard).toBeDefined();
    expect(standard?.price).toBe(99.99);

    // Member candidate
    const member = candidates.find(c => c.method === 'member-price');
    expect(member).toBeDefined();
    expect(member?.price).toBe(89.99);
    expect(member?.context).toBe('Member / loyalty price');

    // Original candidate
    const original = candidates.find(c => c.method === 'original-price');
    expect(original).toBeDefined();
    expect(original?.price).toBe(120.00);
    expect(original?.context).toBe('Original / RRP price');

    // Ensure suggestedPrice/memberPrice/originalPrice top-level fields are removed
    expect((result as any).suggestedPrice).toBeUndefined();
    expect((result as any).memberPrice).toBeUndefined();
    expect((result as any).originalPrice).toBeUndefined();
  });

  it('scanProduct should inject candidates and return reviewReason manual_rescan', async () => {
    const result = await productRescanService.scanProduct(1, 999);

    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe('manual_rescan');
    expect(result.id).toBe(999);

    const candidates = result.priceCandidates;
    expect(candidates.length).toBe(3);

    const member = candidates.find(c => c.method === 'member-price');
    expect(member?.price).toBe(89.99);

    const original = candidates.find(c => c.method === 'original-price');
    expect(original?.price).toBe(120.00);
  });
});
