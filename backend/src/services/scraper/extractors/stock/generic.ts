import { CheerioAPI } from 'cheerio';
import { StockStatus } from '../../../../types/scraper';
import { RetailerConfig } from '../../../../models';
import { StockCandidate } from './index';

/**
 * Extracts stock status using generic phrases in targeted areas.
 */
export function checkGenericStockPhrases(
  $: CheerioAPI, 
  phrases: { pre: string[], oos: string[], is: string[] },
  domainConfig?: Partial<RetailerConfig>
): StockCandidate | null {
  let targetedArea = $('main, [role="main"], #main, .main-content, .product-detail, .pdp-main, .product-info, [class*="product-page" i], [class*="product-container" i]').first();
  
  if (targetedArea.length === 0) {
    targetedArea = $('body');
  }

  if (targetedArea.length === 0) return null;

  // Clone and prune noise for phrase matching to prevent reading from script/style/json-ld blocks
  const prunedArea = targetedArea.clone();
  prunedArea.find('script, style, noscript').remove();
  const textToSearch = prunedArea.text().toLowerCase();

  const hasAddToCartButton = prunedArea.find('button, a, .btn, .button').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return phrases.is.some((p: string) => text.includes(p.toLowerCase())) && 
           !text.includes('pre-order') && !text.includes('preorder') && 
           !text.includes('out of stock') && !text.includes('sold out');
  }).length > 0;
  
  // Specific generic tokens
  if (textToSearch.includes('schema.org/instock') || textToSearch.includes('add to trolley')) {
    return { value: 'in_stock', method: 'generic-phrases', context: 'instock/trolley', confidence: 0.50 };
  }
  if (textToSearch.includes('schema.org/outofstock')) {
    return { value: 'out_of_stock', method: 'generic-phrases', context: 'outofstock', confidence: 0.50 };
  }
  if (textToSearch.includes('schema.org/preorder')) {
    return { value: 'pre_order', method: 'generic-phrases', context: 'preorder', confidence: 0.50 };
  }

  // Member only check
  const memberPhrases = (domainConfig?.member_only_phrases?.length ? domainConfig.member_only_phrases : []) || [];
  if (memberPhrases.some((p: string) => textToSearch.includes(p.toLowerCase()))) {
    return { value: 'member_only', method: 'generic-phrases', context: 'member-only-phrases', confidence: 0.50 };
  }
  
  // Buy signals / Precedence Check
  // YELLOW MEDIUM: Precedence correction - check preorder & out of stock phrases first, then clearance/sale
  if (phrases.pre.some((p: string) => textToSearch.includes(p.toLowerCase()))) {
    return { value: 'pre_order', method: 'generic-phrases', context: 'generic-pre-phrases', confidence: 0.50 };
  }
  if (phrases.oos.some((p: string) => textToSearch.includes(p.toLowerCase()))) {
    return { value: 'out_of_stock', method: 'generic-phrases', context: 'generic-oos-phrases', confidence: 0.50 };
  }
  
  if (hasAddToCartButton || phrases.is.some((p: string) => textToSearch.includes(p.toLowerCase()))) {
    return { value: 'in_stock', method: 'generic-phrases', context: 'generic-is-phrases', confidence: 0.50 };
  }

  return null;
}
