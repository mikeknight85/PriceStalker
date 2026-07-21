import { type CheerioAPI } from 'cheerio';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { RetailerConfig } from '../../../models';
import { settingsCache } from '../../../utils/cache';
import { extractStock } from '../extractors/stock/index';

export async function extractProductStock(
  $: CheerioAPI,
  domainConfig: RetailerConfig | undefined,
  extractionSteps: string[],
  result: ScrapedProductWithVoting
): Promise<void> {
  const prePhrases = await settingsCache.getGenericPreOrderPhrases();
  const oosPhrases = await settingsCache.getGenericOutOfStockPhrases();
  const isPhrases = await settingsCache.getGenericInStockPhrases();
  const globalStockSelectors = await settingsCache.getGenericStockSelectors(); // Fetched ONCE

  // Run the primary extraction for both final status and candidates
  const { status, candidates } = await extractStock(
    $,
    domainConfig || undefined,
    { pre: prePhrases, oos: oosPhrases, is: isPhrases },
    extractionSteps,
    globalStockSelectors,
    result.html || undefined
  );

  result.stockStatus = status;

  // Deduplicate and filter debug candidates
  if (candidates.length > 0) {
    const seen = new Set();
    result.stockCandidates = candidates
      .filter(c => {
        const key = `${c.value}:${c.method}:${c.selector || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } else {
    result.stockCandidates = [];
  }
}

