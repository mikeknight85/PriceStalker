import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
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
  productId?: number
): Promise<string> {
  const rsUrl = await settingsCache.getRemoteScraperUrl();
  if (!rsUrl) {
    logger.warn('Browser Scraper | Warning | Browser rendering requested but remote_scraper_url is not configured', 'Scraper');
    return '';
  }

  try {
    logger.info(`Browser Scraper | Offloading | ${url}${productId ? ` [PROD-${productId}]` : ''}`, 'Scraper');
    // Send the scrape budget the same way `acquisition/remote.ts` and
    // `acquisition/fallback.ts` do. Issue #256 argued the scraper was falling
    // back to its undersized 45s default; on those two paths it never was, but
    // this one did omit `timeout`, which left the scraper budgeting 45s while
    // `fetchRemoteHtml` sized its request timeout against 60s. Sending it
    // keeps the two ends of the arithmetic reading the same number.
    const options: any = {
      timeout: await settingsCache.getBrowserTimeout(),
      delay: await settingsCache.getBrowserDelay(),
      challengePatterns: await settingsCache.getGenericChallengePhrases(),
    };
    if (userAgent) options.userAgent = userAgent;
    if (productId) options.productId = productId;
    if (proxyServer) {
      options.useProxy = true;
      options.proxyUrl = proxyServer;
    }
    
    // Referrer policy: retailer config, then the system default, then none.
    // A fabricated random referrer (search engines, social sites) looks less
    // like a user refreshing an open tab and some sites reject it (issue #44).
    if (referrer) {
      options.referrer = referrer;
    } else {
      const defaultReferrer = await settingsCache.getDefaultReferrer();
      if (defaultReferrer) options.referrer = defaultReferrer;
    }
    
    return await fetchRemoteHtml(url, rsUrl, options);
  } catch (error: any) {
    if (error instanceof PageNotAvailableError) throw error;
    logger.error(`Browser Scraper | Failed | Browser Rendering: ${url}: ${error.message}`, 'Scraper');
    return '';
  }
}
