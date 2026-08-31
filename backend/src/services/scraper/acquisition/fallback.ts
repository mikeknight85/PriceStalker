import { load, type CheerioAPI } from 'cheerio';
import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { 
  detectBotChallenge, 
  fetchRemoteHtml, 
  fetchBrowserHtml,
  resolveUserAgent
} from '../transport';

export interface FallbackOptions {
  url: string;
  domain: string;
  productId?: number;
  extractionSteps: string[];
  challengeReason: string;
  /** The retailer's User-Agent override, if it has one. */
  userAgent?: string | null;
}

export interface FallbackResult {
  html: string;
  $: CheerioAPI;
  challengeReason: string | null;
  learnedFlags: any;
}

export async function handleAcquisitionFallback(options: FallbackOptions): Promise<FallbackResult | null> {
  const { url, domain, productId, extractionSteps, challengeReason, userAgent } = options;
  
  logger.warn(`Scraper | Block | ${challengeReason} detected. Triggering fallback for ${domain}`, 'Scraper', { product_id: productId });
  extractionSteps.push(`Scraper | Fallback | Triggered by ${challengeReason}`);
  
  let html = '';
  let $;
  let learnedFlags: any = {};
  let finalChallengeReason: string | null = challengeReason;

  const rsUrl = await settingsCache.getRemoteScraperUrl();
  if (rsUrl) {
    try {
      const isDiscovery = !productId;
      // The same identity the HTTP attempt just used. Both remote calls used to
      // omit it entirely, so the fallback presented a different browser -- and
      // headless Chromium's own -- to a retailer that had just been shown the
      // configured one.
      const remoteOptions: any = { productId, isDiscovery, userAgent: await resolveUserAgent(userAgent) };
      // Referrer policy: system default or none — never a fabricated random
      // one (issue #44).
      const defaultReferrer = await settingsCache.getDefaultReferrer();
      remoteOptions.referrer = defaultReferrer || undefined;

      html = await fetchRemoteHtml(url, rsUrl, remoteOptions);
      logger.info(`Scraper | Fallback | Remote success for ${domain}`, 'Scraper', { product_id: productId });
      extractionSteps.push(`Scraper | Fallback | Remote Success`);
      $ = load(html);
      finalChallengeReason = detectBotChallenge(html, $);
      if (!finalChallengeReason) learnedFlags = { use_browser_scraper: true };
      
      return { html, $, challengeReason: finalChallengeReason, learnedFlags };
    } catch (e) {
      logger.error(`Scraper | Fallback | Remote failed for ${domain}: ${(e as any).message}`, 'Scraper', { product_id: productId, error: e });
      extractionSteps.push(`Scraper | Fallback | Remote Failed: ${(e as any).message}`);
    }
  } else {
    try {
      logger.warn(`Scraper | Fallback | Local browser fallback for ${domain}`, 'Scraper', { product_id: productId });
      html = await fetchBrowserHtml(url, await resolveUserAgent(userAgent), undefined, undefined, productId);
      if (html) logger.info(`Scraper | Fallback | Local success for ${domain}`, 'Scraper', { product_id: productId });
      extractionSteps.push(html ? `Scraper | Fallback | Local Success` : `Scraper | Fallback | Local Failed`);
      
      if (html) {
        $ = load(html);
        finalChallengeReason = detectBotChallenge(html, $);
        if (!finalChallengeReason) learnedFlags = { use_browser_scraper: true };
        return { html, $, challengeReason: finalChallengeReason, learnedFlags };
      }
    } catch (e) {
      logger.error(`Scraper | Fallback | Local failed for ${domain}: ${(e as any).message}`, 'Scraper', { product_id: productId, error: e });
      extractionSteps.push(`Scraper | Fallback | Local Failed: ${(e as any).message}`);
    }
  }

  return null;
}
