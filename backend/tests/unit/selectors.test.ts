import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { parseSelector, normalizeSelector, isNoiseElement } from '../../src/services/scraper/core/selectors';

describe('selectors.ts Unit Tests', () => {
  describe('normalizeSelector', () => {
    it('should convert legacy | attribute syntax to standard scrapy ::attr format', () => {
      expect(normalizeSelector('div.price|content')).toBe('div.price::attr(content)');
      expect(normalizeSelector('span.price|data-val')).toBe('span.price::attr(data-val)');
    });

    it('should pass standard selectors through unchanged', () => {
      expect(normalizeSelector('div.price')).toBe('div.price');
      expect(normalizeSelector('.a-price span::attr(class)')).toBe('.a-price span::attr(class)');
    });

    it('should ignore regex selectors wrapped in ~', () => {
      expect(normalizeSelector('~\\$[\\d\\.]+~')).toBe('~\\$[\\d\\.]+~');
    });

    it('should ignore html selectors starting with !', () => {
      expect(normalizeSelector('!.product-price')).toBe('!.product-price');
    });
  });

  describe('parseSelector', () => {
    it('should parse standard CSS selector', () => {
      const parsed = parseSelector('div.price');
      expect(parsed.realSelector).toBe('div.price');
      expect(parsed.method).toBe('text');
      expect(parsed.attribute).toBeUndefined();
      expect(parsed.modifier).toBeNull();
    });

    it('should parse scrapy ::attr syntax', () => {
      const parsed = parseSelector('div.price::attr(data-val)');
      expect(parsed.realSelector).toBe('div.price');
      expect(parsed.method).toBe('attr');
      expect(parsed.attribute).toBe('data-val');
      expect(parsed.modifier).toBeNull();
    });

    it('should parse legacy pipe syntax', () => {
      const parsed = parseSelector('div.price|data-val');
      expect(parsed.realSelector).toBe('div.price');
      expect(parsed.method).toBe('attr');
      expect(parsed.attribute).toBe('data-val');
      expect(parsed.modifier).toBeNull();
    });

    it('should parse outer HTML prefix !', () => {
      const parsed = parseSelector('!.product-price');
      expect(parsed.realSelector).toBe('.product-price');
      expect(parsed.method).toBe('html');
      expect(parsed.attribute).toBeUndefined();
      expect(parsed.modifier).toBeNull();
    });

    it('should parse suffix modifier syntax with equals', () => {
      const parsed = parseSelector('form#form1::attr(data-preorder)::equals(true)->pre_order');
      expect(parsed.realSelector).toBe('form#form1');
      expect(parsed.method).toBe('attr');
      expect(parsed.attribute).toBe('data-preorder');
      expect(parsed.modifier).toEqual({
        type: 'equals',
        value: 'true',
        targetStatus: 'pre_order'
      });
    });

    it('should parse suffix modifier syntax with contains', () => {
      const parsed = parseSelector('.status-text::contains(sold out)->out_of_stock');
      expect(parsed.realSelector).toBe('.status-text');
      expect(parsed.method).toBe('text');
      expect(parsed.attribute).toBeUndefined();
      expect(parsed.modifier).toEqual({
        type: 'contains',
        value: 'sold out',
        targetStatus: 'out_of_stock'
      });
    });
  });

  describe('isNoiseElement', () => {
    it('should return true if the element itself has noise classes or IDs', () => {
      const html = `<div class="recommended-items-list">Item</div>`;
      const $ = cheerio.load(html);
      const el = $('div').get(0);
      expect(isNoiseElement(el, $)).toBe(true);
    });

    it('should return true if parent ancestor is a noise element', () => {
      const html = `
        <div class="product-carousel">
          <div class="product-item">
            <span class="price">$19.99</span>
          </div>
        </div>
      `;
      const $ = cheerio.load(html);
      const el = $('span.price').get(0);
      expect(isNoiseElement(el, $)).toBe(true);
    });

    it('should traverse up to 10 levels and catch noise ancestors', () => {
      const html = `
        <div id="sponsored-products">
          <div><div><div><div><div><div><div><div><div>
            <span class="price">$5.00</span>
          </div></div></div></div></div></div></div></div></div>
        </div>
      `;
      const $ = cheerio.load(html);
      const el = $('span.price').get(0);
      expect(isNoiseElement(el, $)).toBe(true);
    });

    it('should return false for clean standard elements', () => {
      const html = `
        <div class="pdp-container">
          <main class="product-details">
            <h1 class="product-title">Product Name</h1>
            <span class="price">$99.99</span>
          </main>
        </div>
      `;
      const $ = cheerio.load(html);
      const el = $('span.price').get(0);
      expect(isNoiseElement(el, $)).toBe(false);
    });
  });
});
