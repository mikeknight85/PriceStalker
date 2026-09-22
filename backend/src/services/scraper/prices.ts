import { type CheerioAPI } from 'cheerio';
import { 
  PriceCandidate, 
  ExtractionMethod 
} from '../../types/scraper';
import { RetailerConfig } from '../../models';
import { settingsCache } from '../../utils/cache';
import { extractCustomCandidates, extractGenericPriceCandidates, extractJsonLdCandidates } from './extractors/prices';
import { logger } from '../../utils/system/logger';

/**
 * Definition of an extraction pass for a specific price type.
 */
interface ExtractionPass {
  name: string;
  method: ExtractionMethod;
  confidence: number;
  getCustomSelectors: (config?: RetailerConfig) => string[];
  getGenericSelectors: () => Promise<string[]>;
}

const EXTRACTION_PASSES: ExtractionPass[] = [
  {
    name: 'Deals',
    method: 'deal-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.deal_price_selectors || [],
    getGenericSelectors: () => settingsCache.getDealPriceSelectors(),
  },
  {
    name: 'Member',
    method: 'member-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.member_price_selectors || [],
    getGenericSelectors: () => settingsCache.getMemberPriceSelectors(),
  },
  {
    name: 'Pre-order',
    method: 'pre-order-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.pre_order_price_selectors || [],
    getGenericSelectors: () => settingsCache.getPreOrderPriceSelectors(),
  },
  {
    name: 'Original',
    method: 'original-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.original_price_selectors || [],
    getGenericSelectors: () => settingsCache.getOriginalPriceSelectors(),
  }
];

/**
 * Records a cascade step to the trace and, at debug level, to the log stream
 * (logging audit L-04).
 *
 * extractionSteps is attached to the final result, so it only becomes visible
 * once a scrape has finished. When a scrape hangs or dies partway, the steps it
 * had reached died with it -- which is precisely when you want them.
 */
function traceStep(extractionSteps: string[], message: string): void {
  extractionSteps.push(message);
  logger.debug(message, 'Extraction');
}

/** Trims, drops empties and removes duplicates, preserving order. */
function cleanSelectors(selectors: string[]): string[] {
  return Array.from(new Set(selectors.map(s => s.trim()))).filter(Boolean);
}

export async function extractAllPriceCandidates(
  $: CheerioAPI,
  html: string,
  domainConfig: RetailerConfig | undefined,
  currencyHint: string | undefined,
  localeHint: string | undefined,
  extractionSteps: string[]
): Promise<PriceCandidate[]> {
  const allCandidates: PriceCandidate[] = [];
  
  // 1. JSON-LD Candidates (Special Handling)
  const settings = await settingsCache.getAISettings();
  const jsonLdPriceKey = domainConfig?.jsonld_price_key || settings?.jsonld_price_key || 'price';
  const jsonLd = extractJsonLdCandidates($, currencyHint || undefined, jsonLdPriceKey);
  if (jsonLd.length > 0) {
    allCandidates.push(...jsonLd);
    traceStep(extractionSteps, `Extract | JSON-LD | Found ${jsonLd.length} candidates`);
  }

  // 2. Main Iterative Passes (Deals, Member, Pre-order, Original)
  //
  // Retailer rules outrank the global defaults, which are fallbacks (issue
  // #159). These two sets used to be merged into one list and evaluated
  // together, which inverted the priority the Extraction Rules page states and
  // the rest of the engine implements: a *global default* could beat a
  // *retailer rule*.
  //
  // It bit hardest on this pass, because a deal-price candidate takes strict
  // priority in findPriceConsensus over any standard price however it was
  // found. On electronic4you.si the seeded default `.special-price .price`
  // matched a stale sale figure and seized that priority from the retailer's
  // own standard-price rule -- and because the offending selector was a global
  // default, clearing the retailer's Deal/Sale rule did not help.
  //
  // The cascade is decided per price type by what is *configured*, not by what
  // matched. An admin who has written a Deal/Sale rule for a retailer owns that
  // price type for it; silently topping their rule up with the defaults when it
  // happens not to match is what produced the reported behaviour, and it also
  // made the rule impossible to reason about -- the same config gave different
  // answers on different products of the same shop.
  for (const pass of EXTRACTION_PASSES) {
    const custom = cleanSelectors(pass.getCustomSelectors(domainConfig));
    const tier = custom.length > 0 ? 'Retailer' : 'Default';
    const selectors = custom.length > 0
      ? custom
      : cleanSelectors(await pass.getGenericSelectors());

    let candidates: PriceCandidate[] = [];
    if (selectors.length > 0) {
      traceStep(extractionSteps, `Extract | ${pass.name} | ${tier} selectors: ${JSON.stringify(selectors)}`);
      candidates = extractCustomCandidates($, selectors, html, currencyHint || undefined, localeHint);
    }

    if (candidates.length > 0) {
      traceStep(extractionSteps, `Extract | ${pass.name} | Found ${candidates.length} candidates`);
      for (const c of candidates) {
        c.method = pass.method;
        c.confidence = pass.confidence;
      }
      allCandidates.push(...candidates);
    }
  }

  // 3. Standard price: the retailer's own rules, or the global defaults when it
  // has none. Same rule as the typed passes above.
  const customSelectors = cleanSelectors(domainConfig?.price_selectors || []);

  if (customSelectors.length > 0) {
    traceStep(extractionSteps, `Extract | Custom | Selectors: ${JSON.stringify(customSelectors)}`);
    const custom = extractCustomCandidates($, customSelectors, html, currencyHint || undefined, localeHint);
    if (custom.length > 0) {
      allCandidates.push(...custom);
      traceStep(extractionSteps, `Extract | Custom | Found ${custom.length} candidates`);
    }
  } else {
    // 4. Generic (Standard)
    const genericSelectors = cleanSelectors(await settingsCache.getPriceSelectors());

    if (genericSelectors.length > 0) {
      traceStep(extractionSteps, `Extract | Generic | Selectors: ${JSON.stringify(genericSelectors)}`);
      const generic = await extractGenericPriceCandidates($, currencyHint || undefined, localeHint, genericSelectors, html);
      if (generic.length > 0) {
        allCandidates.push(...generic);
        traceStep(extractionSteps, `Extract | Generic | Found ${generic.length} candidates`);
      }
    }
  }

  return allCandidates;
}
