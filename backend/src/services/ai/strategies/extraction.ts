import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { EXTRACTION_PROMPT } from '../prompts';
import { AIExtractionResult, parseAIResponse } from '../parsers';
import { getAIProvider } from '../client';
import { prepareHtmlForAI } from '../html-preprocessor';
import axios from 'axios';
import { AISettings } from '../../../models';

/**
 * Public API for testing AI extraction via Admin UI.
 */
export async function extractWithAI(
  url: string,
  settings: AISettings
): Promise<AIExtractionResult> {
  const response = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    },
    timeout: 20000,
  });

  const result = await tryAIExtraction(url, response.data, 0);
  if (!result) throw new Error('AI extraction returned no result');
  return result;
}

/**
 * Fallback extraction logic using AI.
 */
export async function tryAIExtraction(
  url: string,
  html: string,
  userId: number,
  productId?: number,
  force: boolean = false
): Promise<AIExtractionResult | null> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!force && !settings?.ai_enabled) return null;

    logger.info(`AI | Extracting | Trying AI for ${url}${force ? ' (Forced)' : ''}`, 'AI', { product_id: productId });

    const provider = getAIProvider(settings);
    const rawHtmlSize = html.length;
    const preparedHtml = await prepareHtmlForAI(html, url);
    logger.info(`AI | HTML Prep | Extraction | Raw: ${rawHtmlSize} chars → Pruned: ${preparedHtml.length} chars (${Math.round((1 - preparedHtml.length / rawHtmlSize) * 100)}% reduction)`, 'AI', { product_id: productId });
    
    const response = await provider.generate(EXTRACTION_PROMPT + preparedHtml, { 
      productId, 
      retryLabel: `${settings.ai_provider}-Extract` 
    });

    return parseAIResponse(response.text, productId);
  } catch (error) {
    logger.error(`AI | Extraction Failed | ${url}`, 'AI', { product_id: productId, error });
    return null;
  }
}
