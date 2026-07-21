import { CheerioAPI } from 'cheerio';
import { RetailerConfig } from '../../../models/types';
import { parseSelector } from '../core/selectors';

// Target CSS selectors matching structural noise containers
export const NOISE_CONTAINERS = [
  'header', 'footer', 'nav', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  'aside[class*="related" i]', 'section[class*="related" i]', 'div[class*="related-products" i]', 'div[class*="related-items" i]',
  'aside[class*="recommend" i]', 'section[class*="recommend" i]', 'div[class*="recommendations" i]', 'div[class*="recommended-products" i]',
  'aside[class*="upsell" i]', 'section[class*="upsell" i]', 'div[class*="upsell" i]',
  'aside[class*="cross-sell" i]', 'section[class*="cross-sell" i]', 'div[class*="cross-sell" i]',
  'aside[class*="crosssell" i]', 'section[class*="crosssell" i]', 'div[class*="crosssell" i]',
  'aside[class*="carousel" i]', 'section[class*="carousel" i]', 'div[class*="carousel" i]',
  'aside[class*="sidebar" i]', 'div[class*="sidebar" i]',
  'div[class*="breadcrumb" i]', 'nav[class*="breadcrumb" i]',
  'section[class*="review" i]', 'div[class*="reviews" i]', 'div[class*="customer-reviews" i]',
  'div[class*="rating" i]',
  'aside[class*="sponsored" i]', 'section[class*="sponsored" i]', 'div[class*="sponsored" i]',
  'aside[class*="advertisement" i]', 'section[class*="advertisement" i]', 'div[class*="advertisement" i]',
  'div[class*="social" i]', 'div[class*="share" i]',
  'aside[class*="recently-viewed" i]', 'section[class*="recently-viewed" i]', 'div[class*="recently-viewed" i]',
  '[id*="sponsored-products" i]', '[id*="customer-reviews" i]',
  '[id*="frequently-bought" i]', '[id*="dp-ads-" i]',
  'template',
  '[aria-hidden="true"]'
].join(', ');

/**
 * Parses all custom selectors for the given retailer config, runs them against the DOM,
 * and compiles a Set of targeted nodes and all of their ancestors.
 * This guarantees custom selectors never break due to structural noise pruning.
 */
function getPreservedElements($: CheerioAPI, domainConfig?: Partial<RetailerConfig>, globalSelectors: string[] = []): Set<any> {
  const preserved = new Set<any>();
  
  // High-confidence patterns for global selector preservation
  const structuralIndicators = ['[data-', '[itemprop', '[property', '[itemtype'];

  // Compile all possible selector fields
  const customSelectors = [
    ...(domainConfig?.name_selectors || []),
    ...(domainConfig?.retailer_name_selectors || []),
    ...(domainConfig?.price_selectors || []),
    ...(domainConfig?.deal_price_selectors || []),
    ...(domainConfig?.original_price_selectors || []),
    ...(domainConfig?.member_price_selectors || []),
    ...(domainConfig?.image_selectors || []),
    ...(domainConfig?.stock_selectors || []),
    ...(domainConfig?.pre_order_price_selectors || [])
  ];

  // Add global selectors if they match high-confidence structural patterns
  for (const gs of globalSelectors) {
    if (structuralIndicators.some(indicator => gs.toLowerCase().includes(indicator))) {
      customSelectors.push(gs);
    }
  }

  for (const selector of customSelectors) {
    if (!selector || (selector.startsWith('~') && selector.endsWith('~'))) {
      continue; // Skip empty selectors and custom regexes
    }

    try {
      // Parse out the base CSS selector using the system's existing parseSelector utility
      const parsed = parseSelector(selector);
      const baseSelector = parsed.realSelector;
      if (!baseSelector) continue;

      $(baseSelector).each((_, el) => {
        // Add the element itself
        preserved.add(el);
        // Add all ancestors up to the root
        $(el).parents().each((__, parent) => {
          preserved.add(parent);
        });
      });
    } catch (err) {
      // Gracefully ignore selector syntax exceptions
    }
  }

  return preserved;
}

/**
 * In-place Cheerio DOM cleaner. Strips layout/noise elements while keeping attributes,
 * JSON-LD script blocks, and elements targeted by custom configs.
 */
export function denoiseDomForExtraction(
  $: CheerioAPI, 
  domainConfig?: Partial<RetailerConfig>, 
  globalSelectors: string[] = [],
  exclusionSelectors: string[] = []
): void {
  if (domainConfig?.skip_denoising) {
    return; // Safety bypass switch
  }

  // 0. Explicit Exclusion Pruning
  const allExclusions = [...exclusionSelectors, ...(domainConfig?.exclusion_selectors || [])];
  if (allExclusions.length > 0) {
    const combinedExclusionSelector = allExclusions.join(', ');
    try {
      $(combinedExclusionSelector).remove();
    } catch (err) {
      // Ignore invalid selectors
    }
  }

  // 1. Compile the set of elements to preserve
  const preservedElements = getPreservedElements($, domainConfig, globalSelectors);

  // 2. Clone and extract JSON-LD script blocks
  const jsonLdBlocks: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    jsonLdBlocks.push($(el).clone());
  });

  // 3. Remove non-JSON-LD scripts, styles, and noscript blocks
  $('script:not([type="application/ld+json"]), style, noscript').each((_, el) => {
    if (!preservedElements.has(el)) {
      $(el).remove();
    }
  });

  // 4. Remove structural noise containers
  $(NOISE_CONTAINERS).each((_, el) => {
    if (!preservedElements.has(el)) {
      $(el).remove();
    }
  });

  // 5. Re-inject preserved JSON-LD blocks at the bottom of <body>
  const body = $('body');
  if (body.length > 0) {
    for (const block of jsonLdBlocks) {
      body.append(block);
    }
  }
}

/**
 * Strips script and style block tags from raw HTML string before regex evaluation.
 */
export function denoiseHtmlForRegex(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
}
