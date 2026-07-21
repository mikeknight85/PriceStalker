import { type CheerioAPI } from 'cheerio';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { RetailerConfig } from '../../../models';
import { settingsCache } from '../../../utils/cache';
import { extractRetailerName } from '../extractors/metadata';
import { extractMetaWithCandidates, findInJsonLd, evaluateMetadataSelectors } from './utils';

export async function extractProductTitle(
  $: CheerioAPI,
  domainConfig: RetailerConfig | undefined,
  extractionSteps: string[],
  result: ScrapedProductWithVoting
): Promise<void> {
  const siteSelectors = domainConfig?.name_selectors || [];
  const genericSelectors = await settingsCache.getNameSelectors() || [];
  
  let candidates = evaluateMetadataSelectors($, siteSelectors, genericSelectors, extractionSteps, 'Title', result.html || undefined);
  
  result.nameCandidates = candidates;

  const settings = await settingsCache.getAISettings();
  const jsonLdNameKey = domainConfig?.jsonld_name_key || settings?.jsonld_name_key || 'name';

  // Check JSON-LD
  findInJsonLd($, 'Product', (obj) => {
    const val = obj[jsonLdNameKey];
    if (val && typeof val === 'string') {
      result.nameCandidates?.push({ value: val.trim(), method: 'json-ld', confidence: 0.99 });
    }
  });

  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) result.nameCandidates.push({ value: ogTitle, method: 'og:title', confidence: 0.8 });
  const pageTitle = $('title').text().trim();
  if (pageTitle) result.nameCandidates.push({ value: pageTitle, method: 'title', confidence: 0.7 });

  // Deduplication & Priority Sorting
  if (result.nameCandidates.length > 0) {
    const seen = new Set();
    result.nameCandidates = result.nameCandidates
      .sort((a, b) => b.confidence - a.confidence)
      .filter(c => {
        const val = String(c.value || '').trim();
        if (!val || seen.has(val.toLowerCase())) return false;
        seen.add(val.toLowerCase());
        return true;
      });
    
    extractionSteps.push(`Extract | Title | Found ${result.nameCandidates.length} unique candidates`);
  }

  if (!result.name) {
    const bestCandidate = result.nameCandidates?.[0];
    const rawName = String(bestCandidate?.value || pageTitle || '');
    
    const retailerResult = await extractRetailerName($, domainConfig || undefined);
    result.retailerName = retailerResult.name;
    result.retailerNameCandidates = retailerResult.candidates;
    const retailerName = retailerResult.name;
    
    if (rawName && retailerName) {
      const separators = [' | ', ' - ', ' — '];
      for (const sep of separators) {
        if (rawName.includes(sep)) {
          const parts = rawName.split(sep);
          if (parts[parts.length - 1].toLowerCase().includes(retailerName.toLowerCase())) {
            parts.pop();
            result.name = parts.join(sep).trim();
            break;
          } else if (parts[0].toLowerCase().includes(retailerName.toLowerCase())) {
            parts.shift();
            result.name = parts.join(sep).trim();
            break;
          }
        }
      }
    }
    if (!result.name) result.name = rawName;
  }
}
