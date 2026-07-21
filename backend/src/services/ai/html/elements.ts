import { CheerioAPI } from 'cheerio';

/**
 * Specifically extracts price-related elements from the DOM.
 */
export function extractPriceElements($: CheerioAPI, priceSelectors: string[]): string[] {
  const priceElements: string[] = [];
  const priceRegex = /([$£€¥₹]|AUD|USD|GBP|EUR)?\s*\d{1,3}(,\d{3})*(\.\d{2})?/i;
  const uniqueSelectors = Array.from(new Set(priceSelectors));

  for (const selector of uniqueSelectors) {
    try {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        const parent = $(el).parent().text().trim().slice(0, 200);
        if (text && priceRegex.test(text)) {
          priceElements.push(`Price element: "${text}" (context: "${parent.slice(0, 100)}")`);
        }
      });
    } catch (e) {
      // Ignore selector errors
    }
  }

  return priceElements;
}
