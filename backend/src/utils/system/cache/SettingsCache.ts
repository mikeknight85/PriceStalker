import { logger } from '../logger';
import type { AISettings } from '../../../models/types/system';

/**
 * Default configuration values for fallback.
 */
const DEFAULT_CONFIG = {
  priceSelectors: ['[itemprop="price"]', '.price', '#price'],
  dealPriceSelectors: ['.price-item--sale', '.special-price', '.sale-price'],
  memberPriceSelectors: ['.member-price', '.perks-price'],
  preOrderPriceSelectors: ['.preorder-price'],
  originalPriceSelectors: ['.rrp', '.was-price', '.price-item--regular', '.old-price', '[class*="original" i]'],
  nameSelectors: ['meta[property="og:title"]::attr(content)', 'meta[name="twitter:title"]::attr(content)', 'h1', '.product-title'],
  retailerNameSelectors: ['meta[property="og:site_name"]::attr(content)', '.retailer-name', '.brand-name'],
  imageSelectors: ['meta[property="og:image"]::attr(content)', 'meta[name="twitter:image"]::attr(content)', '.product-image img::attr(src)', '#main-image::attr(src)'],
  stockSelectors: ['[itemprop="availability"]', '.stock-status', '.availability', '[class*="stock-status" i]', '[class*="availability" i]'],
  exclusionSelectors: [],
  genericInStockPhrases: ['in stock', 'available', 'ready to ship', 'auf lager', 'en stock'],
  genericOutOfStockPhrases: ['out of stock', 'sold out', 'unavailable', 'discontinued', 'nicht lieferbar'],
  genericPreOrderPhrases: ['pre-order', 'preorder', 'coming soon', 'vorbestellen'],
  genericAIPriceSelectors: [
    '[class*="price" i]',
    '[class*="Price" i]',
    '[data-testid*="price" i]',
    '[data-automation*="price" i]',
    '[data-automation*="Price" i]',
    '[itemprop="price"]',
    '[data-price]',
    '[data-price-amount]',
    '[data-product-price]'
  ],
  genericAIImageSelectors: [
    'link[rel="preload"][as="image"]',
    'img#landingImage',
    'img#main-image',
    'img.main-image',
    'img.hero-image',
    'img[class*="product-image" i]',
    'img[class*="product__image" i]',
    'img[class*="gallery" i]',
    'img[data-testid*="image" i]'
  ],
  browserTimeout: 60000,
  browserDelay: 3000,
};

export class SystemSettingsCache {
  private settings: Record<string, string> = {};
  private parsedArrays = new Map<string, string[]>();
  private expiry = 0;
  private readonly TTL = 30 * 60 * 1000;

  async get(key: string): Promise<string | null> {
    await this.refresh();
    return this.settings[key] || null;
  }

  private async refresh(): Promise<void> {
    const now = Date.now();
    if (this.expiry > now) return;

    try {
      const { systemSettingsRepository } = await import('../../../models');
      const settings = await systemSettingsRepository.getAll();
      this.settings = settings;
      this.parsedArrays.clear();
      this.expiry = now + this.TTL;
    } catch (error) {
      logger.warn('Settings Cache | Failed to refresh from database', 'System', error);
    }
  }

  private async getArray(key: string, defaultKey: keyof typeof DEFAULT_CONFIG): Promise<string[]> {
    await this.refresh();
    if (this.parsedArrays.has(key)) return this.parsedArrays.get(key)!;
    
    let result: string[] = (DEFAULT_CONFIG as any)[defaultKey];
    if (this.settings[key]) {
      try {
        result = JSON.parse(this.settings[key]);
      } catch (e) {
        // use default
      }
    }
    this.parsedArrays.set(key, result);
    return result;
  }

  private async getInt(key: string, defaultValue: number): Promise<number> {
    await this.refresh();
    return this.settings[key] ? parseInt(this.settings[key], 10) : defaultValue;
  }

  async getPriceSelectors(): Promise<string[]> { return this.getArray('generic_price_selectors', 'priceSelectors'); }
  async getDealPriceSelectors(): Promise<string[]> { return this.getArray('generic_deal_price_selectors', 'dealPriceSelectors'); }
  async getMemberPriceSelectors(): Promise<string[]> { return this.getArray('generic_member_price_selectors', 'memberPriceSelectors'); }
  async getPreOrderPriceSelectors(): Promise<string[]> { return this.getArray('generic_pre_order_price_selectors', 'preOrderPriceSelectors'); }
  async getOriginalPriceSelectors(): Promise<string[]> { return this.getArray('generic_original_price_selectors', 'originalPriceSelectors'); }
  async getNameSelectors(): Promise<string[]> { return this.getArray('generic_name_selectors', 'nameSelectors'); }
  async getRetailerNameSelectors(): Promise<string[]> { return this.getArray('generic_retailer_name_selectors', 'retailerNameSelectors'); }
  async getImageSelectors(): Promise<string[]> { return this.getArray('generic_image_selectors', 'imageSelectors'); }
  async getGenericExclusionSelectors(): Promise<string[]> { return this.getArray('generic_exclusion_selectors', 'exclusionSelectors'); }
  async getGenericAIPriceSelectors(): Promise<string[]> { return this.getArray('generic_ai_price_selectors', 'genericAIPriceSelectors'); }
  async getGenericAIImageSelectors(): Promise<string[]> { return this.getArray('generic_ai_image_selectors', 'genericAIImageSelectors'); }
  async getGenericStockSelectors(): Promise<string[]> { return this.getArray('generic_stock_selectors', 'stockSelectors'); }
  async getGenericInStockPhrases(): Promise<string[]> { return this.getArray('generic_in_stock_phrases', 'genericInStockPhrases'); }
  async getGenericOutOfStockPhrases(): Promise<string[]> { return this.getArray('generic_out_of_stock_phrases', 'genericOutOfStockPhrases'); }
  async getGenericPreOrderPhrases(): Promise<string[]> { return this.getArray('generic_pre_order_phrases', 'genericPreOrderPhrases'); }
  
  async getBrowserTimeout(): Promise<number> { return this.getInt('browser_timeout', DEFAULT_CONFIG.browserTimeout); }
  async getBrowserDelay(): Promise<number> { return this.getInt('browser_delay', DEFAULT_CONFIG.browserDelay); }
  
  async getRemoteScraperUrl(): Promise<string | null> { await this.refresh(); return this.settings.remote_scraper_url || null; }
  async getSearXNGUrl(): Promise<string | null> { await this.refresh(); return this.settings.searxng_url || null; }
  async isSearXNGEnabled(): Promise<boolean> { await this.refresh(); return this.settings.searxng_enabled === 'true'; }
  async getScraperProxy(): Promise<string | null> { await this.refresh(); return this.settings.scraper_proxy || null; }
  async getDefaultUserAgent(): Promise<string | null> { await this.refresh(); return this.settings.default_user_agent || null; }
  async getDefaultReferrer(): Promise<string | null> { await this.refresh(); return this.settings.default_referrer || null; }

  async getAISettings(): Promise<AISettings> {
    await this.refresh();
    const all = this.settings;
    return {
      ai_enabled: all.ai_enabled === 'true',
      ai_verification_enabled: all.ai_verification_enabled === 'true',
      ai_auto_mapping_enabled: all.ai_auto_mapping_enabled === 'true',
      ai_provider: (all.ai_provider as any) || 'anthropic',
      anthropic_api_key: all.anthropic_api_key || null,
      anthropic_model: all.anthropic_model || null,
      openai_api_key: all.openai_api_key || null,
      openai_model: all.openai_model || null,
      ollama_base_url: all.ollama_base_url || null,
      ollama_model: all.ollama_model || null,
      gemini_api_key: all.gemini_api_key || null,
      gemini_model: all.gemini_model || null,
      vertex_project_id: all.vertex_project_id || null,
      vertex_location: all.vertex_location || null,
      vertex_api_key: all.vertex_api_key || null,
      vertex_model: all.vertex_model || null,
      deepseek_api_key: all.deepseek_api_key || null,
      deepseek_model: all.deepseek_model || null,
      groq_api_key: all.groq_api_key || null,
      groq_model: all.groq_model || null,
      mistral_api_key: all.mistral_api_key || null,
      mistral_model: all.mistral_model || null,
      jsonld_image_key: all.jsonld_image_key || 'image',
      jsonld_price_key: all.jsonld_price_key || 'price',
      jsonld_name_key: all.jsonld_name_key || 'name',
      prefer_jsonld_image: all.prefer_jsonld_image === 'true',
      ai_timeout: parseInt(all.ai_timeout || '30000', 10),
      ai_max_retries: parseInt(all.ai_max_retries || '2', 10),
    };
  }

  clear(): void {
    this.settings = {};
    this.parsedArrays.clear();
    this.expiry = 0;
  }
}

export const settingsCache = new SystemSettingsCache();
