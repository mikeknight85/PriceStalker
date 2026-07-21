import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { VERIFICATION_PROMPT } from '../prompts';
import { AIVerificationResult, parseVerificationResponse } from '../parsers';
import { getAIProvider } from '../client';
import { prepareHtmlForAI } from '../html-preprocessor';

/**
 * Verifies a scraped price using AI.
 */
export async function tryAIVerification(
  url: string,
  html: string,
  scrapedPrice: number,
  currency: string,
  userId: number,
  productId?: number
): Promise<AIVerificationResult | null> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!settings?.ai_verification_enabled) return null;

    const provider = getAIProvider(settings);
    const preparedHtml = await prepareHtmlForAI(html, url);
    const prompt = VERIFICATION_PROMPT
      .replace(/\$SCRAPED_PRICE\$/g, scrapedPrice.toString())
      .replace(/\$CURRENCY\$/g, currency) + preparedHtml;

    const response = await provider.generate(prompt, { 
      productId, 
      maxTokens: 512,
      retryLabel: `${settings.ai_provider}-Verify` 
    });

    return parseVerificationResponse(response.text, currency, productId);
  } catch (error) {
    logger.error(`AI | Verification Failed | ${url}`, 'AI', { product_id: productId, error });
    return null;
  }
}
