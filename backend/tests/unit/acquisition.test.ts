import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { acquireStandardHtml } from '../../src/services/scraper/acquisition/standard';
import { acquireHtml } from '../../src/services/scraper/acquisition/index';
import { PageNotAvailableError } from '../../src/services/scraper/transport/errors';

// Mock axios and settingsCache
vi.mock('axios');
vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getScraperProxy: vi.fn().mockResolvedValue('http://proxy.com:8888'),
    get: vi.fn().mockResolvedValue('45000'),
    getDefaultUserAgent: vi.fn().mockResolvedValue('Mozilla/5.0 Mock UA'),
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
    const error = new Error('Proxy connection refused') as any;
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
    const domainConfig = { use_proxy: true } as any;

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

