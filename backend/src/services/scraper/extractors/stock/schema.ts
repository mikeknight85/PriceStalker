import { CheerioAPI } from 'cheerio';
import { StockStatus } from '../../../../types/scraper';
import { StockCandidate } from './index';

/**
 * Checks for stock status using schema.org availability metadata and JSON-LD offers.
 */
export function checkSchemaStock($: CheerioAPI): StockCandidate[] {
  const candidates: StockCandidate[] = [];

  // itemprop availability Check
  const availability = $('[itemprop="availability"]').attr('content') || $('[itemprop="availability"]').attr('href') || '';
  if (availability) {
    const a = availability.toLowerCase();
    let schemaStatus: StockStatus | null = null;
    if (a.includes('outofstock') || a.includes('discontinued') || a.includes('soldout')) {
      schemaStatus = 'out_of_stock';
    } else if (a.includes('preorder')) {
      schemaStatus = 'pre_order';
    } else if (a.endsWith('/instock') || a.endsWith('/limitedavailability') || a.includes('instock') || a === 'in stock' || a === 'available' || a.endsWith('/onlineonly')) {
      schemaStatus = 'in_stock';
    }

    if (schemaStatus) {
      candidates.push({
        value: schemaStatus,
        method: 'schema.org',
        selector: '[itemprop="availability"]',
        context: availability,
        confidence: 0.90
      });
    } else {
      candidates.push({
        value: 'unknown',
        method: 'schema.org',
        selector: '[itemprop="availability"]',
        context: availability,
        confidence: 0.10
      });
    }
  }

  // JSON-LD Availability Check
  const jsonLdCandidates: StockCandidate[] = [];
  
  const extractFromJsonLdAvailability = (val: any, selectorStr: string) => {
    if (!val) return;
    const a = String(val).toLowerCase();
    let schemaStatus: StockStatus | null = null;
    if (a.includes('outofstock') || a.includes('discontinued') || a.includes('soldout')) {
      schemaStatus = 'out_of_stock';
    } else if (a.includes('preorder')) {
      schemaStatus = 'pre_order';
    } else if (a.endsWith('/instock') || a.endsWith('/limitedavailability') || a.includes('instock') || a === 'in stock' || a === 'available' || a.endsWith('/onlineonly')) {
      schemaStatus = 'in_stock';
    }

    if (schemaStatus) {
      jsonLdCandidates.push({
        value: schemaStatus,
        method: 'json-ld',
        selector: selectorStr,
        context: val,
        confidence: 0.99
      });
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      
      /**
       * Depth-limited so a deeply nested graph loses only what is below the
       * limit, rather than everything (issue #166).
       *
       * The recursion had no bound. At around 5,000 levels it threw a
       * RangeError, which the empty catch below swallowed -- so a page with a
       * pathological JSON-LD graph reported no stock information at all, with
       * no error and no log line. Stopping at a depth no real product graph
       * reaches keeps whatever was found above it.
       */
      const MAX_DEPTH = 64;
      const walk = (obj: any, depth = 0) => {
        if (!obj || depth > MAX_DEPTH) return;
        
        if (obj['@type'] === 'Offer' && obj.availability) {
          extractFromJsonLdAvailability(obj.availability, 'json-ld.availability');
        }

        if (obj.offers) {
          const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
          for (const o of offers) {
            if (o.availability) {
              extractFromJsonLdAvailability(o.availability, 'json-ld.offers.availability');
            }
          }
        }

        if (obj['@graph']) {
          if (Array.isArray(obj['@graph'])) obj['@graph'].forEach((n: any) => walk(n, depth + 1));
          else walk(obj['@graph'], depth + 1);
        } else if (Array.isArray(obj)) {
          obj.forEach((n: any) => walk(n, depth + 1));
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach((n: any) => walk(n, depth + 1));
        }
      };
      walk(data);
    } catch (e) {}
  });

  // Resolve multiple conflicting JSON-LD candidates (prefer in_stock > pre_order > out_of_stock)
  if (jsonLdCandidates.length > 0) {
    const hasInStock = jsonLdCandidates.some(c => c.value === 'in_stock');
    const hasPreOrder = jsonLdCandidates.some(c => c.value === 'pre_order');
    const hasOos = jsonLdCandidates.some(c => c.value === 'out_of_stock');
    
    let resolvedValue: StockStatus = 'unknown';
    if (hasInStock) resolvedValue = 'in_stock';
    else if (hasPreOrder) resolvedValue = 'pre_order';
    else if (hasOos) resolvedValue = 'out_of_stock';

    const representative = jsonLdCandidates.find(c => c.value === resolvedValue) || jsonLdCandidates[0];
    candidates.push(representative);
  }

  return candidates;
}
