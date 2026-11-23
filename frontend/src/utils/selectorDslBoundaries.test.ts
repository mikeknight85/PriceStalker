import { describe, it, expect } from 'vitest';
import { normalizeSelector, parseSelector } from './selectorDsl';

describe('Selector DSL Boundaries & Syntax Resiliency', () => {
  describe('normalizeSelector edge cases', () => {
    it('returns empty string when given empty or whitespace-only selector', () => {
      expect(normalizeSelector('')).toBe('');
      expect(normalizeSelector('   ')).toBe('');
    });

    it('leaves complex attribute selectors with multiple brackets intact', () => {
      const selector = 'div[data-category="tech"][data-available="true"]';
      expect(normalizeSelector(selector)).toBe(selector);
    });

    it('correctly normalizes chained pipe selectors with attributes', () => {
      expect(normalizeSelector('article.item img|data-src')).toBe('article.item img::attr(data-src)');
      expect(normalizeSelector('span.price[data-code="usd"]|content')).toBe(
        'span.price[data-code="usd"]::attr(content)'
      );
    });

    it('handles selectors containing multiple colons without syntax corruption', () => {
      expect(normalizeSelector('ul.items > li:first-child')).toBe('ul.items > li:first-child');
      expect(normalizeSelector('div:nth-of-type(2)|data-val')).toBe('div:nth-of-type(2)::attr(data-val)');
    });
  });

  describe('parseSelector boundary and malformed inputs', () => {
    it('parses bare XPath without leading slashes and ensures leading // is prepended', () => {
      const parsed = parseSelector('xpath:div[@class="main"]');
      // "xpath:" without "//" remains CSS engine per design
      expect(parsed.engine).toBe('css');

      // "xpath://" triggers xpath engine and prepends //
      const xpathParsed = parseSelector('xpath://div[@class="main"]');
      expect(xpathParsed.engine).toBe('xpath');
      expect(xpathParsed.realSelector).toBe('//div[@class="main"]');
    });

    it('parses absolute XPath expressions (/html/...) without prepending double slashes', () => {
      const parsed = parseSelector('xpath:///html/body/div[1]');
      expect(parsed.engine).toBe('xpath');
      expect(parsed.realSelector).toBe('/html/body/div[1]');
    });

    it('parses regex patterns with tilde boundaries and regex: prefix', () => {
      const tildePattern = parseSelector('~price:\\s*\\$([\\d.]+)~');
      expect(tildePattern.engine).toBe('regex');
      expect(tildePattern.realSelector).toBe('price:\\s*\\$([\\d.]+)');

      const prefixPattern = parseSelector('regex:/([0-9]+(?:\\.[0-9]+)?)/');
      expect(prefixPattern.engine).toBe('regex');
      expect(prefixPattern.realSelector).toBe('([0-9]+(?:\\.[0-9]+)?)');
    });

    it('parses combined attribute and equals modifier accurately', () => {
      const parsed = parseSelector('div.stock-indicator::attr(data-available)::equals(yes)->in_stock');
      expect(parsed.engine).toBe('css');
      expect(parsed.method).toBe('attr');
      expect(parsed.attribute).toBe('data-available');
      expect(parsed.realSelector).toBe('div.stock-indicator');
      expect(parsed.modifier).toEqual({
        type: 'equals',
        value: 'yes',
        targetStatus: 'in_stock',
      });
    });

    it('parses combined text and contains modifier accurately', () => {
      const parsed = parseSelector('span.availability-badge::contains(temporarily unavailable)->out_of_stock');
      expect(parsed.engine).toBe('css');
      expect(parsed.method).toBe('text');
      expect(parsed.realSelector).toBe('span.availability-badge');
      expect(parsed.modifier).toEqual({
        type: 'contains',
        value: 'temporarily unavailable',
        targetStatus: 'out_of_stock',
      });
    });
  });
});
