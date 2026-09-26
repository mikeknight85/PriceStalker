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
interface RemoteScraperOptions {
  productId?: number;
  isDiscovery: boolean;
  requestId?: string;
  userAgent: string;
  useProxy?: boolean;
  proxyUrl?: string;
  referrer?: string;
}

export interface RemoteAcquisitionOptions {
  url: string;
  domain: string;
  domainConfig?: RetailerConfig;
  productId?: number;
  extractionSteps: string[];
  requestId?: string;
}

export async function acquireRemoteHtml(options: RemoteAcquisitionOptions): Promise<string | null> {
  const { url, domain, domainConfig, productId, extractionSteps, requestId } = options;
  
  const rsUrl = await settingsCache.getRemoteScraperUrl();
  if (!rsUrl) {
    extractionSteps.push(`Scraper | Remote | URL not configured, falling back`);
    logger.warn(`Scraper | Remote | Enabled for ${domain} but remote_scraper_url is not configured.`, 'Scraper');
    return null;
  }

  try {
    const useProxy = domainConfig?.use_proxy || false;
    const useBrowserScraper = domainConfig?.use_browser_scraper || false;
    
    logger.info(`Scraper | Remote | Requesting ${domain} (Browser: ${useBrowserScraper})`, 'Scraper');
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
    extractionSteps.push(`Scraper | Remote | Failed: ${(e as any).message}`);
    logger.warn(`Scraper | Remote | Failed for ${domain}, will fallback: ${(e as any).message}`, 'Scraper');
    return null;
  }
}
