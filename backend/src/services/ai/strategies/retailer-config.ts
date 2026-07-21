import { load } from 'cheerio';
import { RetailerConfig } from '../../../models';
import { currencyCache } from '../../../utils/i18n/currency/cache';
import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { RETAILER_GENERATION_PROMPT } from '../prompts';
import { extractJson } from '../parsers';
import { getAIProvider } from '../client';
import { prepareHtmlForAI } from '../html-preprocessor';

function validateSelector(selector: string, url: string): boolean {
  if (!selector || typeof selector !== 'string') return false;
  const trimmed = selector.trim();
  
  // 1. Rejects bare single-tag selectors like span, div, p
  const bareTagPattern = /^(span|div|p)$/i;
  if (bareTagPattern.test(trimmed)) {
    logger.warn(`AI | Auto-Map | Selector Validation | Rejected bare tag selector "${trimmed}" for ${url}`, 'AI');
    return false;
  }

  // 2. Rejects selectors matching hashed CSS-in-JS patterns
  const hashPattern = /\.(css|sc|styled|styles)-[a-z0-9]{5,10}\b/i;
  if (hashPattern.test(trimmed)) {
    logger.warn(`AI | Auto-Map | Selector Validation | Rejected hashed CSS-in-JS class in "${trimmed}" for ${url}`, 'AI');
    return false;
  }

  // 3. Cheerio syntax check
  try {
    const $ = load('<div></div>');
    $(trimmed);
    return true;
  } catch (err: any) {
    logger.warn(`AI | Auto-Map | Selector Validation | Rejected invalid CSS syntax "${trimmed}" for ${url} | Error: ${err.message}`, 'AI');
    return false;
  }
}

function cleanAndValidateSelectors(selectors: any, url: string): string[] {
  if (!Array.isArray(selectors)) return [];
  return selectors.filter((sel): sel is string => typeof sel === 'string' && validateSelector(sel, url));
}

/**
 * Generates a retailer configuration (selectors) for a new domain.
 */
export async function generateRetailerConfig(
  html: string, 
  url: string, 
  currencyHint?: string, 
  localeHint?: string, 
  productId?: number
): Promise<Partial<RetailerConfig> | null> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!settings?.ai_auto_mapping_enabled) return null;

    logger.info(`AI | Auto-Map | Generating config for ${url}`, 'AI');
    const preparedHtml = await prepareHtmlForAI(html, url);
    
    let prompt = RETAILER_GENERATION_PROMPT;
    if (currencyHint) {
      prompt = `Context: This site appears to use currency ${currencyHint}${localeHint ? ' and locale ' + localeHint : ''}.\n\n` + prompt;
    }
    prompt += preparedHtml;

    const provider = getAIProvider(settings);
    const response = await provider.generate(prompt, { 
      productId, 
      jsonMode: true,
      retryLabel: `${settings.ai_provider}-AutoMap` 
    });

    const data = extractJson(response.text);
    if (!data) {
      logger.warn(`AI | Auto-Map | Failed to parse JSON from AI response for ${url}`, 'AI', { response: response.text });
      return null;
    }
    
    logger.info(`AI | Auto-Map | Data received for ${url}`, 'AI', { 
      retailer_name: data.retailer_name,
      currency: data.currency,
      price_selectors: data.price_selectors,
      deal_selectors: data.deal_price_selectors,
      member_selectors: data.member_price_selectors,
      name_selectors: data.name_selectors,
      image_selectors: data.image_selectors,
      stock_selectors: data.stock_selectors,
      jsonld: {
        name: data.jsonld_name_key,
        price: data.jsonld_price_key,
        image: data.jsonld_image_key
      }
    });

    let finalCurrency = currencyHint || null;
    if (data.currency) {
      const cleanCurrency = data.currency.toUpperCase().trim();
      const globalCurrencies = await currencyCache.getGlobalCurrencies();
      const isValid = globalCurrencies.some(c => c.iso === cleanCurrency);
      if (isValid) {
        finalCurrency = cleanCurrency;
      } else {
        logger.warn(`AI | Auto-Map | Rejected invalid currency code from AI: "${data.currency}" for ${url}. Falling back to hint: ${currencyHint || 'none'}.`, 'AI');
      }
    }

    const resultConfig: Partial<RetailerConfig> = {
      name: data.retailer_name || null,
      currency_hint: finalCurrency,
      name_selectors: cleanAndValidateSelectors(data.name_selectors, url),
      price_selectors: cleanAndValidateSelectors(data.price_selectors, url),
      deal_price_selectors: cleanAndValidateSelectors(data.deal_price_selectors, url),
      member_price_selectors: cleanAndValidateSelectors(data.member_price_selectors, url),
      pre_order_price_selectors: cleanAndValidateSelectors(data.pre_order_price_selectors, url),
      original_price_selectors: cleanAndValidateSelectors(data.original_price_selectors, url),
      image_selectors: cleanAndValidateSelectors(data.image_selectors, url),
      stock_selectors: cleanAndValidateSelectors(data.stock_selectors, url),
      jsonld_name_key: data.jsonld_name_key || null,
      jsonld_price_key: data.jsonld_price_key || null,
      jsonld_image_key: data.jsonld_image_key || null,
      active: true,
    };

    // Quality gate: require at least one valid price selector or a JSON-LD price key
    const hasPriceSelector = resultConfig.price_selectors && resultConfig.price_selectors.length > 0;
    const hasJsonLdPrice = !!resultConfig.jsonld_price_key;
    if (!hasPriceSelector && !hasJsonLdPrice) {
      logger.warn(`AI | Auto-Map | Rejected generated config for ${url} because no valid price selectors or JSON-LD price keys were found after validation.`, 'AI');
      return null;
    }
    
    return resultConfig;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('429') || errorMsg.includes('prepayment credits are depleted')) {
      logger.error(`AI | Auto-Map Failed | Quota/Billing Error (429) | ${url}`, 'AI');
    } else {
      logger.error(`AI | Auto-Map Failed | ${url}`, 'AI', error);
    }
    return null;
  }
}
