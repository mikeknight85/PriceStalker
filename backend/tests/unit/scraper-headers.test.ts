import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDefaultUserAgent = vi.fn<[], Promise<string | null>>();

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getDefaultUserAgent: () => getDefaultUserAgent(),
    get: vi.fn(),
    getScraperProxy: vi.fn(),
    getRemoteScraperUrl: vi.fn(),
    getDefaultReferrer: vi.fn(),
  },
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { getHeaders, resolveUserAgent, FALLBACK_USER_AGENT } from '../../src/services/scraper/transport/headers';
import { logger } from '../../src/utils/system/logger';

/** The value migration 006 seeds into `default_user_agent`. */
const SEEDED_DEFAULT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/** Reads back the version each of the two halves of the request claims. */
function claimedVersions(headers: Record<string, string>) {
  return {
    fromUserAgent: headers['User-Agent'].match(/Chrom(?:e|ium)\/(\d+)/)?.[1] ?? null,
    fromHints: headers['Sec-Ch-Ua']?.match(/"Chromium";v="(\d+)"/)?.[1] ?? null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDefaultUserAgent.mockResolvedValue(SEEDED_DEFAULT);
});

describe('getHeaders', () => {
  it('does not announce two different browsers in one request', async () => {
    // The bug, stated as a test. The seeded default is Chrome 146 and the
    // hints were hardcoded to Chrome 121, on every request of every install.
    const { fromUserAgent, fromHints } = claimedVersions(await getHeaders());
    expect(fromUserAgent).toBe('146');
    expect(fromHints).toBe(fromUserAgent);
  });

  it('follows a retailer override with its hints', async () => {
    // A per-retailer user_agent used to receive the same hardcoded
    // Chrome-on-Windows hints, so configuring a Mac UA for one retailer
    // produced a browser that has never existed.
    const headers = await getHeaders(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    );
    expect(claimedVersions(headers)).toEqual({ fromUserAgent: '133', fromHints: '133' });
    expect(headers['Sec-Ch-Ua-Platform']).toBe('"macOS"');
  });

  it('sends no client hints for a Firefox override', async () => {
    // Rather than describing a Firefox that ships Chromium's hints.
    const headers = await getHeaders('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0');
    expect(headers['Sec-Ch-Ua']).toBeUndefined();
    expect(headers['Sec-Ch-Ua-Mobile']).toBeUndefined();
    expect(headers['Sec-Ch-Ua-Platform']).toBeUndefined();
    expect(headers['User-Agent']).toContain('Firefox/129.0');
  });

  it('still sends the fetch metadata every browser sends', async () => {
    const headers = await getHeaders();
    expect(headers['Sec-Fetch-Dest']).toBe('document');
    expect(headers['Sec-Fetch-Mode']).toBe('navigate');
    expect(headers['Upgrade-Insecure-Requests']).toBe('1');
  });

  it('falls back to a self-consistent User-Agent when nothing is configured', async () => {
    getDefaultUserAgent.mockResolvedValue(null);
    const { fromUserAgent, fromHints } = claimedVersions(await getHeaders());
    expect(fromUserAgent).toBe(fromHints);
  });

  it('says so when it cannot identify the configured browser', async () => {
    // Silently dropping the hints for a UA we failed to parse would look like
    // the headers were simply fine.
    getDefaultUserAgent.mockResolvedValue('some-internal-crawler/1.0');
    const headers = await getHeaders();
    expect(headers['Sec-Ch-Ua']).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not identify the browser'),
      'Scraper'
    );
  });
});

describe('resolveUserAgent', () => {
  it('prefers a retailer override', async () => {
    await expect(resolveUserAgent('custom/1.0')).resolves.toBe('custom/1.0');
  });

  it('falls back to the system setting, then to the built-in', async () => {
    await expect(resolveUserAgent()).resolves.toBe(SEEDED_DEFAULT);
    getDefaultUserAgent.mockResolvedValue(null);
    await expect(resolveUserAgent()).resolves.toBe(FALLBACK_USER_AGENT);
  });

  it('gives the browser path the same identity as the HTTP path', async () => {
    // Both remote calls used to pass undefined, so a retailer that had just
    // seen the configured Chrome saw headless Chromium on the fallback.
    const httpUa = (await getHeaders())['User-Agent'];
    await expect(resolveUserAgent()).resolves.toBe(httpUa);
  });
});
