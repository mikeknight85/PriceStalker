import { RetailerConfig } from '../../../models';
import { configCache, settingsCache, regionalMappingCache } from '../../../utils/cache';
import { resolveScrapeContext } from '../context';
import { getUrlLookup } from '../../../utils/scraping/urlHelper';

export interface ScrapeSessionContext {
  domain: string;
  lookupDomain: string;
  urlLookup: string;
  domainConfig: RetailerConfig | null;
  globalAiSettings: any;
  finalSkipAiExtraction: boolean;
  finalSkipAiVerification: boolean;
  currencyHint: string | null;
  localeHint: string;
}

export async function initScrapeSession(
  url: string,
  userId?: number,
  skipAiExtraction?: boolean,
  skipAiVerification?: boolean,
  overrideConfig?: Partial<RetailerConfig>
): Promise<ScrapeSessionContext> {
  const urlObj = new URL(url);
  const urlLookup = getUrlLookup(url);
  const domain = urlObj.hostname.replace('www.', '').toLowerCase();
  const lookupDomain = await regionalMappingCache.getLookupDomain(url);
  
  const domainConfig = overrideConfig ? (overrideConfig as RetailerConfig) : await configCache.getConfig(urlLookup);
  const globalAiSettings = await settingsCache.getAISettings();
  
  const finalSkipAiExtraction = skipAiExtraction || !globalAiSettings.ai_enabled;
  const finalSkipAiVerification = skipAiVerification || !globalAiSettings.ai_verification_enabled;

  const context = await resolveScrapeContext(url, userId, undefined, domainConfig?.currency_hint || undefined);
  const currencyHint = domainConfig?.currency_hint || context.currency;
  const localeHint = context.locale;

  return {
    domain,
    lookupDomain,
    urlLookup,
    domainConfig: domainConfig || null,
    globalAiSettings,
    finalSkipAiExtraction,
    finalSkipAiVerification,
    currencyHint,
    localeHint
  };
}
