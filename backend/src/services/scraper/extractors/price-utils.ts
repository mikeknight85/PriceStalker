import { CheerioAPI } from 'cheerio';
import { PriceCandidate } from '../../../types/scraper';
import { parsePrice } from '../../../utils/scraping/priceParser';
import { parseSelector, isNoiseElement } from './metadata';
import { logger } from '../../../utils/system/logger';
import { evaluateSelector } from '../core/engine';

export function evaluatePriceSelectors(
  $: CheerioAPI,
  selectors: string[],
  methodName: string,
  confidence: number,
  currencyHint?: string,
  localeHint?: string,
  limit: number = 0,
  requirePositive: boolean = false,
  html?: string
): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  
  for (const selector of selectors) {
    try {
      const results = evaluateSelector($, html || '', selector);
      
      for (const res of results) {
        if (limit > 0 && candidates.length >= limit) break;
        if (!res.value) continue;

        const p = parsePrice(res.value, currencyHint, localeHint);
        if (p && (!requirePositive || p.price > 0)) {
          candidates.push({ 
            price: p.price, 
            currency: p.currency, 
            method: methodName, 
            selector, 
            context: res.value.substring(0, 50), 
            confidence 
          });
        }
      }
    } catch (e) {
      logger.debug(`${methodName} selector failed: ` + selector, 'Scraper');
    }
    if (limit > 0 && candidates.length >= limit) break;
  }
  return candidates;
}
