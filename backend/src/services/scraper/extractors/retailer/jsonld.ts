import { CheerioAPI } from 'cheerio';
import { ExtractionCandidate } from '../../../../types/scraper';
import { logger } from '../../../../utils/system/logger';

/**
 * Extracts retailer name from JSON-LD metadata.
 */
export function extractRetailerFromJsonLd($: CheerioAPI): { name: string | null, candidates: ExtractionCandidate[] } {
  const candidates: ExtractionCandidate[] = [];
  let firstName: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      
      const findIdentity = (obj: any) => {
        let name = null;
        let method = 'json-ld';
        const type = (obj?.['@type'] || '').toLowerCase();

        if (obj?.publisher?.name) { 
          name = obj.publisher.name; 
          method = 'json-ld (publisher)'; 
        } else if (obj?.author?.name && (type === 'website' || type === 'organization')) { 
          name = obj.author.name; 
          method = 'json-ld (author)'; 
        } else if (type === 'website' && obj?.name) { 
          name = obj.name; 
          method = 'json-ld (website-name)'; 
        } else if (type === 'organization' && obj?.name) {
          name = obj.name;
          method = 'json-ld (organization-name)';
        }
        
        if (name) {
          logger.debug(`Scraper | Identify | Retailer Name match [${method}]: ${name}`, 'Scraper');
          candidates.push({ value: name, method, confidence: 0.95 });
          if (!firstName) firstName = name;
        }
        if (obj?.['@graph']) obj['@graph'].forEach(findIdentity);
      };

      const findBrand = (obj: any) => {
        let name = null;
        let method = 'json-ld';
        if (obj?.['@type'] === 'Product') {
          if (obj?.offers?.seller?.name) { name = obj.offers.seller.name; method = 'json-ld (seller)'; }
          else if (obj?.brand?.name) { name = obj.brand.name; method = 'json-ld (brand)'; }
          else if (obj?.brand && typeof obj.brand === 'string') { name = obj.brand; method = 'json-ld (brand string)'; }
        }
        
        if (name) {
          logger.debug(`Scraper | Identify | Retailer Name match [${method}]: ${name}`, 'Scraper');
          candidates.push({ value: name, method, confidence: 0.7 });
          if (!firstName) firstName = name;
        }
        if (obj?.['@graph']) obj['@graph'].forEach(findBrand);
      };

      if (Array.isArray(data)) {
        data.forEach(findIdentity);
        data.forEach(findBrand);
      } else {
        findIdentity(data);
        findBrand(data);
      }
    } catch (e) {}
  });

  return { name: firstName, candidates };
}
