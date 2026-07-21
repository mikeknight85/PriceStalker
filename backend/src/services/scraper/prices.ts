import { type CheerioAPI } from 'cheerio';
import { 
  PriceCandidate, 
  ExtractionMethod 
} from '../../types/scraper';
import { RetailerConfig } from '../../models';
import { settingsCache } from '../../utils/cache';
import { extractCustomCandidates, extractGenericPriceCandidates, extractJsonLdCandidates } from './extractors/prices';

/**
 * Definition of an extraction pass for a specific price type.
 */
interface ExtractionPass {
  name: string;
  method: ExtractionMethod;
  confidence: number;
  getCustomSelectors: (config?: RetailerConfig) => string[];
  getGenericSelectors: () => Promise<string[]>;
}

const EXTRACTION_PASSES: ExtractionPass[] = [
  {
    name: 'Deals',
    method: 'deal-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.deal_price_selectors || [],
    getGenericSelectors: () => settingsCache.getDealPriceSelectors(),
  },
  {
    name: 'Member',
    method: 'member-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.member_price_selectors || [],
    getGenericSelectors: () => settingsCache.getMemberPriceSelectors(),
  },
  {
    name: 'Pre-order',
    method: 'pre-order-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.pre_order_price_selectors || [],
    getGenericSelectors: () => settingsCache.getPreOrderPriceSelectors(),
  },
  {
    name: 'Original',
    method: 'original-price',
    confidence: 0.95,
    getCustomSelectors: (c) => c?.original_price_selectors || [],
    getGenericSelectors: () => settingsCache.getOriginalPriceSelectors(),
  }
];

export async function extractAllPriceCandidates(
  $: CheerioAPI,
  html: string,
  domainConfig: RetailerConfig | undefined,
  currencyHint: string | undefined,
  localeHint: string | undefined,
  extractionSteps: string[]
): Promise<PriceCandidate[]> {
  const allCandidates: PriceCandidate[] = [];
  
  // 1. JSON-LD Candidates (Special Handling)
  const settings = await settingsCache.getAISettings();
  const jsonLdPriceKey = domainConfig?.jsonld_price_key || settings?.jsonld_price_key || 'price';
  const jsonLd = extractJsonLdCandidates($, currencyHint || undefined, jsonLdPriceKey);
  if (jsonLd.length > 0) {
    allCandidates.push(...jsonLd);
    extractionSteps.push(`Extract | JSON-LD | Found ${jsonLd.length} candidates`);
  }

  // 2. Main Iterative Passes (Deals, Member, Pre-order, Original)
  for (const pass of EXTRACTION_PASSES) {
    const custom = pass.getCustomSelectors(domainConfig);
    const generic = await pass.getGenericSelectors();
    
    const uniqueSelectors = Array.from(new Set([...custom, ...generic].map(s => s.trim()))).filter(Boolean);
    
    if (uniqueSelectors.length > 0) {
      extractionSteps.push(`Extract | ${pass.name} | Selectors: ${JSON.stringify(uniqueSelectors)}`);
      const candidates = extractCustomCandidates($, uniqueSelectors, html, currencyHint || undefined, localeHint);
      
      if (candidates.length > 0) {
        extractionSteps.push(`Extract | ${pass.name} | Found ${candidates.length} candidates`);
        for (const c of candidates) {
          c.method = pass.method;
          c.confidence = pass.confidence;
        }
        allCandidates.push(...candidates);
      }
    }
  }

  // 3. Site-Specific (Standard)
  const customSelectors = domainConfig?.price_selectors || [];
  if (customSelectors.length > 0) {
    extractionSteps.push(`Extract | Custom | Selectors: ${JSON.stringify(customSelectors)}`);
    const custom = extractCustomCandidates($, customSelectors, html, currencyHint || undefined, localeHint);
    if (custom.length > 0) {
      allCandidates.push(...custom);
      extractionSteps.push(`Extract | Custom | Found ${custom.length} candidates`);
    }
  }

  // 4. Generic (Standard)
  const normalizedCustom = new Set(customSelectors.map(s => s.trim().toLowerCase()));
  const genericSelectors = (await settingsCache.getPriceSelectors())
    .filter(s => !normalizedCustom.has(s.trim().toLowerCase()));
    
  if (genericSelectors.length > 0) {
    extractionSteps.push(`Extract | Generic | Selectors: ${JSON.stringify(genericSelectors)}`);
    const generic = await extractGenericPriceCandidates($, currencyHint || undefined, localeHint, genericSelectors, html);
    if (generic.length > 0) {
      allCandidates.push(...generic);
      extractionSteps.push(`Extract | Generic | Found ${generic.length} candidates`);
    }
  }

  return allCandidates;
}
