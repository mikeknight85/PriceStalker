import { CheerioAPI } from 'cheerio';
import { PriceCandidate } from '../../../types/scraper';
import { parsePrice } from '../../../utils/scraping/priceParser';
import { CURRENCY_MAP } from '../../../utils/scraping/price/constants';

/**
 * Extracts multiple string matches from HTML using regex patterns.
 */
export function extractByRegex(html: string, patterns: string[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    try {
      let finalPattern = pattern;
      let flags = 'g';
      if (pattern.startsWith('~') && pattern.endsWith('~')) {
        finalPattern = pattern.substring(1, pattern.length - 1);
      }
      const regex = new RegExp(finalPattern, flags);
      let match;
      while ((match = regex.exec(html)) !== null) {
        results.push(match[1] || match[0]);
      }
    } catch (e) {}
  }
  return results;
}

/**
 * Extracts price candidates from JSON-LD metadata.
 */
export function extractJsonLdCandidates(
  $: CheerioAPI,
  currencyHint?: string,
  jsonLdPriceKey: string = 'price'
): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const findData = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        // Check if the current object itself represents a Price / Offer
        const isOffer = obj.price !== undefined || obj.lowPrice !== undefined || obj[jsonLdPriceKey] !== undefined;
        if (isOffer) {
          const val = obj[jsonLdPriceKey] || obj.price || obj.lowPrice;
          if (val) {
            let currency = obj.priceCurrency || currencyHint || 'USD';
            if (currency === "$") {
              currency = currencyHint || 'USD';
            } else {
              currency = CURRENCY_MAP[currency] || currency;
            }
            
            const p = parsePrice(String(val), currency, undefined);
            if (p && p.price > 0) {
              candidates.push({ 
                price: p.price, 
                currency, 
                method: 'json-ld', 
                confidence: 0.95 
              });
            }
          }
        }

        // Check if it has priceSpecification
        if (obj.priceSpecification) {
          const specs = Array.isArray(obj.priceSpecification) ? obj.priceSpecification : [obj.priceSpecification];
          for (const spec of specs) {
            const specVal = spec[jsonLdPriceKey] || spec.price;
            if (specVal) {
              let currency = spec.priceCurrency || obj.priceCurrency || currencyHint || 'USD';
              if (currency === "$") {
                currency = currencyHint || 'USD';
              } else {
                currency = CURRENCY_MAP[currency] || currency;
              }
              
              const isMember = !!spec.validForMemberTier;
              const method = isMember ? 'member-price' : 'json-ld';
              
              const p = parsePrice(String(specVal), currency, undefined);
              if (p && p.price > 0) {
                candidates.push({
                  price: p.price,
                  currency,
                  method,
                  confidence: 0.95
                });
              }
            }
          }
        }

        // Recurse into all child properties
        if (Array.isArray(obj)) {
          obj.forEach(findData);
        } else {
          for (const key of Object.keys(obj)) {
            if (key !== 'offers' && key !== 'priceSpecification') {
              findData(obj[key]);
            } else if (key === 'offers') {
              const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
              offers.forEach(findData);
            }
          }
        }
      };
      if (Array.isArray(data)) data.forEach(findData); else findData(data);
    } catch (e) {}
  });
  return candidates;
}
