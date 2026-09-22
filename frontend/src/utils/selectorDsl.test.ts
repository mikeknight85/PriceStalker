import { describe, it, expect } from 'vitest';
import { normalizeSelector, parseSelector } from './selectorDsl';

describe('normalizeSelector', () => {
  it('converts the legacy pipe form to ::attr()', () => {
    expect(normalizeSelector('div.price|content')).toBe('div.price::attr(content)');
    expect(normalizeSelector('span.price|data-val')).toBe('span.price::attr(data-val)');
  });

  it('keeps a CSS attribute selector that contains a pipe intact', () => {
    // The corruption this guards against: `[lang::attr(="en"])`, which is not
    // valid CSS and matches nothing.
    expect(normalizeSelector('span[lang|="en"]')).toBe('span[lang|="en"]');
    expect(normalizeSelector('[svg|href]')).toBe('[svg|href]');
  });

  it('still splits a pipe that follows an attribute selector', () => {
    expect(normalizeSelector('meta[itemprop="price"]|content'))
      .toBe('meta[itemprop="price"]::attr(content)');
  });

  it('passes standard selectors through unchanged', () => {
    expect(normalizeSelector('div.price')).toBe('div.price');
    expect(normalizeSelector('.a-price span::attr(class)')).toBe('.a-price span::attr(class)');
  });

  it('leaves regex and html rules alone', () => {
    expect(normalizeSelector('~\\$[\\d\\.]+~')).toBe('~\\$[\\d\\.]+~');
    expect(normalizeSelector('!.product-price')).toBe('!.product-price');
  });
});

describe('parseSelector', () => {
  it('parses a plain CSS selector', () => {
    expect(parseSelector('div.price')).toEqual({
      realSelector: 'div.price', method: 'text', engine: 'css', modifier: null
    });
  });

  it('parses the scrapy ::attr() form', () => {
    const parsed = parseSelector('meta[itemprop="price"]::attr(content)');
    expect(parsed.realSelector).toBe('meta[itemprop="price"]');
    expect(parsed.method).toBe('attr');
    expect(parsed.attribute).toBe('content');
  });

  it('parses the legacy pipe form', () => {
    const parsed = parseSelector('div.price|data-val');
    expect(parsed.realSelector).toBe('div.price');
    expect(parsed.method).toBe('attr');
    expect(parsed.attribute).toBe('data-val');
  });

  it('does not treat a CSS dashmatch as the legacy pipe form', () => {
    const parsed = parseSelector('span[lang|="en"]');
    expect(parsed.realSelector).toBe('span[lang|="en"]');
    expect(parsed.method).toBe('text');
    expect(parsed.attribute).toBeUndefined();
  });

  it('parses the raw-HTML prefix', () => {
    const parsed = parseSelector('!.product-price');
    expect(parsed.realSelector).toBe('.product-price');
    expect(parsed.method).toBe('html');
  });

  it('parses XPath and prepends // when the path is bare', () => {
    // The `xpath://` prefix is consumed whole, so what follows is a bare path
    // and gets `//` put back in front of it.
    expect(parseSelector('xpath://div[@id="price"]')).toEqual({
      realSelector: '//div[@id="price"]', method: 'text', engine: 'xpath', modifier: null
    });
    expect(parseSelector('xpath:///html/body/span').realSelector).toBe('/html/body/span');
  });

  it('treats a selector without the full xpath:// prefix as CSS', () => {
    // Only `xpath://` switches engines; `xpath:` alone does not.
    expect(parseSelector('xpath:span').engine).toBe('css');
  });

  it('parses both regex forms', () => {
    expect(parseSelector('regex:/price: ([0-9.]+)/')).toEqual({
      realSelector: 'price: ([0-9.]+)', method: 'text', engine: 'regex', modifier: null
    });
    expect(parseSelector('~[0-9.]+~').engine).toBe('regex');
    expect(parseSelector('~[0-9.]+~').realSelector).toBe('[0-9.]+');
  });

  it('parses suffix modifiers', () => {
    const equals = parseSelector('form#form1::attr(data-preorder)::equals(true)->pre_order');
    expect(equals.realSelector).toBe('form#form1');
    expect(equals.method).toBe('attr');
    expect(equals.attribute).toBe('data-preorder');
    expect(equals.modifier).toEqual({ type: 'equals', value: 'true', targetStatus: 'pre_order' });

    const contains = parseSelector('.status-text::contains(sold out)->out_of_stock');
    expect(contains.realSelector).toBe('.status-text');
    expect(contains.method).toBe('text');
    expect(contains.modifier).toEqual({
      type: 'contains', value: 'sold out', targetStatus: 'out_of_stock'
    });
  });
});
