import { CheerioAPI } from 'cheerio';
import { ExtractionCandidate } from '../../../../types/scraper';
import { logger } from '../../../../utils/system/logger';
import { parseSelector } from '../../core';

/**
 * Extracts metadata using CSS selectors.
 */
export function extractFromSelectors(
  $: CheerioAPI, 
  selectors: string[], 
  methodLabel: string
): { name: string | null, candidate?: ExtractionCandidate } {
  for (const s of selectors) {
    try {
      const { realSelector, method, attribute } = parseSelector(s);
      const el = $(realSelector).first();
      let val = null;
      
      if (method === 'text') val = el.text().trim();
      else if (method === 'attr' && attribute) val = el.attr(attribute);
      else if (method === 'html') val = el.html();

      if (val) {
        logger.debug(`Scraper | Identify | Retailer Name match [${s}] (${methodLabel}): ${val}`, 'Scraper');
        return { 
          name: val, 
          candidate: { value: val, method: methodLabel, selector: s, confidence: 1.0 } 
        };
      }
    } catch (e) {}
  }
  return { name: null };
}
