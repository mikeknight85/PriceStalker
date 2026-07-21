import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { STOCK_STATUS_PROMPT } from '../prompts';
import { AIStockStatusResult, parseStockStatusResponse } from '../parsers';
import { getAIProvider } from '../client';
import { prepareHtmlForAI } from '../html-preprocessor';

/**
 * Verifies stock status for variant products.
 */
export async function tryAIStockStatusVerification(
  url: string,
  html: string,
  variantPrice: number,
  currency: string,
  userId: number,
  productId?: number
): Promise<AIStockStatusResult | null> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!settings?.ai_enabled || !settings?.ai_verification_enabled) return null;

    const provider = getAIProvider(settings);
    const preparedHtml = await prepareHtmlForAI(html, url);
    const prompt = STOCK_STATUS_PROMPT
      .replace(/\$VARIANT_PRICE\$/g, variantPrice.toString())
      .replace(/\$CURRENCY\$/g, currency) + preparedHtml;

    const response = await provider.generate(prompt, { 
      productId, 
      maxTokens: 256,
      retryLabel: `${settings.ai_provider}-StockStatus` 
    });

    return parseStockStatusResponse(response.text, productId);
  } catch (error) {
    logger.error(`AI | Stock Check Failed | ${url}`, 'AI', { product_id: productId, error });
    return null;
  }
}
