import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import {
  fetchRemoteHtml,
  PageNotAvailableError,
  resolveUserAgent
} from '../transport';
import { RetailerConfig } from '../../../models';

/**
 * What the browser-scraper service is asked for.
 *
 * Typed here rather than passed as an untyped bag so a field cannot be
 * misspelled into silence -- which is how the User-Agent went missing on this
 * path in the first place.
 */
export interface RemoteScraperOptions {
  productId?: number;
  isDiscovery: boolean;
  requestId?: string;
  userAgent: string;
  useProxy?: boolean;
  proxyUrl?: string;
  referrer?: string;
  challengePatterns?: string[];
  delay?: number;
  /**
   * The *total* budget for the scrape, not just `page.goto`. The scraper
   * service splits it across navigation and the post-navigation phase (human
   * actions, hydration delay, challenge auto-resolve, screenshot), so this
   * number is what `transport/remote.ts` sizes its own request timeout against.
   */
  timeout?: number;
  /** Per-attempt wait while a challenge interstitial auto-resolves (issue #235). */
  interstitialWaitMs?: number;
  /** How many auto-resolve attempts to make before returning the wall (issue #235). */
  interstitialRetries?: number;
}

export interface RemoteAcquisitionOptions {
  url: string;
  domain: string;
  domainConfig?: RetailerConfig;
  productId?: number;
  extractionSteps: string[];
  requestId?: string;
}

/**
 * Asks the browser-scraper service for the page.
 *
 * Returns `null` — and only `null` — when the remote scraper is **not
 * configured on this install**. The remote scraper is optional (see
 * `CLAUDE.md` and `docs/developer/SCRAPER_LIFECYCLE.md`), so a missing
 * `remote_scraper_url` is a configuration gap, not a scrape failure: the
 * caller degrades to plain HTTP rather than failing every scrape for the
 * domain forever. A remote scraper that *is* configured and then fails throws,
 * because silently serving HTTP to a retailer that was flagged as needing a
 * browser is how a BLOCKED page gets mistaken for a product page.
 */
export async function acquireRemoteHtml(options: RemoteAcquisitionOptions): Promise<string | null> {
  const { url, domain, domainConfig, productId, extractionSteps, requestId } = options;
  
  const rsUrl = await settingsCache.getRemoteScraperUrl();
  if (!rsUrl) {
    extractionSteps.push(`Scraper | Remote | URL not configured, falling back to HTTP`);
    logger.warn(`Scraper | Remote | Enabled for ${domain} but remote_scraper_url is not configured. Falling back to HTTP.`, 'Scraper');
    return null;
  }

  try {
    const useProxy = domainConfig?.use_proxy || false;

    logger.info(`Scraper | Remote | Requesting ${domain} (Browser: true)`, 'Scraper');
    extractionSteps.push(`Scraper | Remote | Requesting via ${rsUrl}`);
    
    const isDiscovery = !productId;
    const currentProxy = useProxy ? await settingsCache.getScraperProxy() : undefined;

    // Always resolve a User-Agent, never only the retailer's override (issue
    // #67). This branch used to set one *only* when the retailer had an
    // override, with no fall-through to `resolveUserAgent()` -- which
    // `acquisition/fallback.ts` has always done. So a `use_browser_scraper`
    // retailer with no override sent none, the scraper service passed no
    // `--user-agent` to Chromium, and the page went out announcing whichever
    // Chromium build happens to be in the container image.
    //
    // The stealth plugin does rewrite `HeadlessChrome/` to `Chrome/`, so this
    // is not the difference between announcing headless and not. What it fixes
    // is the identity drifting between the two paths for one retailer: the
    // HTTP attempt announces the configured Chrome, and the browser attempt
    // announced the container's Chromium version, on its own platform, with
    // client hints derived from that. Presenting two different browsers for one
    // product is the same fault as presenting two different versions in one
    // request -- see transport/user-agent.ts.
    const remoteOptions: RemoteScraperOptions = {
      productId,
      isDiscovery,
      requestId,
      userAgent: await resolveUserAgent(domainConfig?.user_agent),
      challengePatterns: await settingsCache.getGenericChallengePhrases(),
      delay: await settingsCache.getBrowserDelay(),
      timeout: await settingsCache.getBrowserTimeout(),
    };

    if (currentProxy) {
      remoteOptions.useProxy = true;
      remoteOptions.proxyUrl = currentProxy;
    }

    // Referrer policy: retailer config, then the system default, then none —
    // never a fabricated random one (issue #44).
    if (domainConfig?.referrer) {
      remoteOptions.referrer = domainConfig.referrer;
    } else {
      const defaultReferrer = await settingsCache.getDefaultReferrer();
      if (defaultReferrer) remoteOptions.referrer = defaultReferrer;
    }
    
    // "Custom" now means the retailer's own override; the resolved system
    // default is no longer indistinguishable from sending nothing at all.
    logger.debug(`Scraper | Remote | Details | UA: ${remoteOptions.userAgent}, Proxy: ${remoteOptions.proxyUrl || 'None'}, Ref: ${remoteOptions.referrer || 'None'}`, 'Scraper');
    extractionSteps.push(`Scraper | Remote | UA: ${domainConfig?.user_agent ? 'Custom' : 'Default'} | Proxy: ${remoteOptions.proxyUrl ? 'Yes' : 'No'}`);
    
    const html = await fetchRemoteHtml(url, rsUrl, remoteOptions);
    extractionSteps.push(`Scraper | Remote | Success`);
    return html;
  } catch (e) {
    if (e instanceof PageNotAvailableError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    extractionSteps.push(`Scraper | Remote | Failed: ${message}`);
    // This function only ever runs for a retailer whose config says
    // `use_browser_scraper`, so there is no HTTP path to fall back to: a
    // configured-but-failing browser scraper is a hard failure, never a quiet
    // downgrade. (`null` is reserved for "not configured at all", above.)
    logger.warn(`Scraper | Remote | Failed for ${domain} (Browser required): ${message}`, 'Scraper');
    throw e;
  }
}
