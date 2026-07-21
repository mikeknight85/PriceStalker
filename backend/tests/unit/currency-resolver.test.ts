import { describe, it, expect, vi } from 'vitest';
import { currencyResolver } from '../../src/utils/i18n/currency/resolver';

vi.mock('../../src/utils/i18n/currency/cache', () => ({
  currencyCache: {
    getRegionalMappings: vi.fn().mockResolvedValue([
      { pattern: '.co.uk', currency: 'GBP', match_type: 'tld', active: true },
      { pattern: '/de/', currency: 'EUR', match_type: 'path', active: true }
    ]),
    getGlobalCurrencies: vi.fn().mockResolvedValue([
      { locale: 'en_AU', iso: 'AUD', symbol: '$' },
      { locale: 'en_US', iso: 'USD', symbol: '$' },
      { locale: 'en_GB', iso: 'GBP', symbol: '£' },
      { locale: 'de_DE', iso: 'EUR', symbol: '€' },
      { locale: 'zh_Hans_MO', iso: 'CNY', symbol: '¥' },
      { locale: 'ja_JP', iso: 'JPY', symbol: '¥' }
    ])
  }
}));

describe('CurrencyResolver Unit Tests', () => {
  it('should prioritize currencyHint over URL and HTML scans', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'https://example.co.uk/product-123',
      '<html lang="de"></html>',
      'en-US',
      'USD',
      'CNY'
    );
    expect(result.currency).toBe('CNY');
    expect(result.locale).toBe('zh-Hans-MO'); // CNY matches zh_Hans_MO
  });

  it('should resolve from TLD mapping when no currencyHint is provided', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'https://example.co.uk/product-123',
      '<html lang="de"></html>',
      'en-US',
      'USD'
    );
    expect(result.currency).toBe('GBP');
    expect(result.locale).toBe('en-GB'); // resolved from TLD match GBP
  });

  it('should resolve from Path mapping when no TLD matches', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'https://example.com/de/product-123',
      '<html lang="de"></html>',
      'en-US',
      'USD'
    );
    expect(result.currency).toBe('EUR');
    expect(result.locale).toBe('de-DE'); // resolved from path match EUR
  });

  it('should resolve from HTML lang attribute when no URL mappings match', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'https://example.com/product-123',
      '<html lang="ja"></html>',
      'en-US',
      'USD'
    );
    expect(result.currency).toBe('JPY');
    expect(result.locale).toBe('ja'); // retains original scanned lang attribute
  });

  it('should fall back to user preferences or defaults', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'https://example.com/product-123',
      undefined,
      'en-US',
      'USD'
    );
    expect(result.currency).toBe('USD');
    expect(result.locale).toBe('en-US');
  });

  it('should handle malformed URLs gracefully and return default fallback', async () => {
    const result = await currencyResolver.resolveLocaleAndCurrency(
      'invalid-url-string',
      undefined,
      'en-US',
      'USD'
    );
    expect(result.currency).toBe('USD');
    expect(result.locale).toBe('en-US');
  });
});
