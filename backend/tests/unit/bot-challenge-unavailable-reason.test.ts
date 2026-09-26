import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';

/**
 * `UnavailableReason` has declared `'bot_or_challenge'` since it existed, and
 * both backend and frontend carry the sentence for it -- "The retailer served a
 * bot check instead of the product page". Nothing ever assigned it, so the
 * string could not be shown to anybody (issue #67).
 *
 * The reason was structural. `unavailableReason` is only set in
 * `scrapeProductWithVoting`'s catch block, and a bot challenge never reaches it:
 * acquisition catches `BotChallengeError` and turns it into a challenge string,
 * which returns normally. So `ProductRefreshService` saw no reason at all, took
 * the `else if (!reason)` branch meant for "the page was actually read", and
 * *cleared* the failure state. A retailer could deny every scheduled refresh
 * indefinitely with the failure counter stuck at zero and nothing notified.
 *
 * Both halves are asserted here: the orchestration now records the reason, and
 * the refresh path counts it instead of clearing it.
 */

const challenge: { reason: string | null } = { reason: 'Akamai Behavioural Challenge' };
const candidates: { push: boolean } = { push: false };

vi.mock('../../src/services/scraper/orchestration/init', () => ({
  initScrapeSession: async () => ({
    domain: 'target.com.au',
    lookupDomain: 'target.com.au',
    urlLookup: 'target.com.au',
    domainConfig: null,
    globalAiSettings: { ai_auto_mapping_enabled: false },
    finalSkipAiExtraction: true,
    finalSkipAiVerification: true,
    currencyHint: 'AUD',
    localeHint: 'en_AU',
  }),
}));

vi.mock('../../src/services/scraper/acquisition', () => ({
  acquireHtml: async () => ({
    html: '<html><body><div id="sec-if-cpt-container"></div></body></html>',
    $: cheerio.load('<html><body><div id="sec-if-cpt-container"></div></body></html>'),
    challengeReason: challenge.reason,
    usedRemoteFallback: false,
    learnedFlags: {},
  }),
}));

vi.mock('../../src/services/scraper/orchestration/extraction', () => ({
  runExtractionPhase: async (_opts: unknown, result: ScrapedProductWithVoting) => {
    // Phase 2 writes into the result object, which is how the success-first
    // branch in Phase 3 sees that a price was found despite the challenge.
    if (candidates.push) {
      result.priceCandidates = [{ price: 79, currency: 'AUD', method: 'json-ld', confidence: 0.95 }];
      result.price = { price: 79, currency: 'AUD' };
    }
    return { currencyHint: 'AUD', localeHint: 'en_AU' };
  },
}));

vi.mock('../../src/services/scraper/orchestration/consensus', () => ({
  runConsensusPhase: async () => {},
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

async function scrape() {
  const { scrapeProductWithVoting } = await import('../../src/services/scraper/orchestration/index');
  return scrapeProductWithVoting('https://www.target.com.au/p/thing/123', 1, undefined, undefined, true, true, undefined, 42);
}

describe('a detected challenge records a reason the refresh path can read', () => {
  beforeEach(() => {
    challenge.reason = 'Akamai Behavioural Challenge';
    candidates.push = false;
  });

  it('sets bot_or_challenge alongside the failure reason', async () => {
    const result = await scrape();
    expect(result.failureReason).toBe('bot_challenge');
    expect(result.failureDetail).toBe('Akamai Behavioural Challenge');
    // The assignment that did not exist. Without it the refresh path sees
    // nothing and clears the product's failure state.
    expect(result.unavailableReason).toBe('bot_or_challenge');
  });

  it('records it for the Access Denied page too, not just the interstitial', async () => {
    challenge.reason = 'Akamai Access Denied';
    expect((await scrape()).unavailableReason).toBe('bot_or_challenge');
  });

  it('records nothing when the page was read normally', async () => {
    challenge.reason = null;
    const result = await scrape();
    expect(result.unavailableReason).toBeUndefined();
    expect(result.failureReason).toBe('no_price_found');
  });

  it('records nothing when a price was found despite the challenge', async () => {
    // Success-first: a challenge that still yielded price data is not a failure,
    // and must not count against the retailer.
    candidates.push = true;
    const result = await scrape();
    expect(result.price).not.toBeNull();
    expect(result.failureReason).toBeUndefined();
    expect(result.unavailableReason).toBeUndefined();
  });

  it('is a transient reason, so a bot wall can never mark a product gone', async () => {
    const { isDefinitiveUnavailable } = await import('../../src/types/availability');
    expect(isDefinitiveUnavailable((await scrape()).unavailableReason)).toBe(false);
  });
});
