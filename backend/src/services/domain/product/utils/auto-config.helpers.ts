import { settingsCache } from '../../../../utils/cache';
import { ScrapedProductWithVoting, PriceCandidate } from '../../../../types/scraper';
import { formatDomainAsRetailer } from '../../../scraper/core';
import { extractRetailerName } from '../../../scraper/extractors/metadata';
import { load } from 'cheerio';
import { RetailerConfig } from '../../../../models';

export async function getAllGenericSelectors(): Promise<Set<string>> {
  const genericPrice = await settingsCache.getPriceSelectors();
  const genericDeal = await settingsCache.getDealPriceSelectors();
  const genericMember = await settingsCache.getMemberPriceSelectors();
  const genericPreOrder = await settingsCache.getPreOrderPriceSelectors();
  const genericAI = await settingsCache.getGenericAIPriceSelectors();
  const rawOriginal = await settingsCache.get('generic_original_price_selectors');
  const genericOriginal = rawOriginal ? JSON.parse(rawOriginal) : [];

  return new Set([
    ...genericPrice,
    ...genericDeal,
    ...genericMember,
    ...genericPreOrder,
    ...genericAI,
    ...genericOriginal
  ].map(s => s.trim().toLowerCase()));
}

export function resolveWinningSelector(
  scrapedData?: ScrapedProductWithVoting,
  manualSelector?: string
): { selector?: string; method?: string } {
  let winningSelector = manualSelector;
  let winningMethod: string | undefined = undefined;

  if (!winningSelector && scrapedData) {
    const candidates = scrapedData.priceCandidates || [];
    // Only search for winning selectors amongst custom/high-confidence methods
    const allowedMethods = ['custom-css', 'deal-price', 'member-price', 'pre-order-price', 'original-price', 'custom-regex'];
    
    const winner = candidates.find(
      (c: PriceCandidate) => 
        scrapedData.price && 
        c.price === scrapedData.price.price && 
        c.method === (scrapedData.selectedMethod || c.method) &&
        allowedMethods.includes(c.method)
    );
    winningSelector = winner?.selector;
    winningMethod = winner?.method;
  }

  return { selector: winningSelector, method: winningMethod };
}

export function cleanSelectorArray(arr: string[], allGenericSelectors: Set<string>): string[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    const norm = s.trim().toLowerCase();
    if (allGenericSelectors.has(norm)) return false;
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

export async function resolveRetailerName(
  domain: string,
  existingConfig?: RetailerConfig | null,
  scrapedData?: ScrapedProductWithVoting,
  html?: string
): Promise<string | null> {
  let autoName = scrapedData?.retailerName || null;
  if (!autoName && html) {
    const $ = load(html);
    const retailerResult = await extractRetailerName($, existingConfig || undefined);
    autoName = retailerResult.name;
  }
  
  const isFallbackName = existingConfig?.name && existingConfig.name === formatDomainAsRetailer(domain);
  return (isFallbackName && autoName) ? autoName : (existingConfig?.name || autoName);
}
