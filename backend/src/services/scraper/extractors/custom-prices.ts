import { CheerioAPI } from 'cheerio';
import { logger } from '../../../utils/system/logger';
import { PriceCandidate } from '../../../types/scraper';
import { parsePrice } from '../../../utils/scraping/priceParser';
import { parseSelector, isNoiseElement } from './metadata';
import { extractByRegex } from './price-extraction';
import { evaluatePriceSelectors } from './price-utils';
import { denoiseHtmlForRegex } from './dom-denoiser';

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
    0, 
    false,
    html
  );
}
