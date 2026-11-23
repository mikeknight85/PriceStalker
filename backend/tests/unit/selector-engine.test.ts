import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { evaluateSelector } from '../../src/services/scraper/core/engine';

describe('Selector Engine (evaluateSelector) - Failure Paths & Multi-Engine Execution', () => {
  const sampleHtml = `
    <html>
      <body>
        <div id="product-card">
          <h1 class="title">Wireless Noise-Cancelling Headphones</h1>
          <div class="price-container" data-price="299.99" data-stock="in_stock">
            <span class="currency">$</span>
            <span class="amount">299.99</span>
            <span class="old-price">349.99</span>
          </div>
          <div class="availability" data-status="available">In Stock - Ready to Ship</div>
          <div class="bundle-notice">Bundle includes case & cable</div>
        </div>
        <div class="footer">
          <p>Contact support for deals</p>
        </div>
      </body>
    </html>
  `;

  const $ = cheerio.load(sampleHtml);

  describe('CSS Engine', () => {
    it('evaluates standard CSS selector for element text', () => {
      const results = evaluateSelector($, sampleHtml, 'h1.title');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('Wireless Noise-Cancelling Headphones');
    });

    it('evaluates CSS ::attr() extraction', () => {
      const results = evaluateSelector($, sampleHtml, '.price-container::attr(data-price)');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('299.99');
    });

    it('evaluates CSS html extraction (! prefix)', () => {
      const results = evaluateSelector($, sampleHtml, '!.amount');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('299.99');
    });

    it('returns empty array when CSS selector matches nothing', () => {
      const results = evaluateSelector($, sampleHtml, '.non-existent-class');
      expect(results).toEqual([]);
    });

    it('applies ::equals status modifier accurately', () => {
      const match = evaluateSelector(
        $,
        sampleHtml,
        '.availability::attr(data-status)::equals(available)->in_stock'
      );
      expect(match).toHaveLength(1);
      expect(match[0].status).toBe('in_stock');
      expect(match[0].value).toBe('available');

      const nonMatch = evaluateSelector(
        $,
        sampleHtml,
        '.availability::attr(data-status)::equals(backordered)->pre_order'
      );
      expect(nonMatch).toHaveLength(0);
    });

    it('applies ::contains status modifier accurately', () => {
      const match = evaluateSelector(
        $,
        sampleHtml,
        '.availability::contains(Ready to Ship)->in_stock'
      );
      expect(match).toHaveLength(1);
      expect(match[0].status).toBe('in_stock');

      const nonMatch = evaluateSelector(
        $,
        sampleHtml,
        '.availability::contains(Sold Out)->out_of_stock'
      );
      expect(nonMatch).toHaveLength(0);
    });
  });

  describe('XPath Engine', () => {
    it('evaluates XPath queries for element text', () => {
      const results = evaluateSelector($, sampleHtml, 'xpath://h1[@class="title"]');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('Wireless Noise-Cancelling Headphones');
    });

    it('evaluates XPath queries targeting attributes', () => {
      const results = evaluateSelector(
        $,
        sampleHtml,
        'xpath://div[@id="product-card"]/div[contains(@class, "price-container")]::attr(data-price)'
      );
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('299.99');
    });

    it('gracefully handles malformed XPath without throwing unhandled exceptions', () => {
      // Invalid XPath syntax (missing closing bracket, invalid operators)
      expect(() =>
        evaluateSelector($, sampleHtml, 'xpath://div[@class="unclosed')
      ).not.toThrow();

      const results = evaluateSelector($, sampleHtml, 'xpath://div[@class="unclosed');
      expect(results).toEqual([]);
    });
  });

  describe('Regex Engine', () => {
    it('evaluates regex pattern with capture group on denoised HTML', () => {
      const results = evaluateSelector($, sampleHtml, '~data-price="([^"]+)"~');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('299.99');
    });

    it('evaluates regex:/pattern/ syntax on denoised HTML', () => {
      const results = evaluateSelector($, sampleHtml, 'regex:/data-price="([^"]+)"/');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('299.99');
    });

    it('handles non-matching regex returning empty array', () => {
      const results = evaluateSelector($, sampleHtml, '~not-matching-pattern-(\\d+)~');
      expect(results).toEqual([]);
    });
  });
});
