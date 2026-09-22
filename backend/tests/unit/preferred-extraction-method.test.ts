import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import { PriceCandidate, ScrapedProductWithVoting, StockStatus } from '../../src/types/scraper';
import { runConsensusPhase, ConsensusOptions } from '../../src/services/scraper/orchestration/consensus';
import { selectPreferredCandidate } from '../../src/services/scraper/arbitrators/preference';
import type { RetailerConfig } from '../../src/models';

/**
 * The saved Troubleshoot Price choice has to survive the next refresh
 * (issue #159, second symptom: "If I Troubleshoot Price, I can select the
 * correct price. But when I Refresh Price it shows wrong price again.").
 *
 * `products.preferred_extraction_method` was written by
 * ProductPersistenceService and read by ProductRefreshService, which passed it
 * into scrapeProductWithVoting -- where the parameter was declared and never
 * referenced. The user's correction therefore lasted exactly one scrape.
 *
 * The preference is applied in Phase 5, between findPriceConsensus and the
 * out-of-stock guardrails. Everything it must not disturb is asserted here
 * alongside what it must now do.
 */

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getAISettings: async () => ({ jsonld_price_key: 'price' }),
    getDealPriceSelectors: async () => ['.special-price .price', '.sale-price'],
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

function options(
  overrides: Partial<ConsensusOptions> = {}
): ConsensusOptions {
  return {
    url: 'https://example.com',
    html: '<html></html>',
    userId: 1,
    productId: 123,
    // Keeps arbitration deterministic and offline: no AI call is made.
    finalSkipAiExtraction: true,
    extractionSteps: [],
    ...overrides,
  };
}

function scraped(
  candidates: PriceCandidate[],
  stockStatus: StockStatus = 'in_stock'
): ScrapedProductWithVoting {
  return {
    name: 'Test Product',
    price: null,
    imageUrl: null,
    url: 'https://example.com',
    stockStatus,
    aiStatus: null,
    priceCandidates: candidates,
    needsReview: false,
  };
}

/** Runs the phase and hands back the result plus the trace it produced. */
async function run(
  candidates: PriceCandidate[],
  opts: Partial<ConsensusOptions> = {},
  stockStatus: StockStatus = 'in_stock'
) {
  const steps: string[] = [];
  const result = scraped(candidates, stockStatus);
  await runConsensusPhase(options({ ...opts, extractionSteps: steps }), result);
  return { result, steps };
}

/**
 * The reported shape: a deal-price candidate that takes strict priority in
 * findPriceConsensus, and the standard price the user actually wants tracked.
 */
const DEAL_VS_STANDARD: PriceCandidate[] = [
  { price: 762.5, currency: 'EUR', method: 'deal-price', confidence: 0.95, selector: '.special-price .price' },
  { price: 812.32, currency: 'EUR', method: 'custom-css', confidence: 0.9, selector: '.e4y-current .amount' },
];

describe('selectPreferredCandidate', () => {
  it('reports no preference for an absent, null or blank column value', () => {
    expect(selectPreferredCandidate(DEAL_VS_STANDARD, undefined).status).toBe('none');
    expect(selectPreferredCandidate(DEAL_VS_STANDARD, null).status).toBe('none');
    expect(selectPreferredCandidate(DEAL_VS_STANDARD, '   ').status).toBe('none');
  });

  it('selects the candidate carrying the preferred method', () => {
    const outcome = selectPreferredCandidate(DEAL_VS_STANDARD, 'custom-css');

    expect(outcome.status).toBe('applied');
    if (outcome.status !== 'applied') return;
    expect(outcome.selection.candidate.price).toBe(812.32);
    expect(outcome.selection.sources).toEqual(new Set(['custom-css:.e4y-current .amount']));
  });

  it('takes the largest agreeing group when several candidates share the method', () => {
    const outcome = selectPreferredCandidate([
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 250, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.b' },
      { price: 250, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.c' },
    ], 'custom-css');

    expect(outcome.status).toBe('applied');
    if (outcome.status !== 'applied') return;
    expect(outcome.selection.candidate.price).toBe(250);
    expect(outcome.selection.groupSize).toBe(2);
    expect(outcome.selection.totalMatches).toBe(3);
  });

  it('backfills the currency from the winning group, as the other selection paths do', () => {
    const outcome = selectPreferredCandidate([
      { price: 100, currency: '', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 100, currency: 'EUR', method: 'custom-css', confidence: 0.9, selector: '.b' },
    ], 'custom-css');

    expect(outcome.status).toBe('applied');
    if (outcome.status !== 'applied') return;
    expect(outcome.selection.candidate.currency).toBe('EUR');
  });

  it('reports a preference that matched nothing rather than inventing a candidate', () => {
    expect(selectPreferredCandidate(DEAL_VS_STANDARD, 'json-ld')).toEqual({
      status: 'unmatched',
      method: 'json-ld',
    });
  });

  it('refuses a member or original price as the standard price (issue #167)', () => {
    const candidates: PriceCandidate[] = [
      ...DEAL_VS_STANDARD,
      { price: 700, currency: 'EUR', method: 'member-price', confidence: 0.95, selector: '.member' },
    ];

    expect(selectPreferredCandidate(candidates, 'member-price').status).toBe('secondary');
    expect(selectPreferredCandidate(candidates, 'original-price').status).toBe('secondary');
  });

  it('falls through for a stored method no scrape can reproduce, such as a hand-typed price', () => {
    expect(selectPreferredCandidate(DEAL_VS_STANDARD, 'manual').status).toBe('unmatched');
  });

  it('ignores a candidate whose price is not a finite number', () => {
    expect(selectPreferredCandidate([
      { price: Number.NaN, currency: 'EUR', method: 'custom-css', confidence: 0.9, selector: '.a' },
    ], 'custom-css').status).toBe('unmatched');
  });
});

describe('runConsensusPhase: the saved preference is honoured', () => {
  it('issue #159: the saved standard price beats the deal-price strict priority on refresh', async () => {
    const withoutPreference = await run(DEAL_VS_STANDARD);
    // Without a preference this is the reported behaviour: the deal price wins
    // by rule, and it is the figure the user came to Troubleshoot Price about.
    expect(withoutPreference.result.price?.price).toBe(762.5);

    const { result, steps } = await run(DEAL_VS_STANDARD, { preferredMethod: 'custom-css' });

    expect(result.price).toEqual({ price: 812.32, currency: 'EUR' });
    expect(result.selectedMethod).toBe('custom-css');
    expect(result.needsReview).toBe(false);
    expect(steps.some(s => s.includes('Consensus | Preference | Saved choice honoured: 812.32 via custom-css'))).toBe(true);
    expect(steps.some(s => s.includes('Consensus | Preference | Overrides 762.5 via deal-price'))).toBe(true);
  });

  it('records the decision in the extraction trace with the selector that supplied it', async () => {
    const { steps } = await run(DEAL_VS_STANDARD, { preferredMethod: 'custom-css' });

    expect(steps.some(s => s.includes('(.e4y-current .amount)'))).toBe(true);
    expect(steps.some(s => s.includes('1/1 candidates of that method agreed'))).toBe(true);
  });

  it('settles a genuine no-consensus tie without sending the user back to the modal', async () => {
    // Two custom-css selectors disagreeing: equal weight, so no majority.
    const tied: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 130, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.b' },
    ];

    const withoutPreference = await run(tied);
    expect(withoutPreference.result.needsReview).toBe(true);
    expect(withoutPreference.result.reviewReason).toBe('no_consensus');

    const { result } = await run(tied, { preferredMethod: 'custom-css' });
    expect(result.price?.price).toBe(100);
    expect(result.selectedMethod).toBe('custom-css');
    expect(result.needsReview).toBe(false);
  });

  it('does not let the preference reach the member or original price fields', async () => {
    const candidates: PriceCandidate[] = [
      ...DEAL_VS_STANDARD,
      { price: 700, currency: 'EUR', method: 'member-price', confidence: 0.95, selector: '.member' },
      { price: 999, currency: 'EUR', method: 'original-price', confidence: 0.95, selector: '.rrp' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'custom-css' });

    expect(result.price?.price).toBe(812.32);
    expect(result.memberPrice).toEqual({ price: 700, currency: 'EUR' });
    expect(result.originalPrice).toEqual({ price: 999, currency: 'EUR' });
  });

  it('keeps the missing-currency review guard when the preferred candidate has no currency', async () => {
    const { result } = await run([
      { price: 50, currency: '', method: 'custom-css', confidence: 0.9, selector: '.a' },
    ], { preferredMethod: 'custom-css' });

    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe('missing_currency');
  });
});

describe('runConsensusPhase: a preference is a preference, not a pin', () => {
  it('falls back to normal arbitration when the preferred method finds nothing this scrape', async () => {
    const baseline = await run(DEAL_VS_STANDARD);
    const { result, steps } = await run(DEAL_VS_STANDARD, { preferredMethod: 'json-ld' });

    // The deal ended, the element vanished: whatever the reason, the product
    // must not go priceless because of a stale preference.
    expect(result.price).toEqual(baseline.result.price);
    expect(result.selectedMethod).toBe(baseline.result.selectedMethod);
    expect(result.needsReview).toBe(baseline.result.needsReview);
    expect(steps.some(s => s.includes('Consensus | Preference | Saved choice json-ld matched no candidate'))).toBe(true);
  });

  it('falls back when the stored preference names a member or original price type', async () => {
    const baseline = await run(DEAL_VS_STANDARD);
    const { result, steps } = await run(DEAL_VS_STANDARD, { preferredMethod: 'member-price' });

    expect(result.price).toEqual(baseline.result.price);
    expect(result.selectedMethod).toBe(baseline.result.selectedMethod);
    expect(steps.some(s => s.includes('cannot stand in as the standard price'))).toBe(true);
  });

  it('leaves a product with no candidates at all priceless rather than erroring', async () => {
    const { result } = await run([], { preferredMethod: 'custom-css' });

    expect(result.price).toBeNull();
    expect(result.needsReview).toBe(false);
  });
});

describe('runConsensusPhase: no stored preference behaves exactly as before', () => {
  const scenarios: { name: string; candidates: PriceCandidate[]; stock?: StockStatus; anchor?: number }[] = [
    { name: 'deal-price strict priority', candidates: DEAL_VS_STANDARD },
    {
      name: 'weighted fallback',
      candidates: [
        { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' },
        { price: 120, currency: 'USD', method: 'custom-regex', confidence: 0.9, selector: '~pattern~' },
      ],
    },
    {
      name: 'uncorroborated json-ld while out of stock',
      candidates: [{ price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95 }],
      stock: 'out_of_stock',
    },
    {
      name: 'extreme downward drift while out of stock',
      candidates: [
        { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
        { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
      ],
      stock: 'out_of_stock',
      anchor: 100,
    },
    { name: 'no candidates', candidates: [] },
  ];

  for (const scenario of scenarios) {
    it(`is inert for ${scenario.name}`, async () => {
      const runs = await Promise.all(
        [undefined, null, ''].map(pref =>
          run(scenario.candidates, { preferredMethod: pref, anchorPrice: scenario.anchor }, scenario.stock)
        )
      );

      // Undefined, null and an empty column value are all "no preference", and
      // none of them may add a step, change a price or set a review flag.
      for (const { result, steps } of runs) {
        expect(steps.some(s => s.includes('Consensus | Preference'))).toBe(false);
        expect(result).toEqual(runs[0].result);
        expect(steps).toEqual(runs[0].steps);
      }
    });
  }
});

describe('runConsensusPhase: out-of-stock nullification still applies to a preferred price', () => {
  it('nullifies a preferred low-confidence generic price while out of stock', async () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'generic-css', confidence: 0.6, selector: '.price' },
      { price: 100, currency: 'USD', method: 'generic-css', confidence: 0.6, selector: '.price' },
    ];

    const { result, steps } = await run(candidates, { preferredMethod: 'generic-css' }, 'out_of_stock');

    // The preference decides which candidate wins. It does not vouch for it:
    // a generic selector is no more trustworthy for having been picked once.
    expect(steps.some(s => s.includes('Consensus | Preference | Saved choice honoured'))).toBe(true);
    expect(result.price).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe('oos_guardrail');
  });

  it('nullifies a preferred uncorroborated json-ld price while out of stock', async () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95 },
      { price: 130, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'json-ld' }, 'out_of_stock');

    // The guardrail reads corroboration from the group that actually won, not
    // from the group findPriceConsensus had settled on.
    expect(result.price).toBeNull();
    expect(result.reviewReason).toBe('oos_guardrail');
  });

  it('retains a preferred json-ld price that the winning group corroborates', async () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95, selector: 'offers.price' },
      { price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95, selector: 'offers[1].price' },
      { price: 130, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'json-ld' }, 'out_of_stock');

    expect(result.price?.price).toBe(100);
    expect(result.needsReview).toBe(false);
  });

  it('nullifies a preferred price that drifted far from the anchor while out of stock', async () => {
    const candidates: PriceCandidate[] = [
      { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.b' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'custom-css', anchorPrice: 100 }, 'out_of_stock');

    expect(result.price).toBeNull();
    expect(result.reviewReason).toBe('oos_guardrail');
  });

  it('retains a preferred high-confidence price while out of stock', async () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.b' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'custom-css' }, 'out_of_stock');

    expect(result.price?.price).toBe(100);
    expect(result.needsReview).toBe(false);
  });

  it('still discards an implausible original price when a preference decided the standard one', async () => {
    const candidates: PriceCandidate[] = [
      { price: 812.32, currency: 'EUR', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 10, currency: 'EUR', method: 'original-price', confidence: 0.95, selector: '.rrp' },
    ];

    const { result } = await run(candidates, { preferredMethod: 'custom-css' });

    expect(result.price?.price).toBe(812.32);
    expect(result.originalPrice).toBeNull();
  });
});

/**
 * The preference chooses among the candidates the extraction cascade produced.
 * It composes with the retailer-over-defaults precedence (issue #159, first
 * symptom) rather than competing with it: the cascade decides which selectors
 * were allowed to run, the preference decides which of their results wins.
 */
describe('interaction with retailer-rules-over-global-defaults precedence', () => {
  const HTML = `
    <html><body>
      <div class="special-price"><span class="price">762,50 EUR</span></div>
      <div class="e4y-current"><span class="amount">812,32 EUR</span></div>
      <div class="rrp">899,00 EUR</div>
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

  beforeEach(() => {
    vi.resetModules();
  });

  async function extractThenResolve(config: RetailerConfig | undefined, preferredMethod?: string) {
    const { extractAllPriceCandidates } = await import('../../src/services/scraper/prices');
    const $ = cheerio.load(HTML);
    const steps: string[] = [];
    const candidates = await extractAllPriceCandidates($, HTML, config, 'EUR', 'de_DE', steps);
    const result = scraped(candidates);
    await runConsensusPhase(options({ preferredMethod, extractionSteps: steps }), result);
    return { result, steps, candidates };
  }

  it('a preference cannot resurrect a selector the cascade excluded', async () => {
    // The retailer owns the Deals pass, so the seeded `.special-price .price`
    // default never runs and 762,50 is not a candidate at all. A stored
    // deal-price preference therefore has nothing to select and falls back.
    const { result, steps, candidates } = await extractThenResolve(
      makeConfig({
        price_selectors: ['.e4y-current .amount'],
        deal_price_selectors: ['meta[property="product:sale_price:amount"]::attr(content)'],
      }),
      'deal-price'
    );

    expect(candidates.some(c => c.price === 762.5)).toBe(false);
    expect(steps.some(s => s.includes('Consensus | Preference | Saved choice deal-price matched no candidate'))).toBe(true);
    expect(result.price?.price).toBe(812.32);
  });

  it('a preference picks the retailer standard price over a matching global deal default', async () => {
    // The retailer has no Deal rule, so the defaults legitimately supply one
    // and it takes strict priority. This is the user-visible wrong answer that
    // Troubleshoot Price exists to correct -- and now the correction sticks.
    const config = makeConfig({ price_selectors: ['.e4y-current .amount'] });

    const uncorrected = await extractThenResolve(config);
    expect(uncorrected.result.price?.price).toBe(762.5);
    expect(uncorrected.result.selectedMethod).toBe('deal-price');

    const corrected = await extractThenResolve(config, 'custom-css');
    expect(corrected.result.price?.price).toBe(812.32);
    expect(corrected.result.selectedMethod).toBe('custom-css');
  });
});
