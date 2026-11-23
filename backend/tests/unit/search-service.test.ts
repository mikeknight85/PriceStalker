import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../src/services/domain/product/SearchService';
import { settingsCache } from '../../src/utils/cache';
import axios from 'axios';

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    isSearXNGEnabled: vi.fn(),
    getSearXNGUrl: vi.fn(),
  },
}));

vi.mock('axios');

vi.mock('../../src/services/domain/retailer/RetailerQueryService', () => {
  return {
    RetailerQueryService: class {
      getRetailerForUrl = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('supported.test')) {
          return { id: 1, domain: 'supported.test' };
        }
        return null;
      });
    },
  };
});

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    searchService = new SearchService();
  });

  it('throws an error when SearXNG is disabled in system settings', async () => {
    vi.mocked(settingsCache.isSearXNGEnabled).mockResolvedValueOnce(false);
    vi.mocked(settingsCache.getSearXNGUrl).mockResolvedValueOnce('http://searxng.test');

    await expect(searchService.search('keyboard')).rejects.toThrow(
      'SearXNG search is disabled or not configured in System Settings'
    );
  });

  it('throws an error when SearXNG URL is not configured', async () => {
    vi.mocked(settingsCache.isSearXNGEnabled).mockResolvedValueOnce(true);
    vi.mocked(settingsCache.getSearXNGUrl).mockResolvedValueOnce(null);

    await expect(searchService.search('keyboard')).rejects.toThrow(
      'SearXNG search is disabled or not configured in System Settings'
    );
  });

  it('executes search against SearXNG and enriches results with retailer support status', async () => {
    vi.mocked(settingsCache.isSearXNGEnabled).mockResolvedValueOnce(true);
    vi.mocked(settingsCache.getSearXNGUrl).mockResolvedValueOnce('http://searxng.test');

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        results: [
          {
            title: 'Mechanical Keyboard - Supported Store',
            url: 'https://www.supported.test/product/123',
            content: 'In stock now',
          },
          {
            title: 'Random Item',
            url: 'https://otherstore.test/item/456',
            content: 'Description',
          },
        ],
      },
    });

    const results = await searchService.search('keyboard');
    expect(results).toHaveLength(2);

    expect(axios.get).toHaveBeenCalledWith('http://searxng.test/search', {
      params: {
        q: 'keyboard',
        format: 'json',
        engines: 'google,bing,duckduckgo',
      },
      timeout: 10000,
    });

    const supported = results.find(r => r.domain === 'supported.test');
    expect(supported).toBeDefined();
    expect(supported?.isSupported).toBe(true);

    const unsupported = results.find(r => r.domain === 'otherstore.test');
    expect(unsupported).toBeDefined();
    expect(unsupported?.isSupported).toBe(false);
  });

  it('handles ECONNABORTED network timeout with descriptive error', async () => {
    vi.mocked(settingsCache.isSearXNGEnabled).mockResolvedValueOnce(true);
    vi.mocked(settingsCache.getSearXNGUrl).mockResolvedValueOnce('http://searxng.test');

    const timeoutError: any = new Error('timeout exceeded');
    timeoutError.code = 'ECONNABORTED';
    vi.mocked(axios.get).mockRejectedValueOnce(timeoutError);

    await expect(searchService.search('keyboard')).rejects.toThrow(
      'SearXNG search timed out. Please check your network or SearXNG instance.'
    );
  });
});
