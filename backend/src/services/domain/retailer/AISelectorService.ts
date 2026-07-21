import { configCache, settingsCache } from '../../../utils/cache';
import { getUrlLookup } from '../../../utils/scraping/urlHelper';

export class AISelectorService {
  /**
   * Retrieves the AI preprocessor selectors (price and image) for a given domain or URL.
   * If domain-specific configs are present under `ai_selectors`, they are used.
   * Otherwise, the service falls back to system settings.
   */
  async getAISelectorsForDomain(domainOrUrl: string): Promise<{ price: string[]; image: string[] }> {
    let config = null;
    try {
      const urlLookup = getUrlLookup(domainOrUrl);
      config = await configCache.getConfig(urlLookup);
    } catch (e) {
      // Let it fallback
    }

    const price = (config?.ai_selectors?.price && Array.isArray(config.ai_selectors.price))
      ? config.ai_selectors.price
      : await settingsCache.getGenericAIPriceSelectors();

    const image = (config?.ai_selectors?.image && Array.isArray(config.ai_selectors.image))
      ? config.ai_selectors.image
      : await settingsCache.getGenericAIImageSelectors();

    return { price, image };
  }
}

export const aiSelectorService = new AISelectorService();
