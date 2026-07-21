import { load } from 'cheerio';
import { extractHighValueMeta } from './meta';
import { extractPriceJsonLd } from './jsonld';
import { extractPriceElements } from './elements';
import { extractImageElements } from './image';
import { cleanHtml, focusProductSections, minifyHtml } from './cleaner';
import { aiSelectorService } from '../../domain/retailer/AISelectorService';
import { settingsCache } from '../../../utils/cache';

/**
 * Truncate HTML to fit within token limits while preserving important content.
 */
export async function prepareHtmlForAI(
  html: string,
  urlOrDomain?: string,
  additionalSelectors: string[] = []
): Promise<string> {
  const $ = load(html);

  // 1. Resolve selectors dynamically
  let priceSelectors: string[] = [];
  let imageSelectors: string[] = [];

  if (urlOrDomain) {
    const aiSelectors = await aiSelectorService.getAISelectorsForDomain(urlOrDomain);
    priceSelectors = [...aiSelectors.price, ...additionalSelectors];
    imageSelectors = aiSelectors.image;
  } else {
    priceSelectors = [...await settingsCache.getGenericAIPriceSelectors(), ...additionalSelectors];
    imageSelectors = await settingsCache.getGenericAIImageSelectors();
  }

  // 2. Extract high-signal data BEFORE pruning DOM
  const metaTags = extractHighValueMeta($);
  const jsonLdScripts = extractPriceJsonLd($);
  const priceElements = extractPriceElements($, priceSelectors);
  const imageElements = extractImageElements($, imageSelectors);

  // 3. DOM cleanup
  cleanHtml($);

  // 4. Focus on product areas
  let bodyContent = focusProductSections($, html);

  // 5. Minification
  bodyContent = minifyHtml(bodyContent);

  // 6. Build final content
  let finalContent = '';
  if (jsonLdScripts.length > 0) {
    finalContent += `=== JSON-LD Structured Data ===\n${jsonLdScripts.join('\n')}\n\n`;
  }
  if (metaTags.length > 0) {
    finalContent += `=== Meta Tags ===\n${metaTags.join('\n')}\n\n`;
  }
  if (priceElements.length > 0) {
    finalContent += `=== Price Elements ===\n${priceElements.slice(0, 15).join('\n')}\n\n`;
  }
  if (imageElements.length > 0) {
    finalContent += `=== Image Elements ===\n${imageElements.slice(0, 10).join('\n')}\n\n`;
  }

  // Token limit management
  if (bodyContent.length > 50000) {
    bodyContent = bodyContent.substring(0, 50000) + '\n... [DOM Truncated]';
  }
  finalContent += `=== HTML Content ===\n${bodyContent}`;

  return finalContent;
}

export * from './meta';
export * from './jsonld';
export * from './elements';
export * from './image';
export * from './cleaner';
