import { retailerRepository, RetailerConfig } from '../../../models';
import { logger } from '../logger';

export class RetailerConfigCache {
  private cache: Map<string, { config: RetailerConfig | null; expiry: number }> = new Map();
  private readonly TTL = 10 * 60 * 1000;
  
  async getConfig(urlLookup: string): Promise<RetailerConfig | null> {
    const now = Date.now();
    const cached = this.cache.get(urlLookup);
    if (cached && cached.expiry > now) return cached.config;
    try {
      const config = await retailerRepository.getConfigForUrl(urlLookup);
      this.cache.set(urlLookup, { config, expiry: now + this.TTL });
      return config;
    } catch (error) {
      logger.error(`Retailer ${urlLookup} | Config Fetch Failed | ${error}`, 'Config');
      return null;
    }
  }

  invalidate(urlLookup?: string): void {
    if (urlLookup) {
      this.cache.delete(urlLookup);
      // Also try to invalidate variants (e.g. apple.com vs apple.com/au)
      const domain = urlLookup.split('/')[0];
      for (const key of this.cache.keys()) {
        if (key.startsWith(domain)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}

export const configCache = new RetailerConfigCache();
