import { PriceCandidate } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { ARBITRATION_PROMPT } from '../prompts';
import { AIArbitrationResult, parseArbitrationResponse } from '../parsers';
import { getAIProvider } from '../client';
import { prepareHtmlForAI } from '../html-preprocessor';

/**
 * Arbitrates between multiple candidate prices using AI.
 */
export async function tryAIArbitration(
  url: string,
  html: string,
  candidates: PriceCandidate[],
  userId: number,
  productId?: number
): Promise<AIArbitrationResult | null> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!settings?.ai_enabled || !settings?.ai_verification_enabled) return null;
    if (candidates.length < 2) return null;

    logger.info(`AI | Arbitrate | Trying AI arbitration for ${url}`, 'AI', { product_id: productId });

    const provider = getAIProvider(settings);
    const candidatesList = candidates.map((c, i) =>
      `${i}. ${c.price} ${c.currency} (method: ${c.method}, context: ${c.context || 'none'})`
    ).join('\n');

    const additionalSelectors = candidates.map(c => c.selector).filter((s): s is string => !!s);
    const rawHtmlSize = html.length;
    const preparedHtml = await prepareHtmlForAI(html, url, additionalSelectors);
    logger.info(`AI | HTML Prep | Arbitration | Raw: ${rawHtmlSize} chars → Pruned: ${preparedHtml.length} chars (${Math.round((1 - preparedHtml.length / rawHtmlSize) * 100)}% reduction)`, 'AI', { product_id: productId });
    const prompt = ARBITRATION_PROMPT.replace('$CANDIDATES$', candidatesList) + preparedHtml;

    const response = await provider.generate(prompt, { 
      productId, 
      maxTokens: 512,
      retryLabel: `${settings.ai_provider}-Arbitrate` 
    });

    return parseArbitrationResponse(response.text, candidates, productId);
  } catch (error) {
    logger.error(`AI | Arbitrate Failed | ${url}`, 'AI', { product_id: productId, error });
    return null;
  }
}
