import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import { runExtractionPhase, ExtractionOptions } from '../../src/services/scraper/orchestration/extraction';
import * as pricesModule from '../../src/services/scraper/prices';
import * as metadataModule from '../../src/services/scraper/metadata';
import * as contextModule from '../../src/services/scraper/context';
import type { PriceCandidate, ScrapedProductWithVoting } from '../../src/types/scraper';

vi.mock('../../src/services/scraper/context', () => ({
  resolveScrapeContext: vi.fn(),
}));

vi.mock('../../src/services/scraper/prices', () => ({
  extractAllPriceCandidates: vi.fn(),
}));

vi.mock('../../src/services/scraper/metadata', () => ({
  extractMetadata: vi.fn(),
}));

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getPriceSelectors: vi.fn().mockResolvedValue([]),
    getGenericStockSelectors: vi.fn().mockResolvedValue([]),
    getNameSelectors: vi.fn().mockResolvedValue([]),
    getImageSelectors: vi.fn().mockResolvedValue([]),
    getGenericExclusionSelectors: vi.fn().mockResolvedValue([]),
  },
}));

const mockResolveContext = contextModule.resolveScrapeContext as unknown as ReturnType<typeof vi.fn>;
const mockExtractPrices = pricesModule.extractAllPriceCandidates as unknown as ReturnType<typeof vi.fn>;
const mockExtractMetadata = metadataModule.extractMetadata as unknown as ReturnType<typeof vi.fn>;

describe('runExtractionPhase Candidate Merging & Deduplication (Issue #166)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveContext.mockResolvedValue({ currency: 'EUR', locale: 'de-DE' });
    mockExtractMetadata.mockResolvedValue(undefined);
  });

  it('merges new extraction candidates with existing candidates without overwriting earlier passes', async () => {
    const existingCandidate: PriceCandidate = {
      price: 199.99,
      currency: 'EUR',
      method: 'json-ld',
      confidence: 0.95,
      selector: undefined,
    };

    const newCandidate: PriceCandidate = {
      price: 189.99,
      currency: 'EUR',
      method: 'custom-css',
      confidence: 0.9,
      selector: '.sale-price',
    };

    mockExtractPrices.mockResolvedValueOnce([newCandidate]);

    const result: ScrapedProductWithVoting = {
      name: 'Test Product',
      price: null,
      imageUrl: null,
      url: 'https://shop.example.de/item/1',
      stockStatus: 'in_stock',
      aiStatus: null,
      priceCandidates: [existingCandidate], // Existing from Phase 1
      needsReview: false,
    };

    const $ = cheerio.load('<html><body><div class="sale-price">189,99 €</div></body></html>');
    const options: ExtractionOptions = {
      url: 'https://shop.example.de/item/1',
      html: '<html><body><div class="sale-price">189,99 €</div></body></html>',
      $,
      domainConfig: null,
      currencyHint: 'EUR',
      localeHint: 'de-DE',
      extractionSteps: [],
    };

    await runExtractionPhase(options, result);

    expect(result.priceCandidates).toHaveLength(2);
    expect(result.priceCandidates).toContainEqual(existingCandidate);
    expect(result.priceCandidates).toContainEqual(newCandidate);
  });

  it('deduplicates identical candidates found in multiple passes to prevent skewed consensus weights', async () => {
    const candidateA: PriceCandidate = {
      price: 99.0,
      currency: 'EUR',
      method: 'custom-css',
      confidence: 0.9,
      selector: '.primary-price',
    };

    // Identical candidate discovered again in second pass
    const duplicateCandidate: PriceCandidate = {
      price: 99.0,
      currency: 'EUR',
      method: 'custom-css',
      confidence: 0.9,
      selector: '.primary-price',
    };

    mockExtractPrices.mockResolvedValueOnce([duplicateCandidate]);

    const result: ScrapedProductWithVoting = {
      name: 'Product',
      price: null,
      imageUrl: null,
      url: 'https://shop.example.de/p/2',
      stockStatus: 'in_stock',
      aiStatus: null,
      priceCandidates: [candidateA],
      needsReview: false,
    };

    const $ = cheerio.load('<html><body></body></html>');
    const options: ExtractionOptions = {
      url: 'https://shop.example.de/p/2',
      html: '<html><body></body></html>',
      $,
      domainConfig: null,
      currencyHint: 'EUR',
      localeHint: 'de-DE',
      extractionSteps: [],
    };

    await runExtractionPhase(options, result);

    // Deduplicated to 1 candidate
    expect(result.priceCandidates).toHaveLength(1);
    expect(result.priceCandidates[0]).toEqual(candidateA);
  });

  it('updates localeHint and logs trace when HTML context resolves to a different locale', async () => {
    mockResolveContext.mockResolvedValueOnce({ currency: 'CHF', locale: 'de-CH' });
    mockExtractPrices.mockResolvedValueOnce([]);

    const result: ScrapedProductWithVoting = {
      name: 'Swiss Item',
      price: null,
      imageUrl: null,
      url: 'https://shop.example.ch/p/3',
      stockStatus: 'in_stock',
      aiStatus: null,
      priceCandidates: [],
      needsReview: false,
    };

    const $ = cheerio.load('<html><body></body></html>');
    const steps: string[] = [];
    const options: ExtractionOptions = {
      url: 'https://shop.example.ch/p/3',
      html: '<html><body></body></html>',
      $,
      domainConfig: null,
      currencyHint: null,
      localeHint: 'en-US', // Initial was en-US
      extractionSteps: steps,
    };

    const res = await runExtractionPhase(options, result);

    expect(res.localeHint).toBe('de-CH');
    expect(steps).toContain('Context | Locale | Updated from HTML: de-CH');
  });
});
