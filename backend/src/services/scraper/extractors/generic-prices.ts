import { CheerioAPI } from 'cheerio';
import { logger } from '../../../utils/system/logger';
import { PriceCandidate } from '../../../types/scraper';
import { parsePrice } from '../../../utils/scraping/priceParser';
import { settingsCache } from '../../../utils/cache';
import { parseSelector, isNoiseElement } from './metadata';
import { evaluatePriceSelectors } from './price-utils';

/**
 * Extracts price candidates using generic price selectors from system settings.
 */
export async function extractGenericPriceCandidates($: CheerioAPI, currencyHint?: string, localeHint?: string, selectors?: string[], html?: string): Promise<PriceCandidate[]> {
  const candidates: PriceCandidate[] = [];
  const finalSelectors = selectors || await settingsCache.getPriceSelectors();

  const results = evaluatePriceSelectors(
    $, 
    finalSelectors, 
    'generic-css', 
    0.6, 
    currencyHint, 
    localeHint, 
    40, 
    true,
    html
  );
  candidates.push(...results);
  return candidates;
}
