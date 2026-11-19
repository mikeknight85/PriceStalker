import { describe, it, expect } from 'vitest';
import { validateSelector } from '../../src/services/ai/strategies/retailer-config';

describe('Retailer Selector Validation Unit Tests', () => {
  const url = 'https://www.amazon.com.au/dp/B0F21CJGNG';

  it('rejects bare single tags', () => {
    expect(validateSelector('span', url)).toBe(false);
    expect(validateSelector('div', url)).toBe(false);
    expect(validateSelector('p', url)).toBe(false);
  });

  it('rejects hashed CSS-in-JS classes', () => {
    expect(validateSelector('.styled-a1b2c3d', url)).toBe(false);
    expect(validateSelector('div.css-x9y8z7', url)).toBe(false);
  });

  it('rejects bare un-scoped utility classes like .a-offscreen and .sr-only (issue #236)', () => {
    expect(validateSelector('.a-offscreen', url)).toBe(false);
    expect(validateSelector('span.a-offscreen', url)).toBe(false);
    expect(validateSelector('.sr-only', url)).toBe(false);
    expect(validateSelector('span.visually-hidden', url)).toBe(false);
    expect(validateSelector('.screen-reader-text', url)).toBe(false);
  });

  it('accepts properly scoped selectors even when they include .a-offscreen or tags', () => {
    expect(validateSelector('.apex-pricetopay-value .a-offscreen', url)).toBe(true);
    expect(validateSelector('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen', url)).toBe(true);
    expect(validateSelector('.priceToPay .a-offscreen', url)).toBe(true);
    expect(validateSelector('span[itemprop="price"]', url)).toBe(true);
    expect(validateSelector('#productTitle', url)).toBe(true);
  });

  it('rejects invalid CSS selector syntax', () => {
    expect(validateSelector('div[unclosed-bracket', url)).toBe(false);
    expect(validateSelector('///invalid', url)).toBe(false);
  });
});
