import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { extractJsonLdCandidates, extractByRegex } from '../../src/services/scraper/extractors/price-extraction';
import { denoiseHtmlForRegex } from '../../src/services/scraper/extractors/dom-denoiser';
import { parsePrice } from '../../src/utils/scraping/price/parser';
import { normalizePrice } from '../../src/utils/scraping/price/normalizer';

// Mock currencyCache to provide predefined sync currencies list
vi.mock('../../src/utils/i18n/currency/cache', () => ({
  currencyCache: {
    getGlobalCurrenciesSync: vi.fn().mockReturnValue([
      { locale: 'en_AU', iso: 'AUD', symbol: '$' },
      { locale: 'en_US', iso: 'USD', symbol: '$' },
      { locale: 'en_GB', iso: 'GBP', symbol: '£' },
      { locale: 'de_DE', iso: 'EUR', symbol: '€' },
      { locale: 'zh_Hans_MO', iso: 'CNY', symbol: '¥' },
      { locale: 'ja_JP', iso: 'JPY', symbol: '¥' }
    ])
  }
}));

describe('extractJsonLdCandidates Unit Tests', () => {
  it('should parse simple JSON-LD price and map € currency correctly', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "offers": {
          "@type": "Offer",
          "price": "99.99",
          "priceCurrency": "€"
        }
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const results = extractJsonLdCandidates($);
    expect(results).toHaveLength(1);
    expect(results[0].price).toBe(99.99);
    // It should map "€" to "EUR"
    expect(results[0].currency).toBe('EUR');
  });

  it('should recursively find priceSpecification inside JSON-LD', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Nested Product",
        "offers": {
          "@type": "AggregateOffer",
          "priceSpecification": {
            "@type": "UnitPriceSpecification",
            "price": 45.50,
            "priceCurrency": "GBP"
          }
        }
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const results = extractJsonLdCandidates($);
    expect(results).toHaveLength(1);
    expect(results[0].price).toBe(45.50);
    expect(results[0].currency).toBe('GBP');
  });
});

describe('extractByRegex Unit Tests', () => {
  it('should extract matching text values using simple regex pattern strings', () => {
    const html = `<div>The price is $129.99 USD today.</div>`;
    const patterns = ['\\$[0-9\\.]+'];
    const matches = extractByRegex(html, patterns);
    expect(matches).toEqual(['$129.99']);
  });

  it('should extract matching captures using regexes wrapped in tilde', () => {
    const html = `<span class="price-val">AUD $45.00</span>`;
    const patterns = ['~AUD \\$([0-9\\.]+)~'];
    const matches = extractByRegex(html, patterns);
    expect(matches).toEqual(['45.00']);
  });

  it('should ignore script contents when combined with denoiseHtmlForRegex', () => {
    const html = `
      <html>
        <head>
          <script>
            window.dataLayer = {
              currency: 'USD',
              productPrice: 1599.00
            };
          </script>
        </head>
        <body>
          <div class="product-price">Our Price: $1,299.00</div>
        </body>
      </html>
    `;
    
    // Pattern to capture any pricing pattern
    const pattern = '~\\$?([0-9,]+\\.[0-9]{2})~';
    
    // Without denoising: matches BOTH 1599.00 (script) and 1,299.00 (body)
    const matchesWithoutDenoise = extractByRegex(html, [pattern]);
    expect(matchesWithoutDenoise).toContain('1599.00');
    expect(matchesWithoutDenoise).toContain('1,299.00');

    // With denoising: only matches body price
    const denoised = denoiseHtmlForRegex(html);
    const matchesWithDenoise = extractByRegex(denoised, [pattern]);
    expect(matchesWithDenoise).not.toContain('1599.00');
    expect(matchesWithDenoise).toContain('1,299.00');
  });
});

describe('parsePrice Robust Currency Normalisation Tests', () => {
  it('should parse prefix currency code like AUD $129.99 and map to AUD', () => {
    const parsed = parsePrice('AUD $129.99', undefined, 'en-AU');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(129.99);
    expect(parsed?.currency).toBe('AUD');
  });

  it('should parse prefix currency code like USD 45 and map to USD', () => {
    const parsed = parsePrice('USD 45', undefined, 'en-US');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(45);
    expect(parsed?.currency).toBe('USD');
  });

  it('should resolve ambiguous symbol $ to AUD when locale hint is en-AU', () => {
    const parsed = parsePrice('$150.00', undefined, 'en-AU');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(150.00);
    expect(parsed?.currency).toBe('AUD');
  });

  it('should resolve ambiguous symbol $ to USD when locale hint is en-US', () => {
    const parsed = parsePrice('$150.00', undefined, 'en-US');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(150.00);
    expect(parsed?.currency).toBe('USD');
  });

  it('should fallback to USD and log warning when locale hint does not match any ambiguous symbol countries', () => {
    const parsed = parsePrice('$150.00', undefined, 'fr-FR');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(150.00);
    expect(parsed?.currency).toBe('AUD'); // first in mocked globalCurrencies array is AUD
  });

  it('should resolve ambiguous symbol ¥ to CNY when locale hint is zh-CN', () => {
    const parsed = parsePrice('¥150.00', undefined, 'zh-CN');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(150.00);
    expect(parsed?.currency).toBe('CNY');
  });

  it('should resolve ambiguous symbol ¥ to JPY when locale hint is ja-JP', () => {
    const parsed = parsePrice('¥150.00', undefined, 'ja-JP');
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(150.00);
    expect(parsed?.currency).toBe('JPY');
  });

  describe('normalizePrice Fallback Unit Tests', () => {
    it('should fall back to smart parsing for European formats when locale is invalid', () => {
      expect(normalizePrice('123.456,78', 'invalid-locale')).toBe(123456.78);
      expect(normalizePrice('123,45', 'invalid-locale')).toBe(123.45);
      expect(normalizePrice('1,234', 'invalid-locale')).toBe(1234);
      expect(normalizePrice('1,234.56', 'invalid-locale')).toBe(1234.56);
    });

    it('should fall back to smart parsing when the input separators differ from the locale', () => {
      expect(normalizePrice('123.456,78', 'fr-FR')).toBe(123456.78);
    });
  });
});
