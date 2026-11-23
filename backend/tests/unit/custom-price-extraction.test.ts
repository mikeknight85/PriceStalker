import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractCustomCandidates } from '../../src/services/scraper/extractors/custom-prices';
import { evaluatePriceSelectors } from '../../src/services/scraper/extractors/price-utils';

describe('Custom Price Extraction & evaluatePriceSelectors', () => {
  describe('extractCustomCandidates', () => {
    it('returns empty array when selectors is null, undefined, or empty', () => {
      const $ = cheerio.load('<html><body><span class="price">$19.99</span></body></html>');
      expect(extractCustomCandidates($, [])).toEqual([]);
      expect(extractCustomCandidates($, null as any)).toEqual([]);
      expect(extractCustomCandidates($, undefined as any)).toEqual([]);
    });

    it('extracts price candidate from CSS selector with custom-css method and 0.9 confidence', () => {
      const html = `
        <div class="product">
          <span class="main-price">$149.99</span>
        </div>
      `;
      const $ = cheerio.load(html);
      const candidates = extractCustomCandidates($, ['.main-price'], html);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        price: 149.99,
        currency: 'USD',
        method: 'custom-css',
        confidence: 0.9,
        selector: '.main-price',
        context: '$149.99',
      });
    });

    it('caps candidates at 40 to prevent flooding consensus from generic selectors', () => {
      // Create 100 price elements
      let elements = '';
      for (let i = 1; i <= 100; i++) {
        elements += `<span class="price-item">$${i}.00</span>\n`;
      }
      const html = `<div class="catalog">${elements}</div>`;
      const $ = cheerio.load(html);

      const candidates = extractCustomCandidates($, ['.price-item'], html);
      // Strictly bounded at 40
      expect(candidates).toHaveLength(40);
      expect(candidates[0].price).toBe(1);
      expect(candidates[39].price).toBe(40);
    });

    it('passes currency and locale hints to price parser', () => {
      const html = `<span class="german-price">1.249,50 €</span>`;
      const $ = cheerio.load(html);

      const candidates = extractCustomCandidates($, ['.german-price'], html, 'EUR', 'de-DE');
      expect(candidates).toHaveLength(1);
      expect(candidates[0].price).toBe(1249.5);
      expect(candidates[0].currency).toBe('EUR');
    });

    it('survives an invalid selector without throwing and continues to subsequent selectors', () => {
      const html = `<span class="valid-price">$79.00</span>`;
      const $ = cheerio.load(html);

      // Pass an invalid CSS selector followed by a valid one
      const candidates = extractCustomCandidates($, [':::invalid[[[selector', '.valid-price'], html);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].price).toBe(79);
    });
  });

  describe('evaluatePriceSelectors direct boundary checks', () => {
    it('truncates context string to at most 50 characters', () => {
      const longContext = 'Special promotional price available for a limited time only: $49.99 right now!';
      const html = `<div class="promo-text">${longContext}</div>`;
      const $ = cheerio.load(html);

      const candidates = evaluatePriceSelectors($, ['.promo-text'], 'custom-test', 0.8, undefined, undefined, 10, false, html);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].context.length).toBeLessThanOrEqual(50);
      expect(candidates[0].context).toBe(longContext.substring(0, 50));
    });

    it('extracts positive prices and respects requirePositive parameter', () => {
      const html = `
        <span class="unparseable">$0.00</span>
        <span class="real-price">$25.00</span>
      `;
      const $ = cheerio.load(html);

      const candidatesWithPositive = evaluatePriceSelectors(
        $,
        ['.unparseable', '.real-price'],
        'test-method',
        0.8,
        undefined,
        undefined,
        10,
        true, // requirePositive = true
        html
      );

      expect(candidatesWithPositive).toHaveLength(1);
      expect(candidatesWithPositive[0].price).toBe(25);
    });

    it('handles attribute selector e.g. meta[itemprop="price"]::attr(content)', () => {
      const html = `<meta itemprop="price" content="299.95">`;
      const $ = cheerio.load(html);

      const candidates = evaluatePriceSelectors(
        $,
        ['meta[itemprop="price"]::attr(content)'],
        'meta-attr',
        0.95,
        'USD',
        undefined,
        10,
        true,
        html
      );

      expect(candidates).toHaveLength(1);
      expect(candidates[0].price).toBe(299.95);
      expect(candidates[0].method).toBe('meta-attr');
      expect(candidates[0].confidence).toBe(0.95);
    });
  });
});
