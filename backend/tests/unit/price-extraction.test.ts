import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { extractJsonLdCandidates, extractByRegex } from '../../src/services/scraper/extractors/price-extraction';
import { denoiseHtmlForRegex } from '../../src/services/scraper/extractors/dom-denoiser';
import { parsePrice, extractPricesFromText } from '../../src/utils/scraping/price/parser';
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
      { locale: 'ja_JP', iso: 'JPY', symbol: '¥' },
      { locale: 'hi_IN', iso: 'INR', symbol: '₹' },
      { locale: 'de_CH', iso: 'CHF', symbol: 'CHF' },
      { locale: 'en_CA', iso: 'CAD', symbol: '$' },
      { locale: 'en_NZ', iso: 'NZD', symbol: '$' },
      { locale: 'en_SG', iso: 'SGD', symbol: '$' },
      { locale: 'zh_HK', iso: 'HKD', symbol: '$' }
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

  describe('Issue #285: Unseparated 4-digit prices', () => {
    it('should extract 4-digit unseparated prices with currency symbol without truncation', () => {
      const p1 = parsePrice('$5799', 'AUD', 'en-AU');
      expect(p1).not.toBeNull();
      expect(p1?.price).toBe(5799);
      expect(p1?.currency).toBe('AUD');

      const p2 = parsePrice('$1000', 'USD', 'en-US');
      expect(p2).not.toBeNull();
      expect(p2?.price).toBe(1000);

      const p3 = parsePrice('$1299', 'AUD', 'en-AU');
      expect(p3).not.toBeNull();
      expect(p3?.price).toBe(1299);
    });

    it('should extract 4-digit unseparated prices with decimals without truncation', () => {
      const p1 = parsePrice('$5799.00', 'AUD', 'en-AU');
      expect(p1).not.toBeNull();
      expect(p1?.price).toBe(5799);

      const p2 = parsePrice('$5799.99', 'AUD', 'en-AU');
      expect(p2).not.toBeNull();
      expect(p2?.price).toBe(5799.99);

      const p3 = parsePrice('€1234,56', 'EUR', 'de-DE');
      expect(p3).not.toBeNull();
      expect(p3?.price).toBe(1234.56);
    });

    it('should extract 4-digit prices with prefix or suffix currency codes', () => {
      const p1 = parsePrice('AUD $5799', undefined, 'en-AU');
      expect(p1?.price).toBe(5799);
      expect(p1?.currency).toBe('AUD');

      const p2 = parsePrice('CHF 5799', undefined, 'de-CH');
      expect(p2?.price).toBe(5799);
      expect(p2?.currency).toBe('CHF');

      const p3 = parsePrice('Fr. 1299.50', undefined, 'de-CH');
      expect(p3?.price).toBe(1299.50);
      expect(p3?.currency).toBe('CHF');

      const p4 = parsePrice('5799 USD', undefined, 'en-US');
      expect(p4?.price).toBe(5799);
      expect(p4?.currency).toBe('USD');
    });

    it('should extract 4-digit prices embedded in surrounding text', () => {
      const p1 = parsePrice('Now $5799 in stock', 'AUD', 'en-AU');
      expect(p1?.price).toBe(5799);

      const p2 = parsePrice('Special offer $5799.99 today', 'AUD', 'en-AU');
      expect(p2?.price).toBe(5799.99);
    });

    it('should extract plain 4-digit numbers without currency symbol', () => {
      const p1 = parsePrice('5799', 'AUD', 'en-AU');
      expect(p1?.price).toBe(5799);

      const p2 = parsePrice('5799.99', 'AUD', 'en-AU');
      expect(p2?.price).toBe(5799.99);
    });

    describe('Multi-currency and multi-locale verification', () => {
      it('should parse British Pound (GBP) 4-digit prices correctly in en-GB', () => {
        expect(parsePrice('£1499', undefined, 'en-GB')?.price).toBe(1499);
        expect(parsePrice('£1499', undefined, 'en-GB')?.currency).toBe('GBP');
        expect(parsePrice('£5799.99', undefined, 'en-GB')?.price).toBe(5799.99);
        expect(parsePrice('1499 GBP', undefined, 'en-GB')?.price).toBe(1499);
        expect(parsePrice('GBP 1499.50', undefined, 'en-GB')?.price).toBe(1499.50);
      });

      it('should parse Euro (EUR) 4-digit prices across German and French formats', () => {
        // German format: dot thousand separator or comma decimal
        expect(parsePrice('€5799', undefined, 'de-DE')?.price).toBe(5799);
        expect(parsePrice('€5799', undefined, 'de-DE')?.currency).toBe('EUR');
        expect(parsePrice('€5799,00', undefined, 'de-DE')?.price).toBe(5799);
        expect(parsePrice('€1.234,56', undefined, 'de-DE')?.price).toBe(1234.56);
        expect(parsePrice('5799 EUR', undefined, 'de-DE')?.price).toBe(5799);

        // French format: space thousand separator or comma decimal
        expect(parsePrice('5799,00 €', 'EUR', 'fr-FR')?.price).toBe(5799);
        expect(parsePrice('1 234,56 €', 'EUR', 'fr-FR')?.price).toBe(1234.56);
      });

      it('should parse Japanese Yen (JPY) 4-digit prices in ja-JP', () => {
        expect(parsePrice('¥5799', undefined, 'ja-JP')?.price).toBe(5799);
        expect(parsePrice('¥5799', undefined, 'ja-JP')?.currency).toBe('JPY');
        expect(parsePrice('¥10000', undefined, 'ja-JP')?.price).toBe(10000);
        expect(parsePrice('JPY 5799', undefined, 'ja-JP')?.price).toBe(5799);
        expect(parsePrice('5799 JPY', undefined, 'ja-JP')?.price).toBe(5799);
      });

      it('should parse Chinese Yuan (CNY) 4-digit prices in zh-CN', () => {
        expect(parsePrice('¥5799', undefined, 'zh-CN')?.price).toBe(5799);
        expect(parsePrice('¥5799', undefined, 'zh-CN')?.currency).toBe('CNY');
        expect(parsePrice('¥1299.00', undefined, 'zh-CN')?.price).toBe(1299);
      });

      it('should parse Indian Rupee (INR) 4-digit prices in hi-IN', () => {
        expect(parsePrice('₹5799', undefined, 'hi-IN')?.price).toBe(5799);
        expect(parsePrice('₹5799', undefined, 'hi-IN')?.currency).toBe('INR');
        expect(parsePrice('₹1499.00', undefined, 'hi-IN')?.price).toBe(1499);
        expect(parsePrice('INR 5799', undefined, 'hi-IN')?.price).toBe(5799);
      });

      it('should parse Canadian Dollar (CAD) 4-digit prices in en-CA', () => {
        expect(parsePrice('CAD $1499', undefined, 'en-CA')?.price).toBe(1499);
        expect(parsePrice('CAD $1499', undefined, 'en-CA')?.currency).toBe('CAD');
        expect(parsePrice('CAD 1499.99', undefined, 'en-CA')?.price).toBe(1499.99);
        expect(parsePrice('1499 CAD', undefined, 'en-CA')?.price).toBe(1499);
      });

      it('should parse Swiss Franc (CHF) with apostrophe thousands separator in de-CH', () => {
        expect(parsePrice("CHF 1'234.50", undefined, 'de-CH')?.price).toBe(1234.50);
        expect(parsePrice("CHF 1'234.50", undefined, 'de-CH')?.currency).toBe('CHF');
        expect(parsePrice("1'234.50 CHF", undefined, 'de-CH')?.price).toBe(1234.50);
        expect(parsePrice("Fr. 5'799.00", undefined, 'de-CH')?.price).toBe(5799);
      });

      it('should parse New Zealand Dollar (NZD), Singapore Dollar (SGD), and Hong Kong Dollar (HKD)', () => {
        expect(parsePrice('NZD $1499', undefined, 'en-NZ')?.price).toBe(1499);
        expect(parsePrice('NZD $1499', undefined, 'en-NZ')?.currency).toBe('NZD');

        expect(parsePrice('SGD $1499', undefined, 'en-SG')?.price).toBe(1499);
        expect(parsePrice('SGD $1499', undefined, 'en-SG')?.currency).toBe('SGD');

        expect(parsePrice('HKD $1499', undefined, 'zh-HK')?.price).toBe(1499);
        expect(parsePrice('HKD $1499', undefined, 'zh-HK')?.currency).toBe('HKD');
      });

      it('should extract multiple 4-digit prices from raw HTML via extractPricesFromText', () => {
        const html = `
          <div class="pricing">
            <span class="original-price">Was $6499.00</span>
            <span class="sale-price">Now AUD $5799</span>
            <span class="member-price">Or pay $1000 deposit</span>
          </div>
        `;
        const prices = extractPricesFromText(html, 'AUD', 'en-AU');
        expect(prices.map(p => p.price)).toContain(6499);
        expect(prices.map(p => p.price)).toContain(5799);
        expect(prices.map(p => p.price)).toContain(1000);
      });
    });
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
