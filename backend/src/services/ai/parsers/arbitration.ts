import { PriceCandidate } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { extractJson } from './base';

export interface AIArbitrationResult {
  selectedPrice: PriceCandidate | null;
  confidence: number;
  reason: string;
}

/**
 * Parses the raw AI response into a standardized arbitration result.
 */
export function parseArbitrationResponse(
  responseText: string,
  candidates: PriceCandidate[],
  productId?: number
): AIArbitrationResult {
  try {
    const data = extractJson(responseText);
    const index = parseInt(data.selectedIndex);

    return {
      selectedPrice: (!isNaN(index) && candidates[index]) ? candidates[index] : null,
      confidence: data.confidence || 0,
      reason: data.reason || 'No reason provided'
    };
  } catch (error) {
    logger.error('AI | Parse Error | Arbitration', 'AI', { product_id: productId, error, response: responseText.slice(0, 500) });
    return { selectedPrice: null, confidence: 0, reason: 'Failed to parse AI response' };
  }
}
