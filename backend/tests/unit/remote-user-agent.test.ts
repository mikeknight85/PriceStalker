import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireRemoteHtml } from '../../src/services/scraper/acquisition/remote';
import { fetchRemoteHtml } from '../../src/services/scraper/transport/remote';
import { FALLBACK_USER_AGENT } from '../../src/services/scraper/transport/headers';
import type { RetailerConfig } from '../../src/models';

/**
 * The configured browser path set a User-Agent only when the retailer had an
 * override, with no fall-through to `resolveUserAgent()` -- which
 * `acquisition/fallback.ts` has always done (issue #67). So a
 * `use_browser_scraper` retailer with no override sent none, the scraper service
 * passed no `--user-agent` to Chromium, and the request went out announcing
 * whichever Chromium build the container image happens to hold.
 *
 * Note what this does and does not fix. `puppeteer-extra-plugin-stealth`'s
 * user-agent-override evasion rewrites `HeadlessChrome/` to `Chrome/`, so this
 * is not the difference between announcing headless and not. It is the identity
 * drifting between the two paths for one retailer: the HTTP attempt announces
 * the configured Chrome, and the browser attempt announced the container's
 * Chromium, on its own platform, with client hints derived from that.
 */

vi.mock('../../src/services/scraper/transport/remote', () => ({
  fetchRemoteHtml: vi.fn().mockResolvedValue('<html><body>ok</body></html>'),
}));

const { getDefaultUserAgent } = vi.hoisted(() => ({
  getDefaultUserAgent: vi.fn().mockResolvedValue('Mozilla/5.0 System Default Chrome/146.0.0.0'),
}));

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getRemoteScraperUrl: vi.fn().mockResolvedValue('http://scraper:3000'),
    getScraperProxy: vi.fn().mockResolvedValue('http://proxy:8888'),
    getDefaultReferrer: vi.fn().mockResolvedValue(null),
    getDefaultUserAgent,
  },
}));

const config = (over: Partial<RetailerConfig>): RetailerConfig => over as RetailerConfig;

/** The options the browser scraper was actually asked for. */
async function requestOptions(domainConfig?: RetailerConfig): Promise<Record<string, unknown>> {
  const steps: string[] = [];
  await acquireRemoteHtml({
    url: 'https://www.target.com.au/p/thing/123',
    domain: 'target.com.au',
    domainConfig,
    productId: 7,
    extractionSteps: steps,
  });
  expect(fetchRemoteHtml).toHaveBeenCalledTimes(1);
  const [, , options] = vi.mocked(fetchRemoteHtml).mock.calls[0];
  return options as Record<string, unknown>;
}

describe('the browser path always sends a User-Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultUserAgent.mockResolvedValue('Mozilla/5.0 System Default Chrome/146.0.0.0');
  });

  it('resolves the system default when the retailer has no override', async () => {
    // This is the bug: `userAgent` used to be absent from this object entirely.
    const options = await requestOptions(config({ use_browser_scraper: true }));
    expect(options.userAgent).toBe('Mozilla/5.0 System Default Chrome/146.0.0.0');
  });

  it('resolves one even with no retailer config at all', async () => {
    const options = await requestOptions(undefined);
    expect(options.userAgent).toBe('Mozilla/5.0 System Default Chrome/146.0.0.0');
  });

  it('still prefers the retailer override', async () => {
    const override = 'Mozilla/5.0 (Macintosh) Chrome/140.0.0.0 Safari/537.36';
    const options = await requestOptions(config({ use_browser_scraper: true, user_agent: override }));
    expect(options.userAgent).toBe(override);
  });

  it('falls back to the built-in string when nothing is configured', async () => {
    getDefaultUserAgent.mockResolvedValue(null);
    const options = await requestOptions(config({ use_browser_scraper: true }));
    expect(options.userAgent).toBe(FALLBACK_USER_AGENT);
  });

  it('never sends the empty string a blank override would produce', async () => {
    // A retailer row with '' in user_agent must not silently disable the UA.
    getDefaultUserAgent.mockResolvedValue('Mozilla/5.0 System Default Chrome/146.0.0.0');
    const options = await requestOptions(config({ use_browser_scraper: true, user_agent: '' }));
    expect(options.userAgent).toBe('Mozilla/5.0 System Default Chrome/146.0.0.0');
  });

  it('resolves the same identity the dynamic fallback would', async () => {
    // fallback.ts calls resolveUserAgent(override); the two paths presenting
    // different browsers for one product is the fault being closed here.
    const { resolveUserAgent } = await import('../../src/services/scraper/transport/headers');
    const options = await requestOptions(config({ use_browser_scraper: true }));
    expect(options.userAgent).toBe(await resolveUserAgent(null));
  });

  it('leaves the proxy and referrer handling alone', async () => {
    const options = await requestOptions(config({ use_browser_scraper: true, use_proxy: true }));
    expect(options.useProxy).toBe(true);
    expect(options.proxyUrl).toBe('http://proxy:8888');
    expect(options.referrer).toBeUndefined();
  });

  it('reports a default UA as Default and an override as Custom in the trace', async () => {
    const steps: string[] = [];
    await acquireRemoteHtml({
      url: 'https://www.target.com.au/p/thing/123',
      domain: 'target.com.au',
      domainConfig: config({ use_browser_scraper: true }),
      extractionSteps: steps,
    });
    expect(steps.some(s => s.includes('Scraper | Remote | UA: Default'))).toBe(true);

    const overrideSteps: string[] = [];
    await acquireRemoteHtml({
      url: 'https://www.target.com.au/p/thing/123',
      domain: 'target.com.au',
      domainConfig: config({ use_browser_scraper: true, user_agent: 'Mozilla/5.0 Custom Chrome/140.0.0.0' }),
      extractionSteps: overrideSteps,
    });
    expect(overrideSteps.some(s => s.includes('Scraper | Remote | UA: Custom'))).toBe(true);
  });
});
