import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import type { ExtractionMethod } from '../../src/types/scraper';

/**
 * The bug this guards against is not a wrong answer but a silent one.
 *
 * `scrapeProductWithVoting` declared `preferredMethod?: ExtractionMethod` and
 * never referenced it again, so ProductRefreshService dutifully loaded
 * `products.preferred_extraction_method`, passed it in, and it went nowhere.
 * Nothing failed, nothing logged, and the only symptom was a user's
 * Troubleshoot Price correction quietly reverting on the next refresh
 * (issue #159).
 *
 * A unit test of the selection logic cannot catch that class of fault, so this
 * asserts the wire itself: what the caller passes reaches Phase 5.
 */

const runConsensusPhase = vi.fn(async () => {});

vi.mock('../../src/services/scraper/orchestration/consensus', () => ({
  runConsensusPhase,
}));

vi.mock('../../src/services/scraper/orchestration/init', () => ({
  initScrapeSession: async () => ({
    domain: 'example.com',
    lookupDomain: 'example.com',
    urlLookup: 'example.com',
    domainConfig: null,
    globalAiSettings: { ai_auto_mapping_enabled: false },
    finalSkipAiExtraction: true,
    finalSkipAiVerification: true,
    currencyHint: 'EUR',
    localeHint: 'de_DE',
  }),
}));

vi.mock('../../src/services/scraper/acquisition', () => ({
  acquireHtml: async () => ({
    html: '<html></html>',
    $: cheerio.load('<html></html>'),
    challengeReason: null,
  }),
}));

vi.mock('../../src/services/scraper/orchestration/extraction', () => ({
  runExtractionPhase: async () => ({ currencyHint: 'EUR', localeHint: 'de_DE' }),
}));

vi.mock('../../src/services/scraper/orchestration/verification', () => ({
  runVerificationPhase: async () => {},
}));

vi.mock('../../src/services/scraper/orchestration/maintenance', () => ({
  handleRetailerMaintenance: async () => {},
  handleAutoMapping: async () => null,
  handleRestoreStatus: async () => {},
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

describe('scrapeProductWithVoting forwards the saved extraction preference', () => {
  beforeEach(() => {
    runConsensusPhase.mockClear();
  });

  async function scrape(preferredMethod?: ExtractionMethod) {
    const { scrapeProductWithVoting } = await import('../../src/services/scraper/orchestration/index');
    await scrapeProductWithVoting(
      'https://example.com/p',
      1,
      preferredMethod,
      undefined,
      true,
      true,
      undefined,
      123
    );
    const call = runConsensusPhase.mock.calls[0] as unknown as [{ preferredMethod?: string | null }];
    return call[0];
  }

  it('hands the stored method to the consensus phase', async () => {
    expect((await scrape('custom-css')).preferredMethod).toBe('custom-css');
  });

  it('hands undefined through unchanged when the product has no preference', async () => {
    expect((await scrape(undefined)).preferredMethod).toBeUndefined();
  });
});
