import { type CheerioAPI } from 'cheerio';
import { ExtractionCandidate } from '../../../types/scraper';
import { parseSelector } from '../extractors/metadata';
import { evaluateSelector } from '../core/engine';

/**
 * Extracts metadata using a list of selectors and a method label.
 */
export function extractMetaWithCandidates(
  $: CheerioAPI,
  selectors?: string[],
  methodLabel: string = 'site-specific',
  html?: string
) {
  const candidates: ExtractionCandidate[] = [];
  if (!selectors) return { value: null, candidates };
  
  for (const s of selectors) {
    try {
      const results = evaluateSelector($, html || '', s);
      for (const res of results) {
        if (res.value) {
          candidates.push({ value: res.value, method: methodLabel, selector: s, confidence: 1.0 });
        }
      }
    } catch (e) {}
  }
  return { value: candidates[0]?.value || null, candidates };
}

/**
 * Recursively searches JSON-LD object for a specific key and type.
 */
export function findInJsonLd($: CheerioAPI, type: string, extractor: (obj: any) => void) {
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      const walk = (obj: any) => {
        if (!obj) return;
        if (obj['@type'] === type) extractor(obj);
        if (obj['@graph']) {
          if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(walk);
          else walk(obj['@graph']);
        } else if (Array.isArray(obj)) {
          obj.forEach(walk);
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach(walk);
        }
      };
      walk(data);
    } catch (e) {}
  });
}

export function evaluateMetadataSelectors(
  $: CheerioAPI,
  siteSelectors: string[],
  genericSelectors: string[],
  extractionSteps: string[],
  fieldName: string,
  html?: string
): any[] {
  let candidates: any[] = [];
  
  if (siteSelectors.length > 0) {
    const cleanSiteSelectors = Array.from(new Set(siteSelectors.map(s => s.trim()).filter(Boolean)));
    extractionSteps.push(`Extract | ${fieldName} | Evaluating site-specific selectors: ${JSON.stringify(cleanSiteSelectors)}`);
    const siteRes = extractMetaWithCandidates($, cleanSiteSelectors, 'site-specific', html);
    if (siteRes.candidates && siteRes.candidates.length > 0) {
      candidates.push(...siteRes.candidates);
    }
  }
  
  if (candidates.length === 0 && genericSelectors.length > 0) {
    const cleanGenericSelectors = Array.from(new Set(genericSelectors.map(s => s.trim()).filter(Boolean)));
    extractionSteps.push(`Extract | ${fieldName} | Evaluating generic selectors: ${JSON.stringify(cleanGenericSelectors)}`);
    const genericRes = extractMetaWithCandidates($, cleanGenericSelectors, 'generic', html);
    if (genericRes.candidates && genericRes.candidates.length > 0) {
      for (const c of genericRes.candidates) {
        c.confidence = 0.6;
      }
      candidates.push(...genericRes.candidates);
    }
  }
  
  return candidates;
}
