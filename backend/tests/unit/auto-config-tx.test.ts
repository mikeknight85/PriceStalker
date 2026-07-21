import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutoRetailerConfig } from '../../src/services/domain/product/utils/auto-config';
import { productPersistenceService } from '../../src/services/domain/product/ProductPersistenceService';

// Hoist mock objects to resolve ReferenceError: Cannot access before initialization
const { mockClient } = vi.hoisted(() => {
  return {
    mockClient: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }
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
        price_selectors: ['.old-price'],
      }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    productRepository: {
      findById: vi.fn().mockResolvedValue({
        id: 123,
        url: 'https://example.com/product',
        refresh_interval: 3600,
        category: 'Electronics',
        stock_status: 'in_stock',
      }),
      update: vi.fn().mockResolvedValue({}),
      updateStockStatus: vi.fn().mockResolvedValue({}),
      updateLastChecked: vi.fn().mockResolvedValue({}),
      updateAnchorPrice: vi.fn().mockResolvedValue({}),
      updateExtractionMethod: vi.fn().mockResolvedValue({}),
      bulkSetCheckingPaused: vi.fn().mockResolvedValue({}),
    },
    priceHistoryRepository: {
      getLatest: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    stockHistoryRepository: {
      recordChange: vi.fn().mockResolvedValue({}),
    },
  };
});

// Mock caches including settingsCache with all required methods
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
      getGenericAIPriceSelectors: vi.fn().mockResolvedValue([]),
      getAISettings: vi.fn().mockResolvedValue({
        ai_enabled: false,
        ai_verification_enabled: false,
        ai_auto_mapping_enabled: false,
        jsonld_price_key: 'price',
      }),
      get: vi.fn().mockResolvedValue('[]'),
    },
  };
});

// Mock helper services
vi.mock('../../src/services/domain/product/utils/category-sync', () => {
  return {
    syncUserCategories: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('../../src/services/domain/system', () => {
  return {
    systemService: {
      getSetting: vi.fn().mockResolvedValue('false'),
    },
  };
});

describe('runAutoRetailerConfig Transaction Integration Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use the provided outer client and not manage transaction states when a client is passed', async () => {
    const outerMockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 1, domain: 'example.com' }] }),
      release: vi.fn(),
    };

    const params = {
      url: 'https://example.com/product',
      productId: 123,
      html: '<html></html>',
      scrapedData: {
        price: { price: 99.99, currency: 'USD' },
        priceCandidates: [{ price: 99.99, currency: 'USD', method: 'custom-css', selector: '.price', confidence: 0.90 }],
        selectedMethod: 'custom-css',
        needsReview: false,
        name: 'Test Product',
        stockStatus: 'in_stock' as const,
        imageUrl: '',
        url: 'https://example.com/product',
        aiStatus: null,
      },
      source: 'manual-confirm' as const,
      client: outerMockClient as any,
    };

    await runAutoRetailerConfig(params);

    // Should NOT call BEGIN, COMMIT, or ROLLBACK on outerMockClient
    const queryCalls = outerMockClient.query.mock.calls.map(call => call[0]);
    expect(queryCalls).not.toContain('BEGIN');
    expect(queryCalls).not.toContain('COMMIT');
    expect(queryCalls).not.toContain('ROLLBACK');

    // Should NOT release the outerMockClient
    expect(outerMockClient.release).not.toHaveBeenCalled();

    // Verify regionalMappingCache and retailerRepository were called using the mockClient/mocking
    const { retailerRepository } = await import('../../src/models');
    expect(retailerRepository.getByDomainForUpdate).toHaveBeenCalledWith('example.com', outerMockClient);
    expect(retailerRepository.upsert).toHaveBeenCalledWith(expect.any(Object), outerMockClient);

    // Verify configCache.invalidate was NOT called inside runAutoRetailerConfig (deferred to persistence wrapper)
    const { configCache } = await import('../../src/utils/cache');
    expect(configCache.invalidate).not.toHaveBeenCalled();
  });

  it('should manage its own transaction and invalidate cache when called standalone (without client)', async () => {
    const params = {
      url: 'https://example.com/product',
      productId: 123,
      html: '<html></html>',
      scrapedData: {
        price: { price: 99.99, currency: 'USD' },
        priceCandidates: [{ price: 99.99, currency: 'USD', method: 'custom-css', selector: '.price', confidence: 0.90 }],
        selectedMethod: 'custom-css',
        needsReview: false,
        name: 'Test Product',
        stockStatus: 'in_stock' as const,
        imageUrl: '',
        url: 'https://example.com/product',
        aiStatus: null,
      },
      source: 'manual-confirm' as const,
    };

    await runAutoRetailerConfig(params);

    // Should borrow a connection from database/pool
    const db = await import('../../src/config/database');
    expect(db.default.connect).toHaveBeenCalledTimes(1);

    // Should run BEGIN and COMMIT on its own client
    const queryCalls = mockClient.query.mock.calls.map(call => call[0]);
    expect(queryCalls).toContain('BEGIN');
    expect(queryCalls).toContain('COMMIT');

    // Should release the connection back to the pool
    expect(mockClient.release).toHaveBeenCalledTimes(1);

    // Verify cache invalidation occurs immediately
    const { configCache } = await import('../../src/utils/cache');
    expect(configCache.invalidate).toHaveBeenCalledWith('example.com');
  });
});

describe('ProductPersistenceService saveScrapeResult Transactional Orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run runAutoRetailerConfig inside its transaction and invalidate the cache post-commit', async () => {
    const scrapedData = {
      price: { price: 99.99, currency: 'USD' },
      priceCandidates: [{ price: 99.99, currency: 'USD', method: 'custom-css', selector: '.price', confidence: 0.90 }],
      selectedMethod: 'custom-css',
      needsReview: false,
      name: 'Test Product',
      stockStatus: 'in_stock' as const,
      imageUrl: '',
      url: 'https://example.com/product',
      aiStatus: null,
    };

    await productPersistenceService.saveScrapeResult(123, 1, scrapedData, 'manual-confirm');

    // Should get a connection from the pool for the persistence transaction
    const db = await import('../../src/config/database');
    expect(db.default.connect).toHaveBeenCalledTimes(1);

    // Verification of advisory locks and query order
    const queryCalls = mockClient.query.mock.calls.map(call => call[0]);
    expect(queryCalls[0]).toBe('BEGIN');
    expect(queryCalls[1]).toContain('pg_advisory_xact_lock');
    expect(queryCalls[queryCalls.length - 1]).toBe('COMMIT');

    // Verify runAutoRetailerConfig was called with the persistence transaction client
    const { retailerRepository } = await import('../../src/models');
    expect(retailerRepository.getByDomainForUpdate).toHaveBeenCalledWith('example.com', mockClient);
    expect(retailerRepository.upsert).toHaveBeenCalledWith(expect.any(Object), mockClient);

    // Verify configCache.invalidate was called POST-COMMIT
    const { configCache } = await import('../../src/utils/cache');
    expect(configCache.invalidate).toHaveBeenCalledWith('example.com');

    // Verify client connection was released
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
