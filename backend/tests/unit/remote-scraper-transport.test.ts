import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchRemoteHtml } from '../../src/services/scraper/transport/remote';
import { logger } from '../../src/utils/system/logger';

vi.mock('axios');
vi.mock('../../src/utils/system/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('fetchRemoteHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('successfully fetches HTML on 200 response', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { html: '<html><body>Product Page</body></html>' },
      status: 200,
    });

    const htmlPromise = fetchRemoteHtml('https://example.com/item', 'http://remotescraper:5100', {
      userAgent: 'CustomUA/1.0',
      productId: 42,
    });

    await expect(htmlPromise).resolves.toBe('<html><body>Product Page</body></html>');
    expect(axios.post).toHaveBeenCalledWith(
      'http://remotescraper:5100/scrape',
      expect.objectContaining({
        url: 'https://example.com/item',
        options: expect.objectContaining({
          userAgent: 'CustomUA/1.0',
          productId: 42,
        }),
      }),
      expect.objectContaining({
        timeout: 70000,
      })
    );
  });

  it('throws descriptive configuration error when remote scraper URL returns 404 or 410', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({
      response: { status: 404, data: { error: 'Not Found' } },
      message: 'Request failed with status code 404',
    });

    const promise = fetchRemoteHtml('https://example.com/item', 'http://remotescraper:5100');
    await expect(promise).rejects.toThrow('Browser Scraper endpoint not found (404)');
  });

  it('retries on 503 Server Busy with backoff', async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce({
        response: { status: 503, data: { error: 'Server busy' } },
        message: 'Request failed with status code 503',
      })
      .mockResolvedValueOnce({
        data: { html: '<html>Recovered</html>' },
        status: 200,
      });

    const promise = fetchRemoteHtml('https://example.com/item', 'http://remotescraper:5100');

    // Advance timer for the first retry backoff (2^1 * 1000 = 2000ms)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('<html>Recovered</html>');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Busy | Retrying in 2000ms'),
      'Scraper'
    );
  });

  it('handles abort errors cleanly', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.mocked(axios.post).mockRejectedValueOnce(abortError);

    const promise = fetchRemoteHtml('https://example.com/item', 'http://remotescraper:5100');
    await expect(promise).rejects.toThrow('Browser Scraper request aborted');
  });
});
