import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flagBlockedRetailer, restoreRetailerStatus } from '../../src/services/scraper/retailer-maintenance';
import { handleRestoreStatus, handleAutoMapping } from '../../src/services/scraper/orchestration/maintenance';
import { retailerRepository, type RetailerConfig } from '../../src/models';
import { configCache } from '../../src/utils/cache';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';

const { generateRetailerConfig } = vi.hoisted(() => ({
  generateRetailerConfig: vi.fn(),
}));

vi.mock('../../src/models', () => ({
  retailerRepository: {
    upsert: vi.fn(),
  },
}));

vi.mock('../../src/utils/cache', () => ({
  configCache: {
    invalidate: vi.fn(),
  },
  settingsCache: {
    getRemoteScraperUrl: vi.fn().mockResolvedValue('http://scraper:5100'),
  },
}));

vi.mock('../../src/services/ai', () => ({
  generateRetailerConfig,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeConfig(overrides: Partial<RetailerConfig> = {}): RetailerConfig {
  return {
    id: 12,
    domain: 'target.com.au',
    name: 'Target Australia',
    status: 'OK',
    active: true,
    use_browser_scraper: true,
    price_selectors: ['.price'],
    ...overrides,
  } as RetailerConfig;
}

function makeScraped(overrides: Partial<ScrapedProductWithVoting> = {}): ScrapedProductWithVoting {
  return {
    name: 'Pixel Buds Pro 2',
    price: { price: 379, currency: 'AUD' },
    imageUrl: null,
    url: 'https://www.target.com.au/p/pixel-buds/123',
    stockStatus: 'in_stock',
    aiStatus: null,
    priceCandidates: [{ price: 379, currency: 'AUD', method: 'custom-css', confidence: 0.95 }],
    needsReview: false,
    ...overrides,
  };
}

describe('flagBlockedRetailer and restoreRetailerStatus (issue #169)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the retailer BLOCKED, preserves existing config fields, and invalidates its domain cache', async () => {
    const config = makeConfig({ status: 'OK', price_selectors: ['.product-price'] });
    const steps: string[] = [];

    await flagBlockedRetailer(config, 'Akamai Behavioural Challenge', steps);

    expect(retailerRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 12,
        domain: 'target.com.au',
        status: 'BLOCKED',
        price_selectors: ['.product-price'],
        description: 'Auto-flagged: Akamai Behavioural Challenge detected during extraction',
      })
    );
    // Without invalidating, configCache keeps serving status='OK' until its
    // 30-minute TTL expires (issue #169).
    expect(configCache.invalidate).toHaveBeenCalledWith('target.com.au');
    expect(steps).toContain('Retailer | Status | Updated to BLOCKED');
  });

  it('restores a BLOCKED retailer to OK and invalidates its domain cache', async () => {
    const config = makeConfig({ status: 'BLOCKED' });
    const steps: string[] = [];

    await restoreRetailerStatus(config, steps);

    expect(retailerRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 12,
        domain: 'target.com.au',
        status: 'OK',
        description: 'Auto-restored: Successful extraction completed',
      })
    );
    expect(configCache.invalidate).toHaveBeenCalledWith('target.com.au');
    expect(steps).toContain('Retailer | Status | Restored to OK');
  });

  it('does not write to the database or invalidate the cache when the retailer is already OK', async () => {
    const config = makeConfig({ status: 'OK' });
    const steps: string[] = [];

    await restoreRetailerStatus(config, steps);

    expect(retailerRepository.upsert).not.toHaveBeenCalled();
    expect(configCache.invalidate).not.toHaveBeenCalled();
    expect(steps).toHaveLength(0);
  });
});

describe('handleRestoreStatus guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores status when a price was extracted without a challenge or config override', async () => {
    const config = makeConfig({ status: 'BLOCKED' });
    const steps: string[] = [];

    await handleRestoreStatus(makeScraped(), config, false, null, steps);

    expect(retailerRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'target.com.au', status: 'OK' })
    );
  });

  it('never restores a BLOCKED retailer when a challenge was detected on the scrape', async () => {
    const config = makeConfig({ status: 'BLOCKED' });
    const steps: string[] = [];

    await handleRestoreStatus(makeScraped(), config, false, 'Akamai Access Denied', steps);

    expect(retailerRepository.upsert).not.toHaveBeenCalled();
  });

  it('never restores a BLOCKED retailer when no price was extracted', async () => {
    const config = makeConfig({ status: 'BLOCKED' });
    const steps: string[] = [];

    await handleRestoreStatus(makeScraped({ price: null }), config, false, null, steps);

    expect(retailerRepository.upsert).not.toHaveBeenCalled();
  });

  it('never mutates stored status during an admin override test run', async () => {
    const config = makeConfig({ status: 'BLOCKED' });
    const steps: string[] = [];

    await handleRestoreStatus(makeScraped(), config, true, null, steps);

    expect(retailerRepository.upsert).not.toHaveBeenCalled();
  });
});

describe('handleAutoMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges learnedFlags into the AI-generated config and invalidates only the target domain (issue #169)', async () => {
    generateRetailerConfig.mockResolvedValueOnce({
      name: 'JB Hi-Fi',
      price_selectors: ['.price-amount'],
      name_selectors: ['h1.product-title'],
      currency_hint: null,
    });
    const savedConfig = makeConfig({
      domain: 'jbhifi.com.au',
      name: 'JB Hi-Fi',
      use_browser_scraper: true,
      currency_hint: 'AUD',
    });
    vi.mocked(retailerRepository.upsert).mockResolvedValueOnce(savedConfig);

    const steps: string[] = [];
    const result = await handleAutoMapping({
      html: '<html><body><h1>Pixel Buds</h1><span class="price-amount">$379</span></body></html>',
      url: 'https://www.jbhifi.com.au/products/pixel-buds',
      domain: 'jbhifi.com.au',
      currencyHint: 'AUD',
      localeHint: 'en_AU',
      productId: 55,
      extractionSteps: steps,
      learnedFlags: { use_browser_scraper: true },
    });

    expect(retailerRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'jbhifi.com.au',
        name: 'JB Hi-Fi',
        use_browser_scraper: true,
        active: true,
        currency_hint: 'AUD',
        price_selectors: ['.price-amount'],
      })
    );
    // Scoped to the single domain rather than flushing the whole cache.
    expect(configCache.invalidate).toHaveBeenCalledTimes(1);
    expect(configCache.invalidate).toHaveBeenCalledWith('jbhifi.com.au');
    expect(result).toEqual(savedConfig);
  });

  it('records the failure step and returns null when AI config generation throws', async () => {
    generateRetailerConfig.mockRejectedValueOnce(new Error('Provider rate limit exceeded'));

    const steps: string[] = [];
    const result = await handleAutoMapping({
      html: '<html></html>',
      url: 'https://www.jbhifi.com.au/products/pixel-buds',
      domain: 'jbhifi.com.au',
      currencyHint: 'AUD',
      localeHint: 'en_AU',
      extractionSteps: steps,
      learnedFlags: {},
    });

    expect(result).toBeNull();
    expect(retailerRepository.upsert).not.toHaveBeenCalled();
    expect(steps).toContain('Retailer | Auto-Map | Failed: Provider rate limit exceeded');
  });
});
