import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { acquireStandardHtml, BotChallengeError } from '../../src/services/scraper/acquisition/standard';
import { acquireHtml } from '../../src/services/scraper/acquisition/index';
import { PageNotAvailableError } from '../../src/services/scraper/transport/errors';
import type { RetailerConfig } from '../../src/models';

// Keep real AxiosError / AxiosHeaders while mocking network methods
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
      post: vi.fn(),
    },
    get: vi.fn(),
    post: vi.fn(),
  };
});

function httpStatusError(status: number, data: unknown): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    {
      status,
      statusText: status === 410 ? 'Gone' : status === 403 ? 'Forbidden' : 'Not Found',
      data,
      headers: {},
      config,
    }
  );
}
vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getScraperProxy: vi.fn().mockResolvedValue('http://proxy.com:8888'),
    get: vi.fn().mockResolvedValue('45000'),
    getDefaultUserAgent: vi.fn().mockResolvedValue('Mozilla/5.0 Mock UA'),
    getRemoteScraperUrl: vi.fn().mockResolvedValue('http://scraper:5100'),
    getDefaultReferrer: vi.fn().mockResolvedValue(null),
    getGenericChallengePhrases: vi.fn().mockResolvedValue(['pardon our interruption', 'security check']),
    getBrowserDelay: vi.fn().mockResolvedValue(3000),
    getBrowserTimeout: vi.fn().mockResolvedValue(60000),
  }
}));

describe('acquireStandardHtml Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully fetch HTML without proxy', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html>Test HTML</html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    const html = await acquireStandardHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(html).toBe('<html>Test HTML</html>');
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(steps).toContain('Request | HTTP | UA: Yes | Proxy: No');
  });

  it('should fall back to no-proxy if proxy request fails with proxy error', async () => {
    // First call (with proxy) fails with ECONNREFUSED/proxy error
    // Second call (without proxy) succeeds
    const error: Error & { code?: string; config?: { httpsAgent: object } } = new Error('Proxy connection refused');
    error.code = 'ECONNREFUSED';
    error.config = { httpsAgent: {} }; // simulate having proxy agent

    vi.mocked(axios.get)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        status: 200,
        data: '<html>Fallback Success</html>',
        request: { res: { responseUrl: 'http://example.com/product' } }
      });

    const steps: string[] = [];
    const domainConfig = { use_proxy: true } as unknown as RetailerConfig;

    const html = await acquireStandardHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      domainConfig,
      extractionSteps: steps
    });

    expect(html).toBe('<html>Fallback Success</html>');
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(steps).toContain('Request | Proxy Fallback | Proxy failed (ECONNREFUSED). Retrying without proxy.');
  });

  it('should throw BotChallengeError when axios hits ERR_FR_TOO_MANY_REDIRECTS', async () => {
    const error: Error & { code?: string } = new Error('Maximum number of redirects exceeded');
    error.code = 'ERR_FR_TOO_MANY_REDIRECTS';

    vi.mocked(axios.get).mockRejectedValue(error);

    const steps: string[] = [];
    await expect(acquireStandardHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow('Redirect Loop (Queue-it / Anti-Bot Challenge)');

    expect(steps.some(s => s.includes('Redirect Loop'))).toBe(true);
  });
});

describe('acquireHtml Soft-404 Heuristics Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully pass validation on normal product HTML', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>My Product</title></head><body><div class="price">$199</div></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.html).toContain('My Product');
    expect(result.challengeReason).toBeNull();
  });

  it('should throw PageNotAvailableError when page title contains "product not found"', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Error: Product Not Found | My Store</title></head><body></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    await expect(acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow(PageNotAvailableError);

    expect(steps).toContain('Soft-404 | Title match: "error: product not found | my store" contains "product not found"');
  });

  it('should throw PageNotAvailableError when robots meta contains "noindex"', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Some Page</title><meta name="robots" content="noindex, follow"></head><body></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    await expect(acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow(PageNotAvailableError);

    expect(steps).toContain('Soft-404 | Robots meta tag contains noindex: "noindex, follow"');
  });

  it('should not throw PageNotAvailableError when robots meta contains "noindex" but page has product metadata', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Some Page</title><meta name="robots" content="noindex, follow"><meta itemprop="lowPrice" content="199"></head><body></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.html).toContain('Some Page');
    expect(steps).toContain('Soft-404 | Robots meta has noindex but page has valid product/price metadata. Skipping robots check.');
  });

  it('should throw PageNotAvailableError when common error CSS selector is present', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Some Title</title></head><body><div class="product-not-found">This item is no longer available.</div></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    await expect(acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow(PageNotAvailableError);

    expect(steps).toContain('Soft-404 | Found error selector: ".product-not-found"');
  });

  it('should throw PageNotAvailableError when redirected to root page (soft-404)', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html>Home Page</html>',
      request: { res: { responseUrl: 'http://example.com/' } }
    });

    const steps: string[] = [];
    await expect(acquireHtml({
      url: 'http://example.com/product-really-long-path',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow(PageNotAvailableError);
  });

  it('should throw PageNotAvailableError when redirected to an error/search page (soft-404)', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html>Error Page</html>',
      request: { res: { responseUrl: 'http://example.com/not-found' } }
    });

    const steps: string[] = [];
    await expect(acquireHtml({
      url: 'http://example.com/product-really-long-path',
      domain: 'example.com',
      extractionSteps: steps
    })).rejects.toThrow(PageNotAvailableError);
  });
});

describe('acquireHtml browser scraper fallback prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fall back to standard HTTP when browser scraper fails for a required retailer', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Browser Scraper failed (500): Navigation timeout of 45000ms exceeded'));

    const steps: string[] = [];
    const domainConfig = { use_browser_scraper: true } as unknown as RetailerConfig;

    await expect(acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      domainConfig,
      extractionSteps: steps
    })).rejects.toThrow('Browser Scraper failed');

    // axios.get (plain HTTP) must NEVER have been called
    expect(axios.get).not.toHaveBeenCalled();
    expect(steps.some(s => s.startsWith('Scraper | Remote | Failed:'))).toBe(true);
  });

  // The browser scraper is optional. A retailer flagged `use_browser_scraper`
  // on an install that has no `remote_scraper_url` must still be scraped over
  // HTTP: hard-failing instead pinned such a domain to a path that cannot run,
  // because nothing ever clears the flag. See `acquireRemoteHtml`.
  it('falls back to standard HTTP when no remote scraper URL is configured', async () => {
    const { settingsCache } = await import('../../src/utils/cache');
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue(null);

    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Still Scraped</title></head><body><div class="price">$10</div></body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    const domainConfig = { use_browser_scraper: true } as unknown as RetailerConfig;

    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      domainConfig,
      extractionSteps: steps
    });

    expect(result.html).toContain('Still Scraped');
    expect(result.challengeReason).toBeNull();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(steps).toContain('Scraper | Remote | URL not configured, falling back to HTTP');

    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue('http://scraper:5100');
  });
});

describe('acquireHtml does not learn use_browser_scraper from a failed fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A fallback that produced nothing is not evidence that the browser is what
  // the domain needs -- most often it produced nothing because there is no
  // remote scraper to produce it. Persisting the flag on that non-evidence made
  // `maintenance.ts` auto-create a config, after which HTTP was skipped,
  // Attempt 3 was gated off by the now-existing config, and the domain never
  // recovered from a transient 403.
  it('leaves learnedFlags empty when the browser fallback produces nothing', async () => {
    const { settingsCache } = await import('../../src/utils/cache');
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue(null);

    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.challengeReason).toBe('Akamai Access Denied');
    expect(result.learnedFlags).toEqual({});
    expect(result.learnedFlags?.use_browser_scraper).toBeUndefined();

    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue('http://scraper:5100');
  });

  it('still learns use_browser_scraper when the fallback actually succeeds', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });
    vi.mocked(axios.post).mockResolvedValue({
      status: 200,
      data: { html: '<html><head><title>Real Product</title></head><body><div class="price">$42</div></body></html>' }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.html).toContain('Real Product');
    expect(result.learnedFlags).toEqual({ use_browser_scraper: true });
    expect(result.usedRemoteFallback).toBe(true);
  });

  it('updates challengeReason to the browser challenge when remote fallback is also challenged', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });
    vi.mocked(axios.post).mockResolvedValue({
      status: 200,
      data: {
        html: '<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/h/b/x"></script></body></html>'
      }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.challengeReason).toBe('Cloudflare Challenge');
    expect(result.usedRemoteFallback).toBe(true);
  });

  it('leaves learnedFlags empty when the remote fallback throws an error', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>',
      request: { res: { responseUrl: 'http://example.com/product' } }
    });
    vi.mocked(axios.post).mockRejectedValue(new Error('Browser Scraper failed (500)'));

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'http://example.com/product',
      domain: 'example.com',
      extractionSteps: steps
    });

    expect(result.challengeReason).toBe('Akamai Access Denied');
    expect(result.learnedFlags).toEqual({});
    expect(result.learnedFlags?.use_browser_scraper).toBeUndefined();
  });
});

describe('bot walls disguised as HTTP 403/404/410 and soft-404s', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws BotChallengeError for HTTP 403 Forbidden', async () => {
    vi.mocked(axios.get).mockRejectedValue(httpStatusError(403, 'Forbidden'));

    await expect(acquireStandardHtml({
      url: 'https://example.com/product',
      domain: 'example.com',
      extractionSteps: []
    })).rejects.toThrow(new BotChallengeError('HTTP 403 Forbidden'));
  });

  it.each([
    [
      'Akamai Access Denied on 404',
      404,
      '<html><head><title>Access Denied</title></head><body>Reference #18.abc12345</body></html>',
      'Akamai Access Denied (served as HTTP 404)',
    ],
    [
      'Akamai Behavioural Challenge on 404',
      404,
      '<html><body><div id="sec-if-cpt-container" role="main"></div></body></html>',
      'Akamai Behavioural Challenge (served as HTTP 404)',
    ],
    [
      'Cloudflare Challenge on 410',
      410,
      '<html><head><title>Just a moment...</title></head><body>cf-browser-verification</body></html>',
      'Cloudflare Challenge (served as HTTP 410)',
    ],
    [
      'DataDome Challenge on 404',
      404,
      '<html><body><script src="https://geo.captcha-delivery.com/c.js"></script></body></html>',
      'DataDome Challenge (served as HTTP 404)',
    ],
  ])('classifies %s as BotChallengeError rather than PageNotAvailableError', async (_label, status, body, expectedMessage) => {
    vi.mocked(axios.get).mockRejectedValue(httpStatusError(status, body));

    const steps: string[] = [];
    await expect(acquireStandardHtml({
      url: 'https://www.digitec.ch/en/s1/product/item-123',
      domain: 'digitec.ch',
      extractionSteps: steps
    })).rejects.toThrow(new BotChallengeError(expectedMessage));

    expect(steps.some(s => s.includes('Request | Challenge |'))).toBe(true);
  });

  it('throws PageNotAvailableError with http_404 / http_410 when the body carries no challenge markers', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(
      httpStatusError(404, '<html><head><title>404 Not Found</title></head><body>No such product.</body></html>')
    );

    await expect(acquireStandardHtml({
      url: 'https://example.com/product',
      domain: 'example.com',
      extractionSteps: []
    })).rejects.toMatchObject({
      name: 'PageNotAvailableError',
      reason: 'http_404',
    });

    vi.mocked(axios.get).mockRejectedValueOnce(
      httpStatusError(410, { error: 'Gone' })
    );

    await expect(acquireStandardHtml({
      url: 'https://example.com/product',
      domain: 'example.com',
      extractionSteps: []
    })).rejects.toMatchObject({
      name: 'PageNotAvailableError',
      reason: 'http_410',
    });
  });

  it('routes a 404 carrying a bot wall into the browser fallback instead of declaring the product gone', async () => {
    // End-to-end invariant for commit 98c97da: Digitec's Akamai wall returned
    // HTTP 404, which used to throw PageNotAvailableError straight out of
    // acquireHtml without trying the browser fallback.
    vi.mocked(axios.get).mockRejectedValue(
      httpStatusError(404, '<html><head><title>Access Denied</title></head><body>Reference #18.abc12345</body></html>')
    );
    vi.mocked(axios.post).mockResolvedValue({
      status: 200,
      data: { html: '<html><head><title>Sony WH-1000XM5</title></head><body><span class="price">CHF 279</span></body></html>' }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'https://www.digitec.ch/en/s1/product/sony-wh-1000xm5-123',
      domain: 'digitec.ch',
      extractionSteps: steps
    });

    expect(result.html).toContain('Sony WH-1000XM5');
    expect(result.challengeReason).toBeNull();
    expect(result.usedRemoteFallback).toBe(true);
    expect(result.learnedFlags).toEqual({ use_browser_scraper: true });
    expect(steps).toContain('Scraper | Fallback | Triggered by Akamai Access Denied (served as HTTP 404)');
  });

  it('does not trigger the browser fallback on a genuine 404', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      httpStatusError(404, '<html><head><title>404</title></head><body>Page removed</body></html>')
    );

    await expect(acquireHtml({
      url: 'https://example.com/removed-product',
      domain: 'example.com',
      extractionSteps: []
    })).rejects.toThrow(PageNotAvailableError);

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('classifies a robot-check interstitial carrying robots=noindex as a challenge rather than a soft-404', async () => {
    // Commit e82b05b: Digitec's "Are you a robot?" interstitial ships with
    // <meta name="robots" content="noindex"> and no product metadata, so
    // running checkSoft404 before detectBotChallenge misread it as a dead page.
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: '<html><head><title>Are you a robot?</title><meta name="robots" content="noindex, nofollow"></head><body><p>Please complete the security check.</p></body></html>',
      request: { res: { responseUrl: 'https://www.digitec.ch/en/s1/product/item-123' } }
    });
    vi.mocked(axios.post).mockResolvedValue({
      status: 200,
      data: { html: '<html><head><title>Recovered Product</title></head><body><span class="price">CHF 99</span></body></html>' }
    });

    const steps: string[] = [];
    const result = await acquireHtml({
      url: 'https://www.digitec.ch/en/s1/product/item-123',
      domain: 'digitec.ch',
      extractionSteps: steps
    });

    expect(result.html).toContain('Recovered Product');
    expect(result.usedRemoteFallback).toBe(true);
    expect(steps).toContain('Scraper | Fallback | Triggered by Robot Check Interstitial');
  });
});
