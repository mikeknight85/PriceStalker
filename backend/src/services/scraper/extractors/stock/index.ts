import { CheerioAPI } from 'cheerio';
import { StockStatus, ExtractionCandidate } from '../../../../types/scraper';
import { RetailerConfig } from '../../../../models';
import { checkPreOrderPriceSelectors } from './pre-order';
import { checkCustomStockSelectors } from './custom';
import { checkSchemaStock } from './schema';
import { checkGenericStockPhrases } from './generic';
import { settingsCache } from '../../../../utils/cache';

export interface StockCandidate extends ExtractionCandidate {
  value: StockStatus;
  method: 'pre-order-price-selector' | 'site-specific' | 'global-selector' | 'schema.org' | 'json-ld' | 'generic-phrases';
}

/**
 * Extracts stock status from a product page using various heuristics and configurations.
 */
export async function extractStock(
  $: CheerioAPI, 
  domainConfig?: Partial<RetailerConfig>,
  phrases?: { pre: string[], oos: string[], is: string[] },
  extractionSteps: string[] = [],
  globalStockSelectors?: string[],
  html: string = ''
): Promise<{ status: StockStatus; candidates: StockCandidate[] }> {
  const candidates: StockCandidate[] = [];

  // 1. Pre-Order Price Selectors (VERY HIGH CONFIDENCE)
  const preOrderPriceCandidates = checkPreOrderPriceSelectors($, domainConfig?.pre_order_price_selectors || []);
  candidates.push(...preOrderPriceCandidates);

  // 2. Custom Stock Selectors (HIGH PRIORITY)
  if (domainConfig?.stock_selectors?.length) {
    const customCandidates = checkCustomStockSelectors($, domainConfig, phrases, false, html);
    candidates.push(...customCandidates);
  }

  // 3. Check schema.org availability and JSON-LD
  const schemaCandidates = checkSchemaStock($);
  candidates.push(...schemaCandidates);

  // 3b. Global System Stock Selectors (New Layer)
  const selectorsToUse = globalStockSelectors || (await settingsCache.getGenericStockSelectors()) || [];
  if (selectorsToUse.length > 0) {
    const globalCandidates = checkCustomStockSelectors($, { stock_selectors: selectorsToUse }, phrases, true, html);
    candidates.push(...globalCandidates);
  }

  // 4. Generic Phrases (Targeted Areas Only)
  if (phrases) {
    const genericCandidate = checkGenericStockPhrases($, phrases, domainConfig);
    if (genericCandidate) {
      candidates.push(genericCandidate);
    }
  }

  // Sort candidates by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Determine final winning status based on highest confidence candidate that is not 'unknown'
  let finalStatus: StockStatus = 'unknown';
  const winner = candidates.find(c => c.value !== 'unknown');
  if (winner) {
    finalStatus = winner.value;
    extractionSteps.push(`Extract | Stock | Match: ${finalStatus} (via ${winner.method}${winner.selector ? `: ${winner.selector}` : ''})`);
  } else {
    extractionSteps.push(`Extract | Stock | Match: Unknown`);
  }

  return { status: finalStatus, candidates };
}

export * from './pre-order';
export * from './custom';
export * from './schema';
export * from './generic';

