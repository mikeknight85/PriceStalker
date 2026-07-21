import { describe, it, expect } from 'vitest';
import { findPriceConsensus } from '../../src/services/scraper/arbitrators/consensus';
import { pricesMatch } from '../../src/services/scraper/arbitrators/utils';
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
  });
});
