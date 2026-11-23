import { describe, it, expect } from 'vitest';
import { findPriceConsensus } from '../../src/services/scraper/arbitrators/consensus';
import { pricesMatch, groupPriceCandidates, withGroupCurrency } from '../../src/services/scraper/arbitrators/utils';
import { PriceCandidate } from '../../src/types/scraper';

describe('Consensus & Price Matching Boundaries (Issue #167)', () => {
  describe('pricesMatch boundary conditions', () => {
    it('exact equality always matches', () => {
      expect(pricesMatch(0, 0)).toBe(true);
      expect(pricesMatch(49.99, 49.99)).toBe(true);
      expect(pricesMatch(1500, 1500)).toBe(true);
    });

    it('enforces the sub-cent floor tolerance (MIN_ABSOLUTE_TOLERANCE = 0.02)', () => {
      // 1.00 vs 1.015: diff is 0.015, average is ~1.0075. Relative 5% is ~0.05, but floor ensures at least 0.02.
      // Below 0.02 diff:
      expect(pricesMatch(1.00, 1.015)).toBe(true);

      // Above tolerance on a tiny number (e.g. 0.00 vs 0.05):
      // Average is 0.025, 5% is ~0.00125. Floor is 0.02. Diff is 0.05.
      expect(pricesMatch(0.00, 0.05)).toBe(false);
      expect(pricesMatch(0.00, 0.015)).toBe(true);
    });

    it('enforces the 5.00 absolute tolerance ceiling on large prices (Issue #167)', () => {
      // Prior to issue #167, a raw 5% rule allowed 1000 vs 1040 (diff 40) or 1000 vs 1050 (diff 50) to match.
      // The 5.00 ceiling strictly limits any difference to < 5.00.
      expect(pricesMatch(1000, 1004.99)).toBe(true);
      expect(pricesMatch(1000, 1005.01)).toBe(false);

      // 5000 vs 5006: diff is 6.00 (> 5.00 cap) -> must NOT match
      expect(pricesMatch(5000, 5006)).toBe(false);
      // 5000 vs 5004: diff is 4.00 (< 5.00 cap) -> matches
      expect(pricesMatch(5000, 5004)).toBe(true);
    });

    it('applies the 5% relative tolerance in the mid-range', () => {
      // 100 vs 104: diff is 4. Average is 102. 5% is 5.10. Tolerance is 5.00 (capped).
      // diff 4 < 5.00 -> matches.
      expect(pricesMatch(100, 104)).toBe(true);

      // 100 vs 106: diff is 6 > 5.00 -> does NOT match
      expect(pricesMatch(100, 106)).toBe(false);
    });
  });

  describe('withGroupCurrency currency donor backfilling', () => {
    it('backfills currency from a secondary candidate when first candidate has none', () => {
      const group: PriceCandidate[] = [
        { price: 49.99, currency: '', method: 'generic-css', confidence: 0.8 },
        { price: 49.99, currency: 'USD', method: 'json-ld', confidence: 0.95 },
      ];

      const winner = withGroupCurrency(group);
      expect(winner.currency).toBe('USD');
      expect(winner.price).toBe(49.99);
    });

    it('preserves existing currency on candidate 0 without overwriting', () => {
      const group: PriceCandidate[] = [
        { price: 49.99, currency: 'EUR', method: 'custom-css', confidence: 0.9 },
        { price: 49.99, currency: 'GBP', method: 'json-ld', confidence: 0.95 },
      ];

      const winner = withGroupCurrency(group);
      expect(winner.currency).toBe('EUR');
    });

    it('survives when no candidate in the group has a currency', () => {
      const group: PriceCandidate[] = [
        { price: 49.99, currency: '', method: 'custom-css', confidence: 0.9 },
        { price: 49.99, currency: '', method: 'generic-css', confidence: 0.8 },
      ];

      const winner = withGroupCurrency(group);
      expect(winner.currency).toBe('');
      expect(winner.price).toBe(49.99);
    });
  });

  describe('findPriceConsensus boundary conditions', () => {
    it('returns hasConsensus: false when standard candidates are tied with exact equal weights', () => {
      // Two different prices, both extracted by custom-css (weight 1.5)
      const candidates: PriceCandidate[] = [
        { price: 29.99, currency: 'USD', method: 'custom-css', selector: '.price-main' },
        { price: 89.99, currency: 'USD', method: 'custom-css', selector: '.bundle-price' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.hasConsensus).toBe(false);
    });

    it('returns hasConsensus: false when only an under-weighted candidate is present', () => {
      // generic-css has weight 0.2, which is below the 1.0 consensus threshold
      const candidates: PriceCandidate[] = [
        { price: 19.99, currency: 'USD', method: 'generic-css', selector: '.price' },
      ];

      const result = findPriceConsensus(candidates);
      // Winner is selected as best guess, but consensus is false because weight 0.2 < 1.0
      expect(result.hasConsensus).toBe(false);
      expect(result.price?.price).toBe(19.99);
    });

    it('correctly partitions member and original prices while computing primary consensus', () => {
      const candidates: PriceCandidate[] = [
        { price: 79.99, currency: 'USD', method: 'custom-css', selector: '.sale' },
        { price: 69.99, currency: 'USD', method: 'member-price', selector: '.member' },
        { price: 99.99, currency: 'USD', method: 'original-price', selector: '.strike' },
      ];

      const result = findPriceConsensus(candidates);
      expect(result.hasConsensus).toBe(true);
      expect(result.price?.price).toBe(79.99);
      expect(result.memberPrice?.price).toBe(69.99);
      expect(result.originalPrice?.price).toBe(99.99);
    });

    it('returns empty consensus payload for empty candidate input', () => {
      const result = findPriceConsensus([]);
      expect(result.hasConsensus).toBe(false);
      expect(result.price).toBeNull();
      expect(result.memberPrice).toBeNull();
      expect(result.originalPrice).toBeNull();
    });
  });
});
