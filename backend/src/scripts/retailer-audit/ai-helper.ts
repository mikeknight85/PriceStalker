import { scrapeProductWithVoting } from '../../services/scraper';
import { generateRetailerConfig } from '../../services/ai';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs AI-based selector discovery for a given retailer and product.
 */
export async function runAiAudit(
  url: string, 
  productId: number, 
  retailer: any
) {
  try {
    // Scrape the product page HTML using stealth transport (skip AI on first scrape)
    const scraped = await scrapeProductWithVoting(
      url, 
      undefined, 
      undefined, 
      undefined, 
      true, 
      true, 
      retailer, 
      productId
    );

    if (!scraped.html) {
      return { success: false, error: 'Failed to extract HTML content' };
    }

    const generated = await generateRetailerConfig(
      scraped.html, 
      url, 
      retailer.currency_hint || undefined, 
      undefined, 
      productId
    );

    return { success: !!generated, config: generated };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Throttles execution to prevent bot block and AI rate limit.
 */
export async function throttle() {
  console.log(`[AI] Sleeping for 10 seconds to throttle requests...`);
  await sleep(10000);
}
