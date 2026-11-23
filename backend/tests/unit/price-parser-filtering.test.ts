import { describe, it, expect } from 'vitest';
import { parsePrice, findMostLikelyPrice } from '../../src/utils/scraping/price/parser';
import { ParsedPrice } from '../../src/utils/scraping/price/constants';

describe('Price Parser Installment Filtering & Most Likely Price Heuristics', () => {
  describe('Installment & Payment Deny List Filtering (parsePrice)', () => {
    it('rejects installment prices matching monthly patterns (/mo, per month, a month)', () => {
      expect(parsePrice('$19.99/mo')).toBeNull();
      expect(parsePrice('$49.00/mo')).toBeNull();
      expect(parsePrice('Only $29.99 per month for 24 months')).toBeNull();
      expect(parsePrice('$15.00 a month')).toBeNull();
      expect(parsePrice('Starting at $10.00 monthly payment')).toBeNull();
    });

    it('rejects multi-part payment plans (e.g. 4 payments of $25)', () => {
      expect(parsePrice('4 payments of $25.00')).toBeNull();
      expect(parsePrice('payments of $19.99')).toBeNull();
      expect(parsePrice('payments starting at $15')).toBeNull();
      expect(parsePrice('3 payment of $33.33')).toBeNull();
      expect(parsePrice('12 mo contract at $50')).toBeNull();
    });

    it('parses legitimate full prices that mention payment in normal product copy', () => {
      // Must not false-positive on words that merely contain "payment" without installment syntax
      const p1 = parsePrice('$249.99 one-time payment');
      expect(p1).not.toBeNull();
      expect(p1?.price).toBe(249.99);

      const p2 = parsePrice('Full payment: $899.00');
      expect(p2).not.toBeNull();
      expect(p2?.price).toBe(899.0);
    });

    it('returns null on empty, whitespace, or invalid text', () => {
      expect(parsePrice('')).toBeNull();
      expect(parsePrice('   ')).toBeNull();
      expect(parsePrice('No prices mentioned here')).toBeNull();
      expect(parsePrice('$0.00')).toBeNull();
    });
  });

  describe('findMostLikelyPrice Heuristics & Boundary Conditions', () => {
    it('returns null for empty candidate array', () => {
      expect(findMostLikelyPrice([])).toBeNull();
    });

    it('returns single candidate directly regardless of price', () => {
      const candidate: ParsedPrice = { price: 3.5, currency: 'USD' };
      expect(findMostLikelyPrice([candidate])).toBe(candidate);
    });

    it('filters out accessory prices (< $5) when a primary product price (>= $5) is available', () => {
      const candidates: ParsedPrice[] = [
        { price: 1.99, currency: 'USD' }, // Accessory / sticker
        { price: 3.5, currency: 'USD' },  // Shipping / addon
        { price: 49.99, currency: 'USD' }, // Real product
      ];

      const best = findMostLikelyPrice(candidates);
      expect(best).not.toBeNull();
      expect(best?.price).toBe(49.99);
    });

    it('falls back to lowest price when only low-threshold items ($2 to $5) exist', () => {
      const candidates: ParsedPrice[] = [
        { price: 4.5, currency: 'USD' },
        { price: 2.99, currency: 'USD' },
      ];

      const best = findMostLikelyPrice(candidates);
      expect(best).not.toBeNull();
      expect(best?.price).toBe(2.99);
    });

    it('falls back to candidate[0] when all candidates are below $2', () => {
      const candidates: ParsedPrice[] = [
        { price: 0.99, currency: 'USD' },
        { price: 1.5, currency: 'USD' },
      ];

      const best = findMostLikelyPrice(candidates);
      expect(best).not.toBeNull();
      expect(best?.price).toBe(0.99);
    });
  });
});
