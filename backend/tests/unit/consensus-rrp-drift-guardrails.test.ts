import { describe, it, expect } from 'vitest';
import { runConsensusPhase, ConsensusOptions } from '../../src/services/scraper/orchestration/consensus';
import { findPriceConsensus } from '../../src/services/scraper/arbitrators/consensus';
import type { PriceCandidate, ScrapedProductWithVoting } from '../../src/types/scraper';

describe('Consensus Phase RRP, Drift Guardrails & Tie Invariants', () => {
  const makeOptions = (overrides: Partial<ConsensusOptions> = {}): ConsensusOptions => ({
    url: 'https://shop.example.com/p/1',
    html: '<html><body></body></html>',
    userId: 1,
    productId: 10,
    finalSkipAiExtraction: true,
    extractionSteps: [],
    ...overrides,
  });

  const makeResult = (overrides: Partial<ScrapedProductWithVoting> = {}): ScrapedProductWithVoting => ({
    name: 'Sample Product',
    price: null,
    imageUrl: null,
    url: 'https://shop.example.com/p/1',
    stockStatus: 'in_stock',
    aiStatus: null,
    priceCandidates: [],
    needsReview: false,
    ...overrides,
  });

  describe('RRP / Original Price Sanity Guardrail (Issue #55)', () => {
    it('discards original price when it is lower than the resolved standard price', async () => {
      // Standard price $50, original price $40 (an impossible "discount" where original is cheaper)
      const candidates: PriceCandidate[] = [
        { price: 50, currency: 'USD', method: 'custom-css', selector: '.current-price' },
        { price: 40, currency: 'USD', method: 'original-price', selector: '.was-price' },
      ];

      const res = makeResult({ priceCandidates: candidates });
      const steps: string[] = [];
      await runConsensusPhase(makeOptions({ extractionSteps: steps }), res);

      expect(res.price?.price).toBe(50);
      expect(res.originalPrice).toBeNull();
      expect(steps.some(s => s.includes('Discarded implausible original price 40 (standard 50)'))).toBe(true);
    });

    it('discards original price when it is more than 10x the standard price', async () => {
      // Standard price $50, original price $600 (> 50 * 10)
      const candidates: PriceCandidate[] = [
        { price: 50, currency: 'USD', method: 'custom-css', selector: '.current-price' },
        { price: 600, currency: 'USD', method: 'original-price', selector: '.implausible-strike' },
      ];

      const res = makeResult({ priceCandidates: candidates });
      const steps: string[] = [];
      await runConsensusPhase(makeOptions({ extractionSteps: steps }), res);

      expect(res.price?.price).toBe(50);
      expect(res.originalPrice).toBeNull();
      expect(steps.some(s => s.includes('Discarded implausible original price 600 (standard 50)'))).toBe(true);
    });

    it('retains plausible original price within standard <= original <= 10x standard', async () => {
      const candidates: PriceCandidate[] = [
        { price: 80, currency: 'USD', method: 'custom-css', selector: '.current-price' },
        { price: 100, currency: 'USD', method: 'original-price', selector: '.rrp' },
      ];

      const res = makeResult({ priceCandidates: candidates });
      await runConsensusPhase(makeOptions(), res);

      expect(res.price?.price).toBe(80);
      expect(res.originalPrice?.price).toBe(100);
    });
  });

  describe('Missing currency review trigger', () => {
    it('flags needsReview = true and reviewReason = "missing_currency" when winning price lacks currency', async () => {
      const candidates: PriceCandidate[] = [
        { price: 49.99, currency: '', method: 'custom-css', selector: '.price' },
      ];

      const res = makeResult({ priceCandidates: candidates });
      const steps: string[] = [];
      await runConsensusPhase(makeOptions({ extractionSteps: steps }), res);

      expect(res.price?.price).toBe(49.99);
      expect(res.needsReview).toBe(true);
      expect(res.reviewReason).toBe('missing_currency');
      expect(steps).toContain('Consensus | Review | Winning price has no resolved currency');
    });
  });

  describe('Extreme upward anchor drift during Out of Stock', () => {
    it('nullifies price when resolved price exceeds 2.5x the anchor price during OOS', async () => {
      // Anchor is $100. Scraped price is $260 (> 2.5 * 100 = 250).
      const candidates: PriceCandidate[] = [
        { price: 260, currency: 'USD', method: 'custom-css', selector: '.price' },
      ];

      const res = makeResult({
        stockStatus: 'out_of_stock',
        priceCandidates: candidates,
      });

      const steps: string[] = [];
      await runConsensusPhase(makeOptions({ anchorPrice: 100, extractionSteps: steps }), res);

      expect(res.price).toBeNull();
      expect(res.needsReview).toBe(true);
      expect(res.reviewReason).toBe('oos_guardrail');
      expect(steps.some(s => s.includes('extreme drift (price 260 vs anchor 100)'))).toBe(true);
    });
  });

  describe('findPriceConsensus advanced arbitration invariants', () => {
    it('returns price: null but populates memberPrice and originalPrice when no standard candidates exist', () => {
      const candidates: PriceCandidate[] = [
        { price: 29.99, currency: 'USD', method: 'member-price', selector: '.member' },
        { price: 59.99, currency: 'USD', method: 'original-price', selector: '.rrp' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.price).toBeNull();
      expect(result.hasConsensus).toBe(false);
      expect(result.memberPrice?.price).toBe(29.99);
      expect(result.originalPrice?.price).toBe(59.99);
    });

    it('returns hasConsensus: false when two deal prices are tied with equal group size', () => {
      const candidates: PriceCandidate[] = [
        { price: 40, currency: 'USD', method: 'deal-price', selector: '.deal-a' },
        { price: 45, currency: 'USD', method: 'deal-price', selector: '.deal-b' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.hasConsensus).toBe(false);
    });

    it('returns hasConsensus: false when two pre-order prices are tied with equal group size', () => {
      const candidates: PriceCandidate[] = [
        { price: 70, currency: 'USD', method: 'pre-order-price', selector: '.pre-a' },
        { price: 75, currency: 'USD', method: 'pre-order-price', selector: '.pre-b' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.hasConsensus).toBe(false);
    });

    it('deduplicates weights when the exact same sourceKey appears repeatedly in the same price group', () => {
      // 5 duplicate entries from the exact same selector '.generic-price'
      const candidates: PriceCandidate[] = [
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.generic-price' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.generic-price' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.generic-price' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.generic-price' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.generic-price' },
      ];

      const result = findPriceConsensus(candidates);
      // Because all 5 candidates share the same sourceKey ('generic-css:.generic-price'),
      // weight is 0.2, NOT 5 * 0.2 = 1.0!
      // Therefore totalWeight is 0.2 < 1.0, and hasConsensus must be false!
      expect(result.hasConsensus).toBe(false);
      expect(result.winningGroupSources.size).toBe(1);
    });

    it('grants consensus when distinct generic selectors corroborate the same price', () => {
      // 5 distinct selectors corroborate $20 (5 * 0.2 = 1.0 >= 1.0)
      const candidates: PriceCandidate[] = [
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.price-header' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.price-footer' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.price-summary' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.price-tag' },
        { price: 20, currency: 'USD', method: 'generic-css', selector: '.price-box' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.hasConsensus).toBe(true);
      expect(result.winningGroupSources.size).toBe(5);
    });
  });
});
