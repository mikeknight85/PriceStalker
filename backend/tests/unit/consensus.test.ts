import { describe, it, expect } from 'vitest';
import { findPriceConsensus } from '../../src/services/scraper/arbitrators/consensus';
import { groupPriceCandidates, pricesMatch } from '../../src/services/scraper/arbitrators/utils';
import { PriceCandidate, ScrapedProductWithVoting } from '../../src/types/scraper';
import { runConsensusPhase, ConsensusOptions } from '../../src/services/scraper/orchestration/consensus';

describe('findPriceConsensus Unit Tests', () => {
  it('should handle deal-price consensus without ties', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'deal-price', confidence: 0.95 },
      { price: 100, currency: 'USD', method: 'deal-price', confidence: 0.95 },
      { price: 120, currency: 'USD', method: 'deal-price', confidence: 0.95 },
    ];
    const result = findPriceConsensus(candidates);
    expect(result.hasConsensus).toBe(true);
    expect(result.price?.price).toBe(100);
  });

  it('should handle deal-price ties', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'deal-price', confidence: 0.95 },
      { price: 120, currency: 'USD', method: 'deal-price', confidence: 0.95 },
    ];
    const result = findPriceConsensus(candidates);
    expect(result.hasConsensus).toBe(false);
  });

  it('should handle pre-order-price ties', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'pre-order-price', confidence: 0.95 },
      { price: 120, currency: 'USD', method: 'pre-order-price', confidence: 0.95 },
    ];
    const result = findPriceConsensus(candidates);
    expect(result.hasConsensus).toBe(false);
  });

  it('should prefer custom-regex over custom-css on weight fallback', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' },
      { price: 120, currency: 'USD', method: 'custom-regex', confidence: 0.9, selector: '~pattern~' },
    ];
    const result = findPriceConsensus(candidates);
    // Since custom-regex has weight 1.6 and custom-css has 1.5,
    // regex should win and have consensus.
    expect(result.price?.price).toBe(120);
    expect(result.hasConsensus).toBe(true);
  });

  it('documents that one sufficiently weighted source reaches consensus', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' }
    ];

    const result = findPriceConsensus(candidates);

    expect(result.price?.price).toBe(100);
    expect(result.hasConsensus).toBe(true);
  });

  it('counts a repeated candidate source only once', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' },
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' },
      { price: 110, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.other-price' }
    ];

    const result = findPriceConsensus(candidates);

    // Both groups have one distinct source at weight 1.5, so this is not a consensus.
    expect(result.hasConsensus).toBe(false);
    expect(result.price?.price).toBe(100);
  });

  it('gives deal-price priority even when there is only one deal candidate', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'deal-price', confidence: 0.95, selector: '.deal' },
      { price: 120, currency: 'USD', method: 'json-ld', confidence: 0.95 }
    ];

    const result = findPriceConsensus(candidates);

    expect(result.price?.price).toBe(100);
    expect(result.hasConsensus).toBe(true);
  });

  it('documents that member-price ties currently select the first largest group', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'member-price', confidence: 0.8, selector: '.member-a' },
      { price: 120, currency: 'USD', method: 'member-price', confidence: 0.95, selector: '.member-b' }
    ];

    const result = findPriceConsensus(candidates);

    expect(result.memberPrice?.price).toBe(100);
    expect(result.memberPrice?.confidence).toBe(0.8);
  });

  it('groups equal numeric prices even when their currencies differ', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.price' },
      { price: 100, currency: 'EUR', method: 'json-ld', confidence: 0.95 }
    ];

    const result = findPriceConsensus(candidates);

    expect(result.price?.price).toBe(100);
    expect(result.price?.currency).toBe('USD');
    expect(result.winningGroupSources?.size).toBe(2);
  });

  it('shows that approximate grouping depends on candidate order', () => {
    const candidates: PriceCandidate[] = [
      { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.a' },
      { price: 104, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.b' },
      { price: 108, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.c' }
    ];

    const forwardGroups = groupPriceCandidates(candidates);
    const reorderedGroups = groupPriceCandidates([candidates[1], candidates[0], candidates[2]]);

    expect(forwardGroups.map(group => group.length)).toEqual([2, 1]);
    expect(reorderedGroups.map(group => group.length)).toEqual([3]);
  });

  describe('pricesMatch Helper Unit Tests', () => {
    it('should match identical non-zero values', () => {
      expect(pricesMatch(100, 100)).toBe(true);
    });

    it('should match identical zero values without division-by-zero NaN issues', () => {
      expect(pricesMatch(0, 0)).toBe(true);
    });

    it('should match values within 5% tolerance', () => {
      expect(pricesMatch(100, 104)).toBe(true);
      expect(pricesMatch(100, 96)).toBe(true);
    });

    it('should not match values outside 5% tolerance', () => {
      expect(pricesMatch(100, 106)).toBe(false);
      expect(pricesMatch(100, 94)).toBe(false);
    });
  });

  describe('runConsensusPhase OOS Guardrails', () => {
    const defaultOptions = (candidates: PriceCandidate[], anchor?: number): ConsensusOptions => ({
      url: 'https://example.com',
      html: '<html></html>',
      userId: 1,
      productId: 123,
      finalSkipAiExtraction: true,
      anchorPrice: anchor,
      extractionSteps: []
    });

    const defaultResult = (candidates: PriceCandidate[]): ScrapedProductWithVoting => ({
      name: 'Test Product',
      price: null,
      imageUrl: 'https://example.com/image.jpg',
      url: 'https://example.com',
      stockStatus: 'out_of_stock',
      aiStatus: null,
      priceCandidates: candidates,
      needsReview: false
    });

    it('should retain OOS price for high confidence custom selector', async () => {
      const candidates: PriceCandidate[] = [
        { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
        { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' }
      ];
      const res = defaultResult(candidates);
      await runConsensusPhase(defaultOptions(candidates), res);
      expect(res.price?.price).toBe(100);
      expect(res.needsReview).toBe(false);
    });

    it('should coerce OOS price to null for low confidence generic selector', async () => {
      const candidates: PriceCandidate[] = [
        { price: 100, currency: 'USD', method: 'generic-css', confidence: 0.6, selector: '.price' },
        { price: 100, currency: 'USD', method: 'generic-css', confidence: 0.6, selector: '.price' }
      ];
      const res = defaultResult(candidates);
      await runConsensusPhase(defaultOptions(candidates), res);
      expect(res.price).toBeNull();
      expect(res.needsReview).toBe(true);
    });

    it('should coerce OOS price to null for uncorroborated JSON-LD', async () => {
      const candidates: PriceCandidate[] = [
        { price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95 }
      ];
      const res = defaultResult(candidates);
      await runConsensusPhase(defaultOptions(candidates), res);
      expect(res.price).toBeNull();
      expect(res.needsReview).toBe(true);
    });

    it('should retain OOS price for corroborated JSON-LD', async () => {
      const candidates: PriceCandidate[] = [
        { price: 100, currency: 'USD', method: 'json-ld', confidence: 0.95 },
        { price: 100, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' }
      ];
      const res = defaultResult(candidates);
      await runConsensusPhase(defaultOptions(candidates), res);
      expect(res.price?.price).toBe(100);
      expect(res.needsReview).toBe(false);
    });

    it('should coerce OOS price to null under extreme drift from anchor price', async () => {
      const candidates: PriceCandidate[] = [
        { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
        { price: 40, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' }
      ];
      const res = defaultResult(candidates);
      // Anchor is 100. Price resolved is 40. 40 < 50% of 100 (50) -> drift triggered!
      await runConsensusPhase(defaultOptions(candidates, 100), res);
      expect(res.price).toBeNull();
      expect(res.needsReview).toBe(true);
    });

    it('should retain OOS price when drift is within limits', async () => {
      const candidates: PriceCandidate[] = [
        { price: 80, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
        { price: 80, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' }
      ];
      const res = defaultResult(candidates);
      // Anchor is 100. Price resolved is 80. 80 >= 50% of 100 -> drift NOT triggered!
      await runConsensusPhase(defaultOptions(candidates, 100), res);
      expect(res.price?.price).toBe(80);
      expect(res.needsReview).toBe(false);
    });

    it('documents that upward anchor drift is currently retained', async () => {
      const candidates: PriceCandidate[] = [
        { price: 250, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' },
        { price: 250, currency: 'USD', method: 'custom-css', confidence: 0.9, selector: '.my-price' }
      ];
      const res = defaultResult(candidates);

      // The current guard rejects only prices below 50% of the anchor.
      await runConsensusPhase(defaultOptions(candidates, 100), res);

      expect(res.price?.price).toBe(250);
      expect(res.needsReview).toBe(false);
    });
  });
});
