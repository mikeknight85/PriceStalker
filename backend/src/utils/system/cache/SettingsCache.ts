import { logger } from '../logger';
import type { AISettings } from '../../../models/types/system';
import { CANONICAL_USER_AGENT } from '../user-agent-constants';

/**
 * Canonical array defaults for extraction selectors and phrases.
 * Used as the single source of truth across system settings cache,
 * reset-to-defaults actions, and database migrations.
 */
export const CANONICAL_SELECTOR_ARRAYS: Record<string, string[]> = {
  generic_price_selectors: [
    'meta[itemprop="lowPrice"]::attr(content)',
    '[itemprop="lowPrice"]',
    '[itemprop="price"]',
    'meta[property="product:price:amount"]::attr(content)',
    'meta[property="og:price:amount"]::attr(content)',
    '[data-price-type="finalPrice"] .price',
    '[data-price]',
    '[data-price]::attr(data-price)',
    '[data-price-amount]',
    '[data-price-amount]::attr(data-price-amount)',
    '[data-product-price]',
    '[data-product-price]::attr(data-product-price)',
    '[data-test="price"]',
    '[data-test="product-price"]',
    '[data-test="current-price"]',
    '[data-automation-test-id*="price" i]',
    '[data-testid*="price" i]',
    '[data-test-id*="price" i]',
    '.price-item--sale',
    '.price-item--regular',
    '.woocommerce-Price-amount.amount',
    '.summary .price .amount',
    '.price-box .price',
    '.special-price .price',
    '.price',
    '.product-price',
    '.current-price',
    '.sale-price',
    '.final-price',
    '.offer-price',
    '#price',
    '[class*="price" i]'
  ],
  generic_deal_price_selectors: [
    '.price-item--sale',
    '.special-price .price',
    '.sale-price',
    '.deal-price'
  ],
  generic_member_price_selectors: [
    '.member-price',
    '.perks-price',
    '.club-price'
  ],
  generic_original_price_selectors: [
    '.rrp',
    '.was-price',
    '.price-item--regular',
    '.old-price',
    '[class*="original" i]',
    '[class*="rrp" i]',
    '[class*="was-price" i]',
    '[data-testid*="strikethrough-price"]'
  ],
  generic_pre_order_price_selectors: [
    '[class*="preorder-price" i]',
    '[class*="pre-order-price" i]',
    '[data-testid*="preorder-price" i]',
    '[data-testid*="pre-order-price" i]',
    '[id*="preorder-price" i]'
  ],
  generic_name_selectors: [
    'meta[property="og:title"]::attr(content)',
    'meta[name="twitter:title"]::attr(content)',
    '[itemprop="name"]',
    '[data-automation-test-id*="title" i]',
    '[data-automation-test-id*="name" i]',
    '[data-testid*="title" i]',
    '[data-testid*="name" i]',
    'h1[class*="product"]',
    'h1[class*="title"]',
    '.product-title',
    'h1'
  ],
  generic_retailer_name_selectors: [
    'meta[property="og:site_name"]::attr(content)',
    'meta[name="application-name"]::attr(content)',
    '.retailer-name',
    'a[class*="logo" i]::attr(aria-label)',
    'a[id*="logo" i]::attr(aria-label)'
  ],
  generic_image_selectors: [
    '[itemprop="image"]',
    'meta[property="og:image"]::attr(content)',
    'meta[name="twitter:image"]::attr(content)',
    'link[rel="preload"][as="image"]',
    '[data-automation-test-id*="image" i]',
    '[data-testid*="image" i]',
    '.product-image img',
    '.main-image img',
    '[data-zoom-image]',
    'img[class*="product" i]',
    '[class*="gallery" i] img',
    '[class*="media" i] img',
    '[class*="carousel" i] img',
    '[class*="slider" i] img',
    '.woocommerce-product-gallery__image img'
  ],
  generic_stock_selectors: [
    '[itemprop="availability"]',
    '.stock-status',
    '.availability',
    '[data-automation-test-id*="stock" i]',
    '[data-automation-test-id*="availability" i]',
    '[data-automation-test-id*="buy-box" i]',
    '[data-testid*="stock" i]',
    '[data-testid*="availability" i]',
    '[data-test-id*="stock" i]',
    '[data-test-id*="availability" i]',
    '[class*="stock-status" i]',
    '[class*="availability" i]'
  ],
  generic_exclusion_selectors: [
    '.site-wide-ad'
  ],
  generic_ai_price_selectors: [
    '[class*="price" i]',
    '[class*="Price" i]',
    '[data-testid*="price" i]',
    '[data-automation*="price" i]',
    '[data-automation*="Price" i]',
    '[itemprop="price"]',
    '[data-price]',
    '[data-price]::attr(data-price)',
    '[data-price-amount]',
    '[data-price-amount]::attr(data-price-amount)',
    '[data-product-price]',
    '[data-product-price]::attr(data-product-price)'
  ],
  generic_ai_image_selectors: [
    'link[rel="preload"][as="image"]',
    '[itemprop="image"]',
    'meta[property="og:image"]::attr(content)',
    'meta[name="twitter:image"]::attr(content)',
    'img#landingImage',
    'img#main-image',
    'img.main-image',
    'img.hero-image',
    'img[class*="product-image" i]',
    'img[class*="product__image" i]',
    'img[class*="product" i]',
    'img[class*="gallery" i]',
    'img[data-testid*="image" i]',
    '[data-automation-test-id*="image" i]',
    '[data-testid*="image" i]',
    '.product-image img',
    '.main-image img',
    '[data-zoom-image]',
    '[class*="gallery" i] img',
    '[class*="media" i] img',
    '[class*="carousel" i] img',
    '[class*="slider" i] img',
    '.woocommerce-product-gallery__image img'
  ],
  generic_in_stock_phrases: [
    'in stock', 'instock', 'add to cart', 'add to basket', 'add to bag',
    'buy now', 'available now', 'add to trolley', 'clearance', 'on sale',
    'special offer', 'limited stock', 'available', 'ready to ship',
    'dispatched within', 'dispatched from', 'auf lager', 'en stock'
  ],
  generic_out_of_stock_phrases: [
    'out of stock', 'sold out', 'currently unavailable', 'not available',
    'backorder', 'back-order', 'notify me when available', 'coming soon',
    'unavailable', 'discontinued', 'nicht lieferbar'
  ],
  generic_pre_order_phrases: [
    'pre-order', 'preorder', 'available starting', 'expected to ship',
    'release date', 'pre-ordering', 'coming soon', 'vorbestellen'
  ],
  generic_challenge_phrases: [
    'are you a robot',
    'just a moment',
    'access denied',
    'verify you are human',
    'pardon our interruption',
    'security check',
    'attention required',
    'access is temporarily restricted',
    'unusual activity',
    'access to this page has been denied',
    'press & hold',
    'press and hold'
  ]
};

/**
 * Canonical dictionary mapping all configurable system settings to their factory defaults.
 */
export const CANONICAL_SYSTEM_DEFAULTS: Record<string, string> = {
  default_user_agent: CANONICAL_USER_AGENT,
  default_referrer: 'https://www.google.com/',
  default_refresh_interval: '43200',
  browser_timeout: '60000',
  browser_delay: '3000',
  jsonld_image_key: 'image',
  jsonld_name_key: 'name',
  jsonld_price_key: 'price',
  prefer_jsonld_image: 'true',
  ...Object.fromEntries(
    Object.entries(CANONICAL_SELECTOR_ARRAYS).map(([k, arr]) => [k, JSON.stringify(arr)])
  )
};

/**
 * Default configuration values for fallback.
 */
const DEFAULT_CONFIG = {
  priceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_price_selectors,
  dealPriceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_deal_price_selectors,
  memberPriceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_member_price_selectors,
  preOrderPriceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_pre_order_price_selectors,
  originalPriceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_original_price_selectors,
  nameSelectors: CANONICAL_SELECTOR_ARRAYS.generic_name_selectors,
  retailerNameSelectors: CANONICAL_SELECTOR_ARRAYS.generic_retailer_name_selectors,
  imageSelectors: CANONICAL_SELECTOR_ARRAYS.generic_image_selectors,
  stockSelectors: CANONICAL_SELECTOR_ARRAYS.generic_stock_selectors,
  exclusionSelectors: CANONICAL_SELECTOR_ARRAYS.generic_exclusion_selectors,
  genericInStockPhrases: CANONICAL_SELECTOR_ARRAYS.generic_in_stock_phrases,
  genericOutOfStockPhrases: CANONICAL_SELECTOR_ARRAYS.generic_out_of_stock_phrases,
  genericPreOrderPhrases: CANONICAL_SELECTOR_ARRAYS.generic_pre_order_phrases,
  genericChallengePhrases: CANONICAL_SELECTOR_ARRAYS.generic_challenge_phrases,
  genericAIPriceSelectors: CANONICAL_SELECTOR_ARRAYS.generic_ai_price_selectors,
  genericAIImageSelectors: CANONICAL_SELECTOR_ARRAYS.generic_ai_image_selectors,
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
        // Falling back silently hid a real bug for a long time: 001_baseline
        // stored several of these settings as unparseable JSON, so extraction
        // quietly ran on the hardcoded defaults instead of the seeded set and
        // nothing said so. Repaired by 013, but say it out loud if it recurs.
        logger.warn(
          `Settings | ${key} is not valid JSON; falling back to the built-in default. ` +
            `Re-save it under Admin -> Extraction Rules to fix.`,
          'System'
        );
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
  async getGenericChallengePhrases(): Promise<string[]> { return this.getArray('generic_challenge_phrases', 'genericChallengePhrases'); }
  
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
      openrouter_api_key: all.openrouter_api_key || null,
      openrouter_model: all.openrouter_model || null,
      openai_compatible_base_url: all.openai_compatible_base_url || null,
      openai_compatible_api_key: all.openai_compatible_api_key || null,
      openai_compatible_model: all.openai_compatible_model || null,
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
