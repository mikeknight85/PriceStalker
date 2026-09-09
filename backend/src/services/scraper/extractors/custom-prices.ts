import { CheerioAPI } from 'cheerio';
import { logger } from '../../../utils/system/logger';
import { PriceCandidate } from '../../../types/scraper';
import { parsePrice } from '../../../utils/scraping/priceParser';
import { parseSelector, isNoiseElement } from './metadata';
import { extractByRegex } from './price-extraction';
import { evaluatePriceSelectors } from './price-utils';

/**
 * Extracts price candidates using site-specific selectors (CSS or Regex).
 */
export function extractCustomCandidates($: CheerioAPI, selectors: string[], html?: string, currencyHint?: string, localeHint?: string): PriceCandidate[] {
  if (!selectors || selectors.length === 0) return [];

  return evaluatePriceSelectors(
    $, 
    selectors, 
    'custom-css', 
    0.9, 
    currencyHint, 
    localeHint, 
    // Bounded (issue #169). 0 means unlimited, so a broad custom selector --
    // `.price` on a page that lists related items -- could put hundreds of
    // candidates into consensus and drown the real one.
    //
    // 40 rather than the 20 proposed: it matches what generic extraction
    // already uses, so this is not tighter than a bound the codebase has been
    // running successfully, while still stopping the flood.
    40,
    false,
    html
  );
}
