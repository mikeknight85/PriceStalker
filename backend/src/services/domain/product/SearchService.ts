import axios from 'axios';
import { settingsCache } from '../../../utils/cache';
import { RetailerQueryService } from '../retailer/RetailerQueryService';
import { logger } from '../../../utils/system/logger';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  domain: string;
  isSupported: boolean;
}

export class SearchService {
  private retailerQueryService = new RetailerQueryService();

  /**
   * Performs a product search using the configured SearXNG instance.
   */
  async search(query: string): Promise<SearchResult[]> {
    const enabled = await settingsCache.isSearXNGEnabled();
    const searxngUrl = await settingsCache.getSearXNGUrl();

    if (!enabled || !searxngUrl) {
      throw new Error('SearXNG search is disabled or not configured in System Settings');
    }

    try {
      // Clean up base URL and ensure /search endpoint
      const cleanBaseUrl = searxngUrl.endsWith('/') ? searxngUrl.slice(0, -1) : searxngUrl;
      const searchUrl = cleanBaseUrl.includes('/search') ? cleanBaseUrl : `${cleanBaseUrl}/search`;

      const response = await axios.get(searchUrl, {
        params: {
          q: query,
          format: 'json',
          engines: 'google,bing,duckduckgo'
        },
        timeout: 10000
      });

      const results = response.data.results || [];
      const processedResults: SearchResult[] = [];

      // Process and enrich results with support status
      for (const res of results) {
        if (!res.url) continue;

        try {
          const urlObj = new URL(res.url);
          const domain = urlObj.hostname.replace(/^www\./, '');
          
          // Cross-reference with supported retailers
          const config = await this.retailerQueryService.getRetailerForUrl(res.url);

          processedResults.push({
            title: res.title || domain,
            url: res.url,
            content: res.content || '',
            domain,
            isSupported: !!config
          });
        } catch (e) {
          // Skip invalid URLs or results that fail processing
        }
      }

      return processedResults;
    } catch (error: any) {
      logger.error('SearchService | SearXNG query failed', 'Product', error);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('SearXNG search timed out. Please check your network or SearXNG instance.');
      }
      
      throw new Error(`Search failed: ${error.response?.data?.error || error.message}`);
    }
  }
}
