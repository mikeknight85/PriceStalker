import { CheerioAPI } from 'cheerio';
import { StockStatus } from '../../../../types/scraper';
import { StockCandidate } from './index';

interface ExtractedOffer {
  value: StockStatus;
  url?: string;
  sku?: string;
  seller?: string;
  hasVariantIndicator: boolean;
  context: any;
}

function parseAvailability(val: any): StockStatus | null {
  if (!val) return null;
  const a = String(val).toLowerCase();
  if (a.includes('outofstock') || a.includes('discontinued') || a.includes('soldout')) {
    return 'out_of_stock';
  } else if (a.includes('preorder')) {
    return 'pre_order';
  } else if (
    a.endsWith('/instock') ||
    a.endsWith('/limitedavailability') ||
    a.includes('instock') ||
    a === 'in stock' ||
    a === 'available' ||
    a.endsWith('/onlineonly')
  ) {
    return 'in_stock';
  }
  return null;
}

function extractSeller(o: any): string | undefined {
  if (!o || !o.seller) return undefined;
  if (typeof o.seller === 'string') return o.seller.trim().toLowerCase();
  if (typeof o.seller === 'object' && o.seller.name) return String(o.seller.name).trim().toLowerCase();
  return undefined;
}

function matchesTargetUrl(offerUrl: string | undefined, offerSku: string | undefined, targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl, 'https://dummy.base');
    const targetVariant = target.searchParams.get('variant') || target.searchParams.get('sku') || target.searchParams.get('id');

    if (offerSku && targetVariant && offerSku.toLowerCase() === targetVariant.toLowerCase()) {
      return true;
    }

    if (offerUrl) {
      const offer = new URL(offerUrl, target.origin);
      const offerVariant = offer.searchParams.get('variant') || offer.searchParams.get('sku') || offer.searchParams.get('id');

      if (targetVariant && offerVariant) {
        return targetVariant.toLowerCase() === offerVariant.toLowerCase();
      }

      if (offer.pathname === target.pathname && offer.search && offer.search === target.search) {
        return true;
      }
    }
  } catch {
    if (offerSku && targetUrl.toLowerCase().includes(offerSku.toLowerCase())) {
      return true;
    }
    if (offerUrl && (targetUrl.includes(offerUrl) || offerUrl.includes(targetUrl))) {
      return true;
    }
  }
  return false;
}

/**
 * Checks for stock status using schema.org availability metadata and JSON-LD offers.
 */
export function checkSchemaStock($: CheerioAPI, targetUrl?: string): StockCandidate[] {
  const candidates: StockCandidate[] = [];

  // itemprop availability Check
  const availability = $('[itemprop="availability"]').attr('content') || $('[itemprop="availability"]').attr('href') || '';
  if (availability) {
    const schemaStatus = parseAvailability(availability);
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
  const jsonLdOffers: ExtractedOffer[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      
      /**
       * Depth-limited so a deeply nested graph loses only what is below the
       * limit, rather than everything (issue #166).
       */
      const MAX_DEPTH = 64;
      const walk = (obj: any, depth = 0) => {
        if (!obj || depth > MAX_DEPTH) return;
        
        if (obj.offers) {
          const offersList = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
          for (const o of offersList) {
            if (o && o.availability) {
              const status = parseAvailability(o.availability);
              if (status) {
                const seller = extractSeller(o);
                const hasVariantIndicator = Boolean(
                  o.sku ||
                  (typeof o.url === 'string' && (o.url.includes('variant=') || o.url.includes('sku='))) ||
                  o.itemCondition
                );
                jsonLdOffers.push({
                  value: status,
                  url: typeof o.url === 'string' ? o.url : undefined,
                  sku: typeof o.sku === 'string' || typeof o.sku === 'number' ? String(o.sku) : undefined,
                  seller,
                  hasVariantIndicator,
                  context: o.availability
                });
              }
            }
          }
        } else if (obj['@type'] === 'Offer' && obj.availability) {
          const status = parseAvailability(obj.availability);
          if (status) {
            const seller = extractSeller(obj);
            const hasVariantIndicator = Boolean(
              obj.sku ||
              (typeof obj.url === 'string' && (obj.url.includes('variant=') || obj.url.includes('sku='))) ||
              obj.itemCondition
            );
            jsonLdOffers.push({
              value: status,
              url: typeof obj.url === 'string' ? obj.url : undefined,
              sku: typeof obj.sku === 'string' || typeof obj.sku === 'number' ? String(obj.sku) : undefined,
              seller,
              hasVariantIndicator,
              context: obj.availability
            });
          }
        }

        if (obj['@graph']) {
          if (Array.isArray(obj['@graph'])) obj['@graph'].forEach((n: any) => walk(n, depth + 1));
          else walk(obj['@graph'], depth + 1);
        } else if (Array.isArray(obj)) {
          obj.forEach((n: any) => walk(n, depth + 1));
        } else if (typeof obj === 'object') {
          for (const [key, val] of Object.entries(obj)) {
            // Skip descending into offers if we already processed them on the parent object
            if (key !== 'offers') {
              walk(val, depth + 1);
            }
          }
        }
      };
      walk(data);
    } catch (e) {}
  });

  // Resolve multiple conflicting JSON-LD candidates (issue #169).
  if (jsonLdOffers.length > 0) {
    let resolvedOffer: ExtractedOffer = jsonLdOffers[0];

    if (jsonLdOffers.length > 1) {
      // 1. If targetUrl is provided, prefer the offer/variant explicitly matching the tracked listing
      let matchedByUrl: ExtractedOffer | undefined;
      if (targetUrl) {
        matchedByUrl = jsonLdOffers.find(o => matchesTargetUrl(o.url, o.sku, targetUrl));
      }

      if (matchedByUrl) {
        resolvedOffer = matchedByUrl;
      } else {
        // 2. Check for multiple distinct sellers (marketplace listings)
        const sellerNames = jsonLdOffers.map(o => o.seller).filter((s): s is string => Boolean(s));
        const distinctSellers = new Set(sellerNames);

        if (distinctSellers.size > 1) {
          // Multiple marketplace sellers: primary buybox offer (first offer) takes precedence
          resolvedOffer = jsonLdOffers[0];
        } else {
          // 3. Same seller or no seller info: check if offers are product variants
          const anyHasVariant = jsonLdOffers.some(o => o.hasVariantIndicator);
          if (anyHasVariant) {
            // Variant listing from the same retailer (e.g. Shopify sizes S, M, L):
            // On a base product URL, any available variant means the product can be purchased.
            const inStockVariant = jsonLdOffers.find(o => o.value === 'in_stock');
            const preOrderVariant = jsonLdOffers.find(o => o.value === 'pre_order');
            resolvedOffer = inStockVariant || preOrderVariant || jsonLdOffers[0];
          } else {
            // Non-variant multi-offer: default to primary/buybox offer
            resolvedOffer = jsonLdOffers[0];
          }
        }
      }
    }

    candidates.push({
      value: resolvedOffer.value,
      method: 'json-ld',
      selector: 'json-ld.offers.availability',
      context: resolvedOffer.context,
      confidence: 0.99
    });
  }

  return candidates;
}
