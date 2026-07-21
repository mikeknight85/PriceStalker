import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { getRandomReferrer } from './headers';
import { fetchRemoteHtml } from './remote';
import { PageNotAvailableError } from './errors';

/**
 * Orchestrates a browser-rendered fetch, offloading to the remote scraper.
 */
export async function fetchBrowserHtml(
  url: string, 
  userAgent?: string, 
  proxyServer?: string, 
  referrer?: string, 
  productId?: number, 
  isDiscovery: boolean = false
): Promise<string> {
  const rsUrl = await settingsCache.getRemoteScraperUrl();
  if (!rsUrl) {
    logger.warn('Remote Scraper | Warning | Browser rendering requested but remote_scraper_url is not configured', 'Scraper');
    return '';
  }

  try {
    logger.info(`Remote Scraper | Offloading | ${url}${productId ? ` [PROD-${productId}]` : ''}`, 'Scraper');
    const options: any = {};
    if (userAgent) options.userAgent = userAgent;
    if (productId) options.productId = productId;
    if (proxyServer) {
      options.useProxy = true;
      options.proxyUrl = proxyServer;
    }
    
    // Identity & Stealth Logic
    if (referrer) {
      options.referrer = referrer;
    } else if (isDiscovery) {
      options.referrer = getRandomReferrer();
    } else {
      const defaultReferrer = await settingsCache.getDefaultReferrer();
      if (defaultReferrer) options.referrer = defaultReferrer;
    }
    
    return await fetchRemoteHtml(url, rsUrl, options);
  } catch (error: any) {
    if (error instanceof PageNotAvailableError) throw error;
    logger.error(`Remote Scraper | Failed | Browser Rendering: ${url}: ${error.message}`, 'Scraper');
    return '';
  }
}
