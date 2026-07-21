import { CheerioAPI } from 'cheerio';

/**
 * Removes noisy elements and prunes non-semantic attributes.
 */
export function cleanHtml($: CheerioAPI): void {
  // Clone and preserve all JSON-LD blocks before pruning layout elements
  const jsonLdBlocks: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    jsonLdBlocks.push($(el).clone());
  });

  // 1. Remove noisy non-content elements (excluding json-ld scripts, and prune base64/inline images)
  $('script:not([type="application/ld+json"]), style, noscript, iframe, svg, path, link, comment, img[src^="data:"]').remove();

  // 2. Remove layout, navigation, and boilerplate tags to reduce size
  $('header, footer, nav, aside, [role="navigation"], .header, #header, .footer, #footer, #nav, .nav, .menu, #menu, .navigation, #navigation, .header-container, .footer-container, .nav-container, .menu-container').remove();

  // Re-append the cloned JSON-LD blocks to the body so they remain in the pruned DOM
  const body = $('body');
  for (const block of jsonLdBlocks) {
    body.append(block);
  }

  // 2b. Remove product-noise containers (related, upsell, carousel, breadcrumbs, reviews)
  const noiseContainerPatterns = [
    '[class*="related" i]',
    '[class*="recommend" i]',
    '[class*="upsell" i]',
    '[class*="cross-sell" i]',
    '[class*="crosssell" i]',
    '[class*="crosssell" i]', // Matches camelCase CrossSell
    '[class*="carousel" i]',
    '[class*="sidebar" i]',
    '[class*="breadcrumb" i]',
    '[class*="review" i]',
    '[class*="rating" i]',
    '[class*="sponsored" i]',
    '[class*="advertisement" i]',
    '[class*="social" i]',
    '[class*="share" i]',
    '[class*="recently-viewed" i]',
    '[class*="disclaimer" i]',
    '[class*="footer" i]',
    '[id*="sponsored-products" i]',
    '[id*="sp_detail" i]',
    '[id*="customer-reviews" i]',
    '[id*="reviews-medley" i]',
    '[id*="frequently-bought" i]',
    '[id*="sims-consolidated" i]',
    '[id*="wayfinding-breadcrumbs" i]',
    '[id*="dp-ads-" i]',
  ].join(', ');
  $(noiseContainerPatterns).remove();

  // 3. Prune non-semantic attributes

  $('*').each((_, el) => {
    if (el.type === 'tag') {
      const attribs = el.attribs;
      const allowedAttrs = [
        'id', 'class', 'itemprop', 'data-testid', 'data-price', 'data-price-amount', 
        'data-product-price', 'href', 'src', 'content', 'property', 'name'
      ];
      
      for (const attr in attribs) {
        const lowerAttr = attr.toLowerCase();
        const value = attribs[attr];
        
        const isShortData = lowerAttr.startsWith('data-') && value.length < 50;
        const hasPriceKeyword = lowerAttr.includes('price');
        
        if (!allowedAttrs.includes(lowerAttr) && !isShortData && !hasPriceKeyword) {
          $(el).removeAttr(attr);
        }
      }
    }
  });
}

/**
 * Focuses the HTML on product-related sections.
 */
export function focusProductSections($: CheerioAPI, rawHtml: string): string {
  const productSelectors = [
    '[itemtype*="Product"]',
    '[class*="product-detail" i]',
    '[class*="productDetail" i]',
    '[class*="pdp-" i]',
    '[id*="product" i]',
    'main',
    '[role="main"]',
  ];

  for (const selector of productSelectors) {
    const section = $(selector).first();
    if (section.length && section.html() && section.html()!.length > 500) {
      return section.html()!;
    }
  }

  return $('body').html() || rawHtml;
}

/**
 * Performs final structural whitespace minification.
 */
export function minifyHtml(html: string): string {
  return html
    .replace(/[ \t]+/g, ' ')               // Collapse horizontal whitespace
    .replace(/>\s+</g, '>\n<')             // Add newlines between tags
    .replace(/\n{2,}/g, '\n')              // Collapse multiple newlines
    .trim();
}
