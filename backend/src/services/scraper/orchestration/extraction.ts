import { type CheerioAPI } from 'cheerio';
import { RetailerConfig } from '../../../models';
import { ScrapedProductWithVoting, PriceCandidate } from '../../../types/scraper';
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
  await extractMetadata($, domainConfig || undefined, extractionSteps, result, url);

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
  // Merged, not replaced (issue #166).
  //
  // Phase 4 runs this a second time after AI auto-mapping generates a retailer
  // config. A plain assignment threw away everything the first pass had found
  // -- JSON-LD, generic selectors -- so if the generated config matched fewer
  // elements, or none, consensus then ran on a smaller pool than before the AI
  // was consulted. Auto-mapping could make extraction worse.
  //
  // Deduplicated on what makes a candidate distinct rather than on identity:
  // the same figure found twice by the same selector and method is one piece of
  // evidence, and counting it twice would skew the consensus weighting.
  result.priceCandidates = mergeCandidates(result.priceCandidates, allCandidates);

  return { currencyHint, localeHint };
}


/**
 * Combines two extraction passes, keeping the earlier candidates.
 *
 * Order matters for readability of the trace rather than for correctness --
 * consensus weighs candidates, it does not take the first.
 */
function mergeCandidates(existing: PriceCandidate[] | undefined, found: PriceCandidate[]): PriceCandidate[] {
  if (!existing || existing.length === 0) return found;

  const seen = new Set<string>();
  const merged: PriceCandidate[] = [];
  for (const c of [...existing, ...found]) {
    const key = `${c.price}|${c.currency}|${c.method}|${c.selector ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return merged;
}
