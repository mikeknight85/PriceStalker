import { ParsedPrice } from '../../../utils/scraping/priceParser';
import { StockStatus } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { extractJson } from './base';

export interface AIVerificationResult {
  isCorrect: boolean;
  confidence: number;
  suggestedPrice: ParsedPrice | null;
  reason: string;
  stockStatus?: StockStatus;
}

/**
 * Parses the raw AI response into a standardized verification result.
 */
export function parseVerificationResponse(
  responseText: string,
  currencyContext?: string,
  productId?: number
): AIVerificationResult {
  try {
    const data = extractJson(responseText);
    
    let suggestedPrice: ParsedPrice | null = null;
    if (data.suggestedPrice !== undefined && data.suggestedPrice !== null) {
      suggestedPrice = {
        price: Number(data.suggestedPrice),
        currency: data.suggestedCurrency || currencyContext || 'USD'
      };
    }

    return {
      isCorrect: !!data.isCorrect,
      confidence: data.confidence || 0,
      suggestedPrice,
      reason: data.reason || 'No reason provided',
      stockStatus: data.stockStatus
    };
  } catch (error) {
    logger.error('AI | Parse Error | Verification', 'AI', { product_id: productId, error, response: responseText.slice(0, 500) });
    return { isCorrect: false, confidence: 0, suggestedPrice: null, reason: 'Failed to parse AI response' };
  }
}
