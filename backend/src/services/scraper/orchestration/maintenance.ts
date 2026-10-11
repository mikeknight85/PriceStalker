import { logger } from '../../../utils/system/logger';
import { retailerRepository, RetailerConfig } from '../../../models';
import { configCache, settingsCache } from '../../../utils/cache';
import { flagBlockedRetailer, restoreRetailerStatus } from '../retailer-maintenance';
import { ScrapedProductWithVoting } from '../../../types/scraper';

/**
 * Whether persisting `use_browser_scraper` can possibly help.
 *
 * The browser scraper is optional: with no `remote_scraper_url` there is no
 * browser path at all (`fetchBrowserHtml` returns '' without opening one). So
 * writing the flag on such an install does not route the domain anywhere -- it
 * only takes the HTTP attempt away from it, permanently, because nothing ever
 * clears the flag. Gate every write of it on the URL being set.
 */
async function browserScraperIsAvailable(): Promise<boolean> {
  return Boolean(await settingsCache.getRemoteScraperUrl());
}

function autoNameFor(domain: string): string {
  const baseName = domain.split('.')[0];
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

export async function handleRetailerMaintenance(
  domainConfig: RetailerConfig | null,
  challenge: string | null,
  overrideConfig: boolean,
  extractionSteps: string[],
  productId?: number,
  fallbackContext?: { domain: string; learnedFlags?: { use_browser_scraper?: boolean } }
): Promise<RetailerConfig | null> {
  const wantsBrowserScraper = Boolean(fallbackContext?.learnedFlags?.use_browser_scraper);

  if (challenge) {
    logger.info(`Scraper | Block | Persistent challenge: ${challenge}`, 'Scraper', { product_id: productId });
    extractionSteps.push(`Scraper | Block | Persistent: ${challenge}`);
    
    if (domainConfig && !overrideConfig) {
      if (wantsBrowserScraper && !domainConfig.use_browser_scraper && await browserScraperIsAvailable()) {
        domainConfig.use_browser_scraper = true;
      }
      await flagBlockedRetailer(domainConfig, challenge, extractionSteps);
      return domainConfig;
    } else if (!domainConfig && fallbackContext?.domain) {
      const domain = fallbackContext.domain;
      const useBrowserScraper = wantsBrowserScraper && await browserScraperIsAvailable();
      const newConfig: Partial<RetailerConfig> = {
        domain,
        name: autoNameFor(domain),
        status: 'BLOCKED',
        use_browser_scraper: useBrowserScraper,
        description: `Auto-flagged: ${challenge} detected during extraction`,
        active: true
      };
      const created = await retailerRepository.upsert(newConfig);
      configCache.invalidate(domain);
      extractionSteps.push(`Retailer | Config | Auto-created as BLOCKED with Browser Scraper: ${useBrowserScraper}`);
      return created;
    }
  } else if (!domainConfig && fallbackContext?.domain && wantsBrowserScraper) {
    if (!await browserScraperIsAvailable()) {
      // Nothing to learn: the fallback cannot have been a browser, and writing
      // the flag would only cut the domain off from HTTP.
      extractionSteps.push(`Retailer | Config | Browser Scraper not configured, no config auto-created`);
      return domainConfig;
    }
    const domain = fallbackContext.domain;
    const newConfig: Partial<RetailerConfig> = {
      domain,
      name: autoNameFor(domain),
      status: 'OK',
      use_browser_scraper: true,
      description: 'Auto-created: Browser scraper required (fallback triggered)',
      active: true
    };
    const created = await retailerRepository.upsert(newConfig);
    configCache.invalidate(domain);
    extractionSteps.push(`Retailer | Config | Auto-created with Browser Scraper enabled`);
    return created;
  }
  return domainConfig;
}

export async function handleAutoMapping(
  options: {
    html: string;
    url: string;
    domain: string;
    currencyHint: string | null;
    localeHint: string;
    productId?: number;
    extractionSteps: string[];
    learnedFlags: any;
    isRefresh?: boolean;
  }
): Promise<RetailerConfig | null> {
  const { html, url, domain, currencyHint, localeHint, productId, extractionSteps, learnedFlags, isRefresh } = options;
  
  try {
    const logMsg = isRefresh 
      ? `Retailer | Auto-Map | Triggering config refresh/re-mapping for: ${domain}`
      : `Retailer | Auto-Map | Triggering for unknown domain: ${domain}`;
    logger.info(logMsg, 'Scraper', { product_id: productId });
    extractionSteps.push(isRefresh ? `Retailer | Auto-Map | Refresh Triggered` : `Retailer | Auto-Map | Triggered`);
    const { generateRetailerConfig } = await import('../../ai');
    const generatedConfig = await generateRetailerConfig(html, url, currencyHint || undefined, localeHint, productId);
    if (generatedConfig) {
      extractionSteps.push(`Retailer | Auto-Map | Success`);
      
      const upsertData = { 
        ...generatedConfig, 
        ...learnedFlags, 
        domain, 
        active: true, 
        currency_hint: generatedConfig.currency_hint || currencyHint 
      };

      const autoMapTrace: string[] = [
        `Name: ${upsertData.name || 'Unknown'}`,
        `Domain: ${upsertData.domain}`,
        `Currency Hint: ${upsertData.currency_hint || 'None'}`,
        `Engine: ${upsertData.use_browser_scraper ? 'Browser Scraper' : 'Standard (HTTP)'}`
      ];
      if (upsertData.name_selectors?.length > 0) autoMapTrace.push(`Name Selectors: ${JSON.stringify(upsertData.name_selectors)}`);
      if (upsertData.price_selectors?.length > 0) autoMapTrace.push(`Price Selectors: ${JSON.stringify(upsertData.price_selectors)}`);
      if (upsertData.deal_price_selectors?.length > 0) autoMapTrace.push(`Deal Price Selectors: ${JSON.stringify(upsertData.deal_price_selectors)}`);
      if (upsertData.member_price_selectors?.length > 0) autoMapTrace.push(`Member Price Selectors: ${JSON.stringify(upsertData.member_price_selectors)}`);
      if (upsertData.original_price_selectors?.length > 0) autoMapTrace.push(`Original Price Selectors: ${JSON.stringify(upsertData.original_price_selectors)}`);
      if (upsertData.image_selectors?.length > 0) autoMapTrace.push(`Image Selectors: ${JSON.stringify(upsertData.image_selectors)}`);
      if (upsertData.stock_selectors?.length > 0) autoMapTrace.push(`Stock Selectors: ${JSON.stringify(upsertData.stock_selectors)}`);
      
      const jsonldKeys = [];
      if (upsertData.jsonld_name_key) jsonldKeys.push(`name: ${upsertData.jsonld_name_key}`);
      if (upsertData.jsonld_price_key) jsonldKeys.push(`price: ${upsertData.jsonld_price_key}`);
      if (upsertData.jsonld_image_key) jsonldKeys.push(`image: ${upsertData.jsonld_image_key}`);
      if (jsonldKeys.length > 0) {
        autoMapTrace.push(`JSON-LD Keys: { ${jsonldKeys.join(', ')} }`);
      }

      const settingsList = [];
      if (upsertData.use_proxy) settingsList.push('Proxy');
      if (settingsList.length > 0) {
        autoMapTrace.push(`Settings: ${settingsList.join(', ')}`);
      }

      logger.info(`Retailer | Auto-Map | Saving config for ${domain}`, 'Scraper', { 
        product_id: productId,
        trace: autoMapTrace
      });

      const domainConfig = await retailerRepository.upsert(upsertData);
      // Scoped to the domain that changed (issue #169). An argument-less call
      // drops every retailer's config, so one auto-map save made the next
      // scrape of every other domain re-read from the database -- and they all
      // arrive together, because the scheduler batches.
      configCache.invalidate(domain);
      extractionSteps.push(`Retailer | Auto-Map | Saved (Currency Hint: ${currencyHint})`);
      return domainConfig;
    }
  } catch (e) {
    extractionSteps.push(`Retailer | Auto-Map | Failed: ${(e as any).message}`);
  }
  return null;
}

export async function handleRestoreStatus(
  result: ScrapedProductWithVoting,
  domainConfig: RetailerConfig | null,
  overrideConfig: boolean,
  challenge: string | null,
  extractionSteps: string[]
): Promise<void> {
  if (result.price && domainConfig && !overrideConfig && !challenge) {
    await restoreRetailerStatus(domainConfig, extractionSteps);
  }
}
