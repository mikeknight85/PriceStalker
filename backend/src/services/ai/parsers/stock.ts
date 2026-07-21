import { StockStatus } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { extractJson } from './base';

export interface AIStockStatusResult {
  stockStatus: StockStatus;
  confidence: number;
  reason: string;
}

/**
 * Parses the raw AI response into a standardized stock status result.
 */
export function parseStockStatusResponse(responseText: string, productId?: number): AIStockStatusResult {
  try {
    const data = extractJson(responseText);

    return {
      stockStatus: data.stockStatus || 'unknown',
      confidence: data.confidence || 0,
      reason: data.reason || 'No reason provided'
    };
  } catch (error) {
    logger.error('AI | Parse Error | Stock Status', 'AI', { product_id: productId, error, response: responseText.slice(0, 500) });
    return { stockStatus: 'unknown', confidence: 0, reason: 'Failed to parse AI response' };
  }
}
