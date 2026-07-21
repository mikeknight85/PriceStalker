import { RegionalCurrencyMapping } from '../../../models';
import { logger } from '../logger';

export class RegionalMappingCache {
  private cache: RegionalCurrencyMapping[] | null = null;
  private expiry = 0;
  private readonly TTL = 1000 * 60 * 60;

  async getMappings(): Promise<RegionalCurrencyMapping[]> {
    const now = Date.now();
    if (this.cache && this.expiry > now) return this.cache;
    try {
      const { regionalCurrencyRepository } = await import('../../../models');
      const mappings = await regionalCurrencyRepository.getAll();
      this.cache = mappings;
      this.expiry = now + this.TTL;
      return mappings;
    } catch (error) {
      logger.error('System | Config | Regional Mappings Fetch Failed', 'Config', error);
      return [];
    }
  }

  async getHintForUrl(url: string): Promise<string | null> {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    const mappings = await this.getMappings();
    const tldMatch = mappings.find(m => {
      if (m.match_type !== 'tld') return false;
      const code = m.pattern.replace(/^\./, '').toLowerCase();
      const regex = new RegExp('(^|\\.)' + code + '(\\.|$)');
      return regex.test(hostname);
    });
    if (tldMatch) return tldMatch.currency;
    const pathMatch = mappings.find(m => m.match_type === 'path' && path.includes(m.pattern.toLowerCase()));
    if (pathMatch) return pathMatch.currency;
    return null;
  }

  async getLookupDomain(url: string): Promise<string> {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.toLowerCase();
    const mappings = await this.getMappings();
    
    // Check if path starts with any of our regional path patterns
    const pathMatch = mappings.find(m => m.match_type === 'path' && path.startsWith(m.pattern.toLowerCase()));
    if (pathMatch) {
      // If pattern is e.g. "/au/", domain becomes "google.com/au"
      const cleanPattern = pathMatch.pattern.replace(/^\/|\/$/g, ''); // remove leading/trailing slashes
      return `${hostname}/${cleanPattern}`;
    }
    
    return hostname;
  }

  clear(): void {
    this.cache = null;
    this.expiry = 0;
  }
}

export const regionalMappingCache = new RegionalMappingCache();
