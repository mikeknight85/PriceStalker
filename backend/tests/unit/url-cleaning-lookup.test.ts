import { describe, it, expect } from 'vitest';
import { cleanUrl, getUrlLookup } from '../../src/utils/scraping/urlHelper';
import { getRetailerDescription } from '../../src/utils/scraping/retailerHelper';

describe('URL Cleaning & Retailer Lookup Utilities', () => {
  describe('cleanUrl', () => {
    it('strips tracking and analytics query parameters from URLs', () => {
      const url = 'https://www.example.com/product/123?utm_source=google&utm_medium=cpc&fbclid=abc123xyz&ref=partner&gclid=g123&session=999';
      const cleaned = cleanUrl(url);
      expect(cleaned).toBe('https://www.example.com/product/123');
    });

    it('preserves essential product identifiers, store, and variant query parameters', () => {
      const url = 'https://shop.example.com/item?sku=SKU-9901&color=midnight_blue&size=XL&store=syd01&currency=AUD&locale=en-AU&utm_campaign=winter_sale';
      const cleaned = cleanUrl(url);
      expect(cleaned).toContain('sku=SKU-9901');
      expect(cleaned).toContain('color=midnight_blue');
      expect(cleaned).toContain('size=XL');
      expect(cleaned).toContain('store=syd01');
      expect(cleaned).toContain('currency=AUD');
      expect(cleaned).toContain('locale=en-AU');
      expect(cleaned).not.toContain('utm_campaign');
    });

    it('preserves demandware dwvar_ and custom pid variants', () => {
      const url = 'https://www.brand.com/p/shoes?dwvar_color=black&selectedColor=01&pid=B0912&affiliate=blog';
      const cleaned = cleanUrl(url);
      expect(cleaned).toContain('dwvar_color=black');
      expect(cleaned).toContain('selectedColor=01');
      expect(cleaned).toContain('pid=B0912');
      expect(cleaned).not.toContain('affiliate=blog');
    });

    it('trims trailing slash from non-root pathname but keeps root slash', () => {
      const withTrailing = 'https://shop.example.com/category/product-slug/';
      expect(cleanUrl(withTrailing)).toBe('https://shop.example.com/category/product-slug');

      const rootUrl = 'https://shop.example.com/';
      expect(cleanUrl(rootUrl)).toBe('https://shop.example.com/');
    });

    it('strips non-essential hash fragments but retains essential variant hashes', () => {
      const withJunkHash = 'https://shop.example.com/p/123#tab-description';
      expect(cleanUrl(withJunkHash)).toBe('https://shop.example.com/p/123');

      const withVariantHash = 'https://shop.example.com/p/123#variant=silver';
      expect(cleanUrl(withVariantHash)).toBe('https://shop.example.com/p/123#variant=silver');

      const withPidHash = 'https://shop.example.com/p/123#pid_8899';
      expect(cleanUrl(withPidHash)).toBe('https://shop.example.com/p/123#pid_8899');
    });

    it('gracefully returns the original string for invalid or unparseable URLs without crashing', () => {
      expect(cleanUrl('')).toBe('');
      expect(cleanUrl('not-a-valid-url')).toBe('not-a-valid-url');
      expect(cleanUrl('://malformed-scheme')).toBe('://malformed-scheme');
    });
  });

  describe('getUrlLookup', () => {
    it('normalizes domain and path for consistent lookup matching', () => {
      expect(getUrlLookup('https://www.Amazon.com/dp/B000123/')).toBe('amazon.com/dp/b000123');
      expect(getUrlLookup('http://SHOP.example.co.uk/Electronics/Laptops/')).toBe('shop.example.co.uk/electronics/laptops');
    });

    it('preserves hostname without www prefix and lowercases everything', () => {
      expect(getUrlLookup('https://digitec.ch/en/s1/product/1234')).toBe('digitec.ch/en/s1/product/1234');
      expect(getUrlLookup('https://WWW.GALAXUS.DE/P/5678/')).toBe('galaxus.de/p/5678');
    });

    it('falls back to lowercasing for unparseable URLs', () => {
      expect(getUrlLookup('NOT-A-URL')).toBe('not-a-url');
    });
  });

  describe('getRetailerDescription', () => {
    it('generates auto-discovered description for new retailers', () => {
      expect(getRetailerDescription(null, 'AI auto-mapping')).toBe('Auto-discovered via AI auto-mapping');
      expect(getRetailerDescription(undefined, 'heuristic match')).toBe('Auto-discovered via heuristic match');
    });

    it('generates auto-updated description when existing description starts with Auto-discovered or Auto-updated', () => {
      const existing1 = { description: 'Auto-discovered via standard search' };
      expect(getRetailerDescription(existing1, 'AI auto-mapping')).toBe('Auto-updated via AI auto-mapping');

      const existing2 = { description: 'Auto-updated via manual rescan' };
      expect(getRetailerDescription(existing2, 'consensus test')).toBe('Auto-updated via consensus test');
    });

    it('preserves custom manual descriptions entered by administrators', () => {
      const manual = { description: 'Custom selector set configured by Steven' };
      expect(getRetailerDescription(manual, 'AI auto-mapping')).toBe('Custom selector set configured by Steven');
    });
  });
});
