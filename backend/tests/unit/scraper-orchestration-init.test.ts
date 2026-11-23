import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initScrapeSession } from '../../src/services/scraper/orchestration/init';
import { runExtractionPhase } from '../../src/services/scraper/orchestration/extraction';
import { configCache, settingsCache, regionalMappingCache } from '../../src/utils/cache';
import { resolveScrapeContext } from '../../src/services/scraper/context';
import { extractMetadata } from '../../src/services/scraper/metadata';
import * as cheerio from 'cheerio';

vi.mock('../../src/utils/cache', () => ({
  configCache: {
    getConfig: vi.fn(),
  },
  settingsCache: {
    getAISettings: vi.fn(),
    getPriceSelectors: vi.fn().mockResolvedValue([]),
    getGenericStockSelectors: vi.fn().mockResolvedValue([]),
    getNameSelectors: vi.fn().mockResolvedValue([]),
    getImageSelectors: vi.fn().mockResolvedValue([]),
    getGenericExclusionSelectors: vi.fn().mockResolvedValue([]),
  },
  regionalMappingCache: {
    getLookupDomain: vi.fn(),
  },
}));

vi.mock('../../src/services/scraper/context', () => ({
  resolveScrapeContext: vi.fn(),
}));

vi.mock('../../src/services/scraper/metadata', () => ({
  extractMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/scraper/prices', () => ({
  extractAllPriceCandidates: vi.fn().mockResolvedValue([]),
}));

describe('Scraper Pipeline Orchestration: Init & Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initScrapeSession', () => {
    it('initializes session context with derived domain and lookup config', async () => {
      vi.mocked(regionalMappingCache.getLookupDomain).mockResolvedValueOnce('amazon.com');
      vi.mocked(configCache.getConfig).mockResolvedValueOnce({
        id: 1,
        domain: 'amazon.com',
        currency_hint: 'USD',
      } as any);
      vi.mocked(settingsCache.getAISettings).mockResolvedValueOnce({
        ai_enabled: true,
        ai_verification_enabled: true,
      } as any);
      vi.mocked(resolveScrapeContext).mockResolvedValueOnce({
        currency: 'USD',
        locale: 'en-US',
      } as any);

      const session = await initScrapeSession('https://www.amazon.com/dp/B08123', 1);

      expect(session.domain).toBe('amazon.com');
      expect(session.lookupDomain).toBe('amazon.com');
      expect(session.currencyHint).toBe('USD');
      expect(session.localeHint).toBe('en-US');
      expect(session.finalSkipAiExtraction).toBe(false);
      expect(session.finalSkipAiVerification).toBe(false);
    });

    it('respects skip AI flags when global AI is disabled', async () => {
      vi.mocked(regionalMappingCache.getLookupDomain).mockResolvedValueOnce('store.test');
      vi.mocked(configCache.getConfig).mockResolvedValueOnce(null);
      vi.mocked(settingsCache.getAISettings).mockResolvedValueOnce({
        ai_enabled: false,
        ai_verification_enabled: false,
      } as any);
      vi.mocked(resolveScrapeContext).mockResolvedValueOnce({
        currency: 'EUR',
        locale: 'de-DE',
      } as any);

      const session = await initScrapeSession('https://store.test/p');

      expect(session.finalSkipAiExtraction).toBe(true);
      expect(session.finalSkipAiVerification).toBe(true);
    });
  });

  describe('runExtractionPhase', () => {
    it('runs DOM denoising and metadata extraction', async () => {
      vi.mocked(resolveScrapeContext).mockResolvedValueOnce({
        currency: 'USD',
        locale: 'en-US',
      } as any);

      const html = '<html><body><div class="product"><span class="price">$19.99</span></div></body></html>';
      const $ = cheerio.load(html);
      const extractionSteps: string[] = [];

      const result: any = {
        url: 'https://store.test/p',
        priceCandidates: [],
      };

      const { currencyHint, localeHint } = await runExtractionPhase(
        {
          url: 'https://store.test/p',
          html,
          $,
          domainConfig: null,
          currencyHint: 'USD',
          localeHint: 'en-US',
          extractionSteps,
        },
        result
      );

      expect(currencyHint).toBe('USD');
      expect(localeHint).toBe('en-US');
      expect(extractMetadata).toHaveBeenCalledWith($, undefined, extractionSteps, result, 'https://store.test/p');
    });
  });
});
