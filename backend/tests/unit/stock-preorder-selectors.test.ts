import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { checkPreOrderPriceSelectors } from '../../src/services/scraper/extractors/stock/pre-order';

describe('Pre-Order Price Selector Stock Extraction', () => {
  it('returns empty array when preOrderPriceSelectors list is empty', () => {
    const $ = cheerio.load('<div class="preorder-badge">Pre-order now</div>');
    expect(checkPreOrderPriceSelectors($, [])).toEqual([]);
  });

  it('produces high-confidence (0.96) pre_order candidate when selector matches', () => {
    const html = `
      <div class="product-actions">
        <button class="btn-preorder">Pre-Order for May Release</button>
      </div>
    `;
    const $ = cheerio.load(html);
    const candidates = checkPreOrderPriceSelectors($, ['.btn-preorder']);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      value: 'pre_order',
      method: 'pre-order-price-selector',
      selector: '.btn-preorder',
      confidence: 0.96,
    });
  });

  it('supports selector suffix modifiers via parseSelector', () => {
    const html = `<span id="order-type" data-type="preorder">Deposit</span>`;
    const $ = cheerio.load(html);
    const candidates = checkPreOrderPriceSelectors($, ['#order-type::attr(data-type)']);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].selector).toBe('#order-type::attr(data-type)');
    expect(candidates[0].value).toBe('pre_order');
  });

  it('returns empty array when selector does not match elements in DOM', () => {
    const html = `<button class="btn-buy-now">Buy Now</button>`;
    const $ = cheerio.load(html);
    const candidates = checkPreOrderPriceSelectors($, ['.non-existent-preorder']);

    expect(candidates).toEqual([]);
  });

  it('safely skips invalid or malformed selectors without throwing', () => {
    const html = `<div class="preorder">Pre-order</div>`;
    const $ = cheerio.load(html);
    const candidates = checkPreOrderPriceSelectors($, [':::invalid[[[selector', '.preorder']);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].selector).toBe('.preorder');
  });
});
