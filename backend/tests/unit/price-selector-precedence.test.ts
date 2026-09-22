import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import type { RetailerConfig } from '../../src/models';

/**
 * Retailer rules outrank the global default rules, per price type (issue #159).
 *
 * The Extraction Rules page states the order as "Retailer rules -> These
 * default rules -> Built-in fallbacks", and title/image extraction has always
 * honoured it. Price extraction merged the two sets into one pool instead, so a
 * seeded default could beat a retailer's own rule.
 *
 * That is worst on the Deals pass: a deal-price candidate takes strict priority
 * in findPriceConsensus over any standard price, whatever found it. The seeded
 * default `.special-price .price` therefore took that priority away from the
 * retailer's own rules -- visibly so in the issue #162 screenshot, where the
 * winning "Limited Deal" candidate names that selector.
 *
 * The cascade is decided per price type by what is configured, not by what
 * matched: a retailer that has a Deal/Sale rule owns that price type for that
 * shop, and the defaults do not top it up.
 */

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getAISettings: async () => ({ jsonld_price_key: 'price' }),
    getDealPriceSelectors: async () => ['.price-item--sale', '.special-price .price', '.sale-price'],
    getMemberPriceSelectors: async () => ['.member-price'],
    getPreOrderPriceSelectors: async () => ['.preorder-price'],
    getOriginalPriceSelectors: async () => ['.rrp'],
    getPriceSelectors: async () => ['.price', '[itemprop="price"]'],
  },
}));

vi.mock('../../src/utils/i18n/currency/cache', () => ({
  currencyCache: {
    getGlobalCurrenciesSync: () => [
      { locale: 'de_DE', iso: 'EUR', symbol: '€' },
      { locale: 'en_US', iso: 'USD', symbol: '$' },
    ],
  },
}));

// The reported page shape: a stale sale figure carried by the Magento-style
// `.special-price .price` markup that the seeded deal defaults target, and the
// price actually charged in a retailer-specific container.
const HTML = `
  <html><body>
    <div class="special-price"><span class="price">762,50 EUR</span></div>
    <div class="e4y-current"><span class="amount">812,32 EUR</span></div>
    <div class="rrp">799,00 EUR</div>
  </body></html>
`;

function makeConfig(overrides: Partial<RetailerConfig>): RetailerConfig {
  return {
    id: 1,
    domain: 'www.electronic4you.si',
    name: 'electronic4you',
    status: null,
    status_history: [],
    use_proxy: false,
    use_browser_scraper: true,
    currency_hint: 'EUR',
    name_selectors: [],
    retailer_name_selectors: [],
    price_selectors: [],
    deal_price_selectors: [],
    original_price_selectors: [],
    member_price_selectors: [],
    image_selectors: [],
    stock_selectors: [],
    in_stock_phrases: [],
    out_of_stock_phrases: [],
    pre_order_phrases: [],
    member_only_phrases: [],
    pre_order_price_selectors: [],
    exclusion_selectors: [],
    jsonld_image_key: null,
    jsonld_price_key: null,
    jsonld_name_key: null,
    prefer_jsonld_image: null,
    user_agent: null,
    referrer: null,
    custom_selectors: null,
    description: null,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function extract(config: RetailerConfig | undefined) {
  const { extractAllPriceCandidates } = await import('../../src/services/scraper/prices');
  const $ = cheerio.load(HTML);
  const steps: string[] = [];
  const candidates = await extractAllPriceCandidates($, HTML, config, 'EUR', 'de_DE', steps);
  return { candidates, steps };
}

describe('price selector precedence: retailer rules over global defaults', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not evaluate the global deal defaults when a retailer deal rule matches', async () => {
    const { candidates, steps } = await extract(makeConfig({
      deal_price_selectors: ['.e4y-current .amount'],
      price_selectors: ['.e4y-current .amount'],
    }));

    const deals = candidates.filter(c => c.method === 'deal-price');
    expect(deals).toHaveLength(1);
    expect(deals[0].price).toBe(812.32);
    // The seeded default matched 762,50 in the same document and must not have run.
    expect(candidates.some(c => c.price === 762.5)).toBe(false);
    expect(steps.some(s => s.includes('Deals | Default selectors'))).toBe(false);
    expect(steps.some(s => s.includes('Deals | Retailer selectors'))).toBe(true);
  });

  it('issue #159: the retailer standard price wins when its Deal rule finds nothing', async () => {
    // The reported configuration: a Standard rule that matches, and a Deal/Sale
    // rule that does not match this particular product. Before the fix the
    // seeded `.special-price .price` filled the gap with a deal-price candidate
    // and took strict priority from the standard rule.
    const { candidates } = await extract(makeConfig({
      price_selectors: ['.e4y-current .amount'],
      deal_price_selectors: ['meta[property="product:sale_price:amount"]::attr(content)'],
      original_price_selectors: ['.rrp'],
    }));

    expect(candidates.some(c => c.method === 'deal-price')).toBe(false);

    const { findPriceConsensus } = await import('../../src/services/scraper/extractors/prices');
    const { price } = findPriceConsensus(candidates);
    expect(price?.price).toBe(812.32);
  });

  it('still uses the global defaults when the retailer has no rules for that type', async () => {
    const { candidates, steps } = await extract(undefined);

    const deals = candidates.filter(c => c.method === 'deal-price');
    expect(deals.map(c => c.price)).toContain(762.5);
    expect(steps.some(s => s.includes('Deals | Default selectors'))).toBe(true);
  });

  it('uses the global deal defaults for a retailer configured only for other types', async () => {
    // A configured retailer does not lose the defaults wholesale: the cascade
    // is decided per price type, so an unconfigured type still falls back.
    const { candidates, steps } = await extract(makeConfig({
      price_selectors: ['.e4y-current .amount'],
    }));

    expect(candidates.filter(c => c.method === 'deal-price').map(c => c.price)).toContain(762.5);
    expect(steps.some(s => s.includes('Deals | Default selectors'))).toBe(true);
  });

  it('skips the generic standard pass when the retailer has its own standard rules', async () => {
    const { candidates, steps } = await extract(makeConfig({
      price_selectors: ['.e4y-current .amount'],
    }));

    expect(candidates.some(c => c.method === 'generic-css')).toBe(false);
    expect(steps.some(s => s.startsWith('Extract | Generic |'))).toBe(false);
  });

  it('does not top a retailer standard rule up with the defaults when it matches nothing', async () => {
    const { candidates, steps } = await extract(makeConfig({
      price_selectors: ['.selector-that-is-now-stale'],
    }));

    expect(candidates.some(c => c.method === 'generic-css')).toBe(false);
    expect(steps.some(s => s.startsWith('Extract | Generic |'))).toBe(false);
  });
});
