import { CheerioAPI } from 'cheerio';
import { parseSelector } from '../metadata';
import type { StockCandidate } from './index';

/**
 * Checks for pre-order status using high-confidence price selectors.
 */
export function checkPreOrderPriceSelectors(
  $: CheerioAPI,
  preOrderPriceSelectors: string[]
): StockCandidate[] {
  const candidates: StockCandidate[] = [];
  if (preOrderPriceSelectors.length === 0) return candidates;
  
  for (const s of preOrderPriceSelectors) {
    try {
      const { realSelector } = parseSelector(s);
      if ($(realSelector).length > 0) {
        candidates.push({
          value: 'pre_order',
          method: 'pre-order-price-selector',
          selector: s,
          confidence: 0.96
        });
      }
    } catch (e) {}
  }
  return candidates;
}
