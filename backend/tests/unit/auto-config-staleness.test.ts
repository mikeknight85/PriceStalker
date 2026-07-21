import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutoRetailerConfig } from '../../src/services/domain/product/utils/auto-config';

// Hoist mock objects to resolve ReferenceError: Cannot access before initialization
const { mockClient, mockUpsert } = vi.hoisted(() => {
  return {
    mockClient: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    },
    mockUpsert: vi.fn().mockResolvedValue({}),
  };
});

// Mock database config/pool
vi.mock('../../src/config/database', () => {
  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    },
  };
});

// Mock models and repositories
vi.mock('../../src/models', () => {
  return {
    retailerRepository: {
      getByDomainForUpdate: vi.fn().mockResolvedValue({
        id: 1,
        domain: 'example.com',
        price_selectors: ['.s1', '.s2', '.s3'],
        deal_price_selectors: ['.d1'],
        selector_metadata: {
          selectors: {
            '.s1': { match_count: 5, consecutive_failures: 2, last_matched_at: '2026-06-30T10:00:00Z' },
            '.s2': { match_count: 10, consecutive_failures: 0, last_matched_at: '2026-06-30T11:00:00Z' },
            '.s3': { match_count: 2, consecutive_failures: 4, last_matched_at: '2026-06-30T12:00:00Z' },
          }
        }
      }),
      upsert: mockUpsert,
    },
  };
});

// Mock caches including settingsCache
vi.mock('../../src/utils/cache', () => {
  return {
    configCache: {
      invalidate: vi.fn(),
    },
    regionalMappingCache: {
      getLookupDomain: vi.fn().mockResolvedValue('example.com'),
    },
    settingsCache: {
      getPriceSelectors: vi.fn().mockResolvedValue([]),
      getDealPriceSelectors: vi.fn().mockResolvedValue([]),
      getMemberPriceSelectors: vi.fn().mockResolvedValue([]),
      getPreOrderPriceSelectors: vi.fn().mockResolvedValue([]),
      getOriginalPriceSelectors: vi.fn().mockResolvedValue([]),
      getNameSelectors: vi.fn().mockResolvedValue([]),
      getRetailerNameSelectors: vi.fn().mockResolvedValue([]),
      getImageSelectors: vi.fn().mockResolvedValue([]),
      getGenericExclusionSelectors: vi.fn().mockResolvedValue([]),
      getGenericStockSelectors: vi.fn().mockResolvedValue([]),
      getGenericInStockPhrases: vi.fn().mockResolvedValue([]),
      getGenericOutOfStockPhrases: vi.fn().mockResolvedValue([]),
      getGenericPreOrderPhrases: vi.fn().mockResolvedValue([]),
      getGenericAIPriceSelectors: vi.fn().mockResolvedValue(['[class*="price" i]']), // whitelisted generic AI selector
      getAISettings: vi.fn().mockResolvedValue({
        ai_enabled: false,
        ai_verification_enabled: false,
        ai_auto_mapping_enabled: false,
      }),
      get: vi.fn().mockResolvedValue('[]'),
    },
  };
});

vi.mock('../../src/services/domain/system', () => {
  return {
    systemService: {
      getSetting: vi.fn().mockResolvedValue('false'),
    },
  };
});

describe('Auto-Config Selector Staleness & Eviction Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update metadata for a winning selector and increment failures on other custom selectors', async () => {
    const params = {
      url: 'https://example.com/product',
      productId: 123,
      html: '<html></html>',
      scrapedData: {
        price: { price: 99.99, currency: 'USD' },
        priceCandidates: [{ price: 99.99, currency: 'USD', method: 'custom-css', selector: '.s1', confidence: 0.90 }],
        selectedMethod: 'custom-css',
        needsReview: false,
        name: 'Test Product',
        stockStatus: 'in_stock' as const,
        imageUrl: '',
        url: 'https://example.com/product',
        aiStatus: null,
      },
      source: 'refresh' as const,
      client: mockClient as any,
    };

    await runAutoRetailerConfig(params);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertedData = mockUpsert.mock.calls[0][0];

    // .s1 is the winner, stats should show reset failures and incremented matches
    const s1Stats = upsertedData.selector_metadata.selectors['.s1'];
    expect(s1Stats.match_count).toBe(6);
    expect(s1Stats.consecutive_failures).toBe(0);
    expect(s1Stats.last_matched_at).not.toBe('2026-06-30T10:00:00Z'); // should be updated to now

    // .s2 and .s3 were custom selectors but did not match, their failures should increment
    const s2Stats = upsertedData.selector_metadata.selectors['.s2'];
    expect(s2Stats.consecutive_failures).toBe(1);

    const s3Stats = upsertedData.selector_metadata.selectors['.s3'];
    expect(s3Stats.consecutive_failures).toBe(5);
  });

  it('should implement score-based eviction to cap custom arrays at 10 and evict the lowest scoring selectors', async () => {
    const { retailerRepository } = await import('../../src/models');
    
    // Inject 12 custom selectors, some highly successful, some failing
    const prices = [
      '.s1', '.s2', '.s3', '.s4', '.s5', '.s6', '.s7', '.s8', '.s9', '.s10', '.s11', '.s12'
    ];
    const initialMetadata = {
      selectors: {
        '.s1': { match_count: 50, consecutive_failures: 0 }, // score: 50
        '.s2': { match_count: 30, consecutive_failures: 0 }, // score: 30
        '.s3': { match_count: 20, consecutive_failures: 0 }, // score: 20
        '.s4': { match_count: 10, consecutive_failures: 0 }, // score: 10
        '.s5': { match_count: 8, consecutive_failures: 0 },  // score: 8
        '.s6': { match_count: 6, consecutive_failures: 0 },  // score: 6
        '.s7': { match_count: 4, consecutive_failures: 0 },  // score: 4
        '.s8': { match_count: 2, consecutive_failures: 0 },  // score: 2
        '.s9': { match_count: 1, consecutive_failures: 0 },  // score: 1
        '.s10': { match_count: 0, consecutive_failures: 0 }, // score: 0
        '.s11': { match_count: 2, consecutive_failures: 10 }, // score: 2 - 20 = -18 (stale, fails a lot)
        '.s12': { match_count: 1, consecutive_failures: 15 }, // score: 1 - 30 = -29 (stale, fails a lot)
      }
    } as any;

    vi.mocked(retailerRepository.getByDomainForUpdate).mockResolvedValue({
      id: 1,
      domain: 'example.com',
      price_selectors: prices,
      selector_metadata: initialMetadata,
    } as any);

    const params = {
      url: 'https://example.com/product',
      productId: 123,
      html: '<html></html>',
      scrapedData: {
        price: { price: 99.99, currency: 'USD' },
        priceCandidates: [{ price: 99.99, currency: 'USD', method: 'custom-css', selector: '.s1', confidence: 0.90 }],
        selectedMethod: 'custom-css',
        needsReview: false,
        name: 'Test Product',
        stockStatus: 'in_stock' as const,
        imageUrl: '',
        url: 'https://example.com/product',
        aiStatus: null,
      },
      source: 'refresh' as const,
      client: mockClient as any,
    };

    await runAutoRetailerConfig(params);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertedData = mockUpsert.mock.calls[0][0];

    // Verify array is capped at 10
    expect(upsertedData.price_selectors.length).toBe(10);

    // Verify .s11 and .s12 (the lowest scoring) were evicted
    expect(upsertedData.price_selectors).not.toContain('.s11');
    expect(upsertedData.price_selectors).not.toContain('.s12');

    // Verify that the other 10 were retained
    expect(upsertedData.price_selectors).toContain('.s1');
    expect(upsertedData.price_selectors).toContain('.s2');
    expect(upsertedData.price_selectors).toContain('.s3');
    expect(upsertedData.price_selectors).toContain('.s4');
    expect(upsertedData.price_selectors).toContain('.s5');
    expect(upsertedData.price_selectors).toContain('.s6');
    expect(upsertedData.price_selectors).toContain('.s7');
    expect(upsertedData.price_selectors).toContain('.s8');
    expect(upsertedData.price_selectors).toContain('.s9');
    expect(upsertedData.price_selectors).toContain('.s10');
  });
});
