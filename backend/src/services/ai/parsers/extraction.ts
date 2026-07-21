import { ParsedPrice } from '../../../utils/scraping/priceParser';
import { StockStatus } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { extractJson } from './base';

export interface AIExtractionResult {
  name: string | null;
  price: ParsedPrice | null;
  imageUrl: string | null;
  stockStatus: StockStatus;
  confidence: number;
  selectors?: { name: string; price: string; image: string } | null;
}

/**
 * Parses the raw AI response into a standardized extraction result.
 */
export function parseAIResponse(responseText: string, productId?: number): AIExtractionResult {
  try {
    const data = extractJson(responseText);
    
    // Normalize stock status
    let stockStatus: StockStatus = 'unknown';
    if (data.stockStatus) {
      const s = data.stockStatus.toLowerCase();
      if (s.includes('in_stock') || s.includes('instock')) stockStatus = 'in_stock';
      else if (s.includes('out_of_stock') || s.includes('outofstock')) stockStatus = 'out_of_stock';
    }

    return {
      name: data.name || null,
      price: data.price ? { price: data.price, currency: data.currency || 'USD' } : null,
      imageUrl: data.imageUrl || null,
      stockStatus,
      confidence: data.confidence || 0,
      selectors: data.selectors || null
    };
  } catch (error) {
    logger.error('AI | Parse Error | Extraction', 'AI', { product_id: productId, error, response: responseText.slice(0, 500) });
    return { name: null, price: null, imageUrl: null, stockStatus: 'unknown', confidence: 0 };
  }
}
