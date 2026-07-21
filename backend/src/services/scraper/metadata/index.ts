import { type CheerioAPI } from 'cheerio';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { RetailerConfig } from '../../../models';

import { extractProductStock } from './stock';
import { extractProductTitle } from './title';
import { extractProductImage } from './image';

export * from './stock';
export * from './title';
export * from './image';
export * from './utils';

/**
 * Metadata extraction orchestrator.
 */
export async function extractMetadata(
  $: CheerioAPI,
  domainConfig: RetailerConfig | undefined,
  extractionSteps: string[],
  result: ScrapedProductWithVoting
): Promise<void> {
  // 1. Stock Status
  await extractProductStock($, domainConfig, extractionSteps, result);

  // 2. Title (Name)
  await extractProductTitle($, domainConfig, extractionSteps, result);

  // 3. Image
  await extractProductImage($, domainConfig, extractionSteps, result);
}
