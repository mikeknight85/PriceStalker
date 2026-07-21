import { CheerioAPI } from 'cheerio';

/**
 * Extracts price-related JSON-LD scripts.
 */
export function extractPriceJsonLd($: CheerioAPI): string[] {
  const jsonLdScripts: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    const scriptContent = $(el).html();
    if (scriptContent) {
      if (scriptContent.includes('price') ||
          scriptContent.includes('Price') ||
          scriptContent.includes('Product') ||
          scriptContent.includes('Offer')) {
        jsonLdScripts.push(scriptContent);
      }
    }
  });

  return jsonLdScripts;
}
