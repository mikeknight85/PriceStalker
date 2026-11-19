import { load, type CheerioAPI } from 'cheerio';
import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { 
  detectBotChallenge, 
  fetchRemoteHtml, 
  fetchBrowserHtml,
  resolveUserAgent
} from '../transport';
import type { RemoteScraperOptions } from './remote';

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
      const remoteOptions: RemoteScraperOptions = {
        productId,
        isDiscovery,
        userAgent: await resolveUserAgent(userAgent),
        challengePatterns: await settingsCache.getGenericChallengePhrases(),
        delay: await settingsCache.getBrowserDelay(),
        timeout: await settingsCache.getBrowserTimeout(),
      };
      // Referrer policy: system default or none — never a fabricated random
      // one (issue #44).
      const defaultReferrer = await settingsCache.getDefaultReferrer();
      remoteOptions.referrer = defaultReferrer || undefined;

      html = await fetchRemoteHtml(url, rsUrl, remoteOptions);
      logger.info(`Scraper | Fallback | Remote success for ${domain}`, 'Scraper', { product_id: productId });
      extractionSteps.push(`Scraper | Fallback | Remote Success`);
      $ = load(html);
      finalChallengeReason = detectBotChallenge(html, $);

      const remoteScraperProxy = await settingsCache.getRemoteScraperProxy();
      if (finalChallengeReason && remoteScraperProxy) {
        extractionSteps.push(`Scraper | Fallback | Remote hit challenge (${finalChallengeReason}). Retrying Remote Scraper with Proxy.`);
        try {
          const proxiedRemoteOptions: RemoteScraperOptions = {
            ...remoteOptions,
            useProxy: true,
            proxyUrl: remoteScraperProxy
          };
          const proxiedHtml = await fetchRemoteHtml(url, rsUrl, proxiedRemoteOptions);
          const proxied$ = load(proxiedHtml);
          const proxiedChallenge = detectBotChallenge(proxiedHtml, proxied$);
          if (!proxiedChallenge) {
            html = proxiedHtml;
            $ = proxied$;
            finalChallengeReason = null;
            learnedFlags = { use_browser_scraper: true, use_proxy_browser: true };
            extractionSteps.push(`Scraper | Fallback | Remote Success with Proxy. Learned use_browser_scraper = true, use_proxy_browser = true.`);
            return { html, $, challengeReason: null, learnedFlags };
          }
        } catch (proxyErr) {
          const proxyMessage = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
          logger.warn(`Scraper | Fallback | Remote with proxy failed: ${proxyMessage}`, 'Scraper');
        }
      }

      // Plain HTTP was blocked (triggering fallback), so this domain requires the browser scraper.
      learnedFlags = { use_browser_scraper: true };
      
      return { html, $, challengeReason: finalChallengeReason, learnedFlags };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error(`Scraper | Fallback | Remote failed for ${domain}: ${errMsg}`, 'Scraper', { product_id: productId, error: e });
      extractionSteps.push(`Scraper | Fallback | Remote Failed: ${errMsg}`);
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
        learnedFlags = { use_browser_scraper: true };
        return { html, $, challengeReason: finalChallengeReason, learnedFlags };
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error(`Scraper | Fallback | Local failed for ${domain}: ${errMsg}`, 'Scraper', { product_id: productId, error: e });
      extractionSteps.push(`Scraper | Fallback | Local Failed: ${errMsg}`);
    }
  }

  return null;
}
