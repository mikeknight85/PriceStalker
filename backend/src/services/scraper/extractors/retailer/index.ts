import { CheerioAPI } from 'cheerio';
import { logger } from '../../../../utils/system/logger';
import { ExtractionCandidate } from '../../../../types/scraper';
import { RetailerConfig } from '../../../../models';
import { settingsCache } from '../../../../utils/cache';
import { formatDomainAsRetailer } from '../../core';
import { extractFromSelectors } from './selectors';
import { extractRetailerFromJsonLd } from './jsonld';

/**
 * Extracts the retailer name from the page using various heuristics and configurations.
 */
export async function extractRetailerName(
  $: CheerioAPI, 
  domainConfig?: Partial<RetailerConfig>
): Promise<{ name: string | null, candidates: ExtractionCandidate[] }> {
  const candidates: ExtractionCandidate[] = [];
  let finalName: string | null = null;

  // 0. Use Configured Name if Available
  if (domainConfig?.name) {
    candidates.push({ value: domainConfig.name, method: 'config-name', confidence: 1.0 });
    finalName = domainConfig.name;
  }

  // 1. Try Site-Specific Retailer Name Selectors
  if (!finalName && domainConfig?.retailer_name_selectors?.length) {
    const { name, candidate } = extractFromSelectors($, domainConfig.retailer_name_selectors, 'site-specific');
    if (name) {
      finalName = name;
      candidates.push(candidate!);
    }
  }

  // 2. Try Generic Retailer Name Selectors from DB
  if (!finalName) {
    const genericSelectors = await settingsCache.getRetailerNameSelectors();
    if (genericSelectors.length > 0) {
      const { name, candidate } = extractFromSelectors($, genericSelectors, 'generic');
      if (name) {
        finalName = name;
        candidates.push(candidate!);
      }
    }
  }

  // 3. Check JSON-LD Identity
  const jsonLdResult = extractRetailerFromJsonLd($);
  candidates.push(...jsonLdResult.candidates);
  if (!finalName && jsonLdResult.name) {
    finalName = jsonLdResult.name;
  }

  // 4. Open Graph site name (High confidence fallback)
  const ogName = $('meta[property="og:site_name"]').attr('content');
  if (ogName) {
    logger.debug(`Scraper | Identify | Retailer Name match [og:site_name]: ${ogName}`, 'Scraper');
    candidates.push({ value: ogName, method: 'og:site_name', confidence: 0.9 });
    if (!finalName) finalName = ogName.trim();
  }

  // 5. Application name (Fallback)
  const appName = $('meta[name="application-name"]').attr('content');
  if (appName) {
    logger.debug(`Scraper | Identify | Retailer Name match [app-name]: ${appName}`, 'Scraper');
    candidates.push({ value: appName, method: 'app-name', confidence: 0.85 });
    if (!finalName) finalName = appName.trim();
  }

  // 6. Parse from title
  const title = $('title').text().trim();
  const separators = [' | ', ' - ', ' – ', ' — '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      const firstPart = parts[0].trim();
      const lastPart = parts[parts.length - 1].trim();
      
      let candidate = lastPart;
      if (domainConfig?.domain) {
        const formattedDomain = formatDomainAsRetailer(domainConfig.domain).toLowerCase();
        if (firstPart.toLowerCase().includes(formattedDomain) || formattedDomain.includes(firstPart.toLowerCase())) {
          candidate = firstPart;
        }
      }
      
      if (candidate.length > 2 && !/^\d/.test(candidate)) {
        candidates.push({ value: candidate, method: `title (${sep})`, confidence: 0.6 });
        if (!finalName) finalName = candidate;
      }
    }
  }

  // 7. Bulletproof Fallback: Domain Parsing
  if (!finalName && domainConfig?.domain) {
    const fallbackName = formatDomainAsRetailer(domainConfig.domain);
    if (fallbackName) {
      candidates.push({ value: fallbackName, method: 'domain-fallback', confidence: 0.5 });
      finalName = fallbackName;
    }
  }

  return { name: finalName, candidates };
}

export * from './selectors';
export * from './jsonld';
