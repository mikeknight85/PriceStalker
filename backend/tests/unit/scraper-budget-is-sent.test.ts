import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireRemoteHtml } from '../../src/services/scraper/acquisition/remote';
import { handleAcquisitionFallback } from '../../src/services/scraper/acquisition/fallback';
import { fetchBrowserHtml } from '../../src/services/scraper/transport/browser';
import { fetchRemoteHtml } from '../../src/services/scraper/transport/remote';
import { DEFAULT_TOTAL_BUDGET_MS } from '../../../scraper/src/utils/budget';
import type { RetailerConfig } from '../../src/models';

/**
 * Every path that asks the browser scraper for a page sends the budget
 * (issue #256).
 *
 * #256 proposed that the backend "pass the configured `browserTimeout`
 * explicitly in every request so the scraper does not fall back to an
 * undersized 45s default". Two of the three paths already did. This pins all
 * three, because the 45s fallback is the number the issue's whole budget
 * argument rests on, and it is only reachable from a caller that forgets to
 * send one.
 */

vi.mock('../../src/services/scraper/transport/remote', () => ({
  fetchRemoteHtml: vi.fn().mockResolvedValue('<html><body>ok</body></html>'),
  PageNotAvailableError: class PageNotAvailableError extends Error {},
}));

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getRemoteScraperUrl: vi.fn().mockResolvedValue('http://scraper:5100'),
    getScraperProxy: vi.fn().mockResolvedValue(null),
    getDefaultReferrer: vi.fn().mockResolvedValue(null),
    getDefaultUserAgent: vi.fn().mockResolvedValue('Mozilla/5.0 System Default Chrome/146.0.0.0'),
    getGenericChallengePhrases: vi.fn().mockResolvedValue(['pardon our interruption']),
    getBrowserDelay: vi.fn().mockResolvedValue(3000),
    getBrowserTimeout: vi.fn().mockResolvedValue(60000),
  },
}));

const config = (over: Partial<RetailerConfig>): RetailerConfig => over as RetailerConfig;

const lastOptions = (): Record<string, unknown> => {
  const calls = vi.mocked(fetchRemoteHtml).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][2] as Record<string, unknown>;
};

describe('the scrape budget reaches the browser scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is sent by the configured browser attempt', async () => {
    await acquireRemoteHtml({
      url: 'https://www.ebgames.com.au/product/thing/1',
      domain: 'ebgames.com.au',
      domainConfig: config({ use_browser_scraper: true }),
      productId: 7,
      extractionSteps: [],
    });

    expect(lastOptions().timeout).toBe(60000);
    expect(lastOptions().delay).toBe(3000);
  });

  it('is sent by the dynamic fallback', async () => {
    await handleAcquisitionFallback({
      url: 'https://www.ebgames.com.au/product/thing/1',
      domain: 'ebgames.com.au',
      productId: 7,
      extractionSteps: [],
      challengeReason: 'Cloudflare Challenge',
    });

    expect(lastOptions().timeout).toBe(60000);
    expect(lastOptions().delay).toBe(3000);
  });

  it('is sent by the direct browser-render helper, which used to omit it', async () => {
    // The one path that did not. It left the scraper budgeting 45s while
    // `fetchRemoteHtml` sized its own request timeout against 60s, so the two
    // ends of the arithmetic disagreed by the whole of the overhead.
    await fetchBrowserHtml('https://www.ebgames.com.au/product/thing/1', 'Mozilla/5.0 Chrome/154.0.0.0');

    expect(lastOptions().timeout).toBe(60000);
    expect(lastOptions().delay).toBe(3000);
  });

  it('never leaves the scraper on its own 45s fallback', async () => {
    // Which is to say: the number #256 built its argument on is not reachable
    // from any production path.
    for (const send of [
      () =>
        acquireRemoteHtml({
          url: 'https://www.ebgames.com.au/product/thing/1',
          domain: 'ebgames.com.au',
          domainConfig: config({ use_browser_scraper: true }),
          extractionSteps: [],
        }),
      () =>
        handleAcquisitionFallback({
          url: 'https://www.ebgames.com.au/product/thing/1',
          domain: 'ebgames.com.au',
          extractionSteps: [],
          challengeReason: 'Cloudflare Challenge',
        }),
      () => fetchBrowserHtml('https://www.ebgames.com.au/product/thing/1'),
    ]) {
      vi.clearAllMocks();
      await send();
      expect(lastOptions().timeout).not.toBe(DEFAULT_TOTAL_BUDGET_MS);
      expect(typeof lastOptions().timeout).toBe('number');
    }
  });
});
