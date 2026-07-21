import { type CheerioAPI } from 'cheerio';
import { RetailerConfig } from '../../../models';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { resolveScrapeContext } from '../context';
import { extractAllPriceCandidates } from '../prices';
import { extractMetadata } from '../metadata';
import { denoiseDomForExtraction } from '../extractors/dom-denoiser';
import { settingsCache } from '../../../utils/cache';

export interface ExtractionOptions {
  url: string;
  userId?: number;
  html: string;
  $: CheerioAPI;
  domainConfig: RetailerConfig | null;
  currencyHint: string | null;
  localeHint: string;
  extractionSteps: string[];
}

export async function runExtractionPhase(
  options: ExtractionOptions,
  result: ScrapedProductWithVoting
): Promise<{ currencyHint: string | null; localeHint: string }> {
  const { url, userId, html, $, domainConfig, extractionSteps } = options;
  let { currencyHint, localeHint } = options;

  // Re-resolve locale and currency with HTML content
  const reResolved = await resolveScrapeContext(url, userId, html, domainConfig?.currency_hint || undefined);
  currencyHint = domainConfig?.currency_hint || reResolved.currency;
  localeHint = reResolved.locale;
  
  if (localeHint !== options.localeHint) {
    extractionSteps.push(`Context | Locale | Updated from HTML: ${localeHint}`);
  }

  // Pre-extraction DOM denoising
  try {
    const rawNodes = $('*').length;
    
    // Fetch global selectors for preservation and exclusion
    const [priceS, stockS, nameS, imageS, exclusionS] = await Promise.all([
      settingsCache.getPriceSelectors(),
      settingsCache.getGenericStockSelectors(),
      settingsCache.getNameSelectors(),
      settingsCache.getImageSelectors(),
      settingsCache.getGenericExclusionSelectors()
    ]);
    const globalSelectors = [...priceS, ...stockS, ...nameS, ...imageS];

    denoiseDomForExtraction($, domainConfig || undefined, globalSelectors, exclusionS);
    const cleanNodes = $('*').length;
    extractionSteps.push(`HTML | Denoise | Cleaned DOM nodes: ${rawNodes} -> ${cleanNodes} (${Math.round((1 - cleanNodes / rawNodes) * 100)}% pruned)`);
  } catch (err: any) {
    extractionSteps.push(`HTML | Denoise | Error during clean: ${err.message}`);
  }

  // 1. Metadata (Name, Image, Stock) first
  await extractMetadata($, domainConfig || undefined, extractionSteps, result);

  // 2. Extract Price Candidates
  extractionSteps.push(`HTML | Metadata | Length: ${html.length} chars`);
  const allCandidates = await extractAllPriceCandidates(
    $, 
    html, 
    domainConfig || undefined, 
    currencyHint || undefined, 
    localeHint, 
    extractionSteps
  );
  result.priceCandidates = allCandidates;

  return { currencyHint, localeHint };
}
