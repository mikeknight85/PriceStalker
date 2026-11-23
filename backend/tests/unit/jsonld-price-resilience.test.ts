import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractJsonLdCandidates } from '../../src/services/scraper/extractors/price-extraction';

describe('JSON-LD Price Extraction Resilience & Boundary Conditions', () => {
  it('extracts member price when validForMemberTier is true on priceSpecification', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "offers": {
          "@type": "Offer",
          "priceSpecification": {
            "@type": "PriceSpecification",
            "price": "69.00",
            "priceCurrency": "USD",
            "validForMemberTier": true
          }
        }
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const candidates = extractJsonLdCandidates($);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      price: 69,
      currency: 'USD',
      method: 'member-price',
      confidence: 0.95,
    });
  });

  it('does NOT fabricate USD when currency is "$" without a hint, but uses currencyHint when provided', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "offers": {
          "@type": "Offer",
          "price": "89.95",
          "priceCurrency": "$"
        }
      }
      </script>
    `;
    const $ = cheerio.load(html);

    // Without currencyHint: leaves currency as '' to trigger manual review downstream
    const candidatesNoHint = extractJsonLdCandidates($);
    expect(candidatesNoHint).toHaveLength(1);
    expect(candidatesNoHint[0].currency).toBe('');

    // With currencyHint = 'CAD': adopts CAD
    const candidatesWithHint = extractJsonLdCandidates($, 'CAD');
    expect(candidatesWithHint).toHaveLength(1);
    expect(candidatesWithHint[0].currency).toBe('CAD');
  });

  it('deduplicates identical candidates within the same document to avoid inflating consensus weights (Issue #169)', () => {
    // Repeated offer blocks / graph cross-references often output the same price multiple times
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Offer",
            "price": "149.99",
            "priceCurrency": "EUR"
          },
          {
            "@type": "Offer",
            "price": "149.99",
            "priceCurrency": "EUR"
          },
          {
            "@type": "Offer",
            "price": "149.99",
            "priceCurrency": "EUR"
          }
        ]
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const candidates = extractJsonLdCandidates($);

    // Strictly deduplicated to 1 candidate
    expect(candidates).toHaveLength(1);
    expect(candidates[0].price).toBe(149.99);
    expect(candidates[0].currency).toBe('EUR');
  });

  it('supports custom jsonLdPriceKey parameter', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "offers": {
          "@type": "Offer",
          "discountedPrice": "119.00",
          "priceCurrency": "GBP"
        }
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const candidates = extractJsonLdCandidates($, 'GBP', 'discountedPrice');

    expect(candidates).toHaveLength(1);
    expect(candidates[0].price).toBe(119);
    expect(candidates[0].currency).toBe('GBP');
  });

  it('filters out zero and non-numeric prices in JSON-LD', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Offer", "price": "0.00", "priceCurrency": "USD" },
          { "@type": "Offer", "price": "FREE", "priceCurrency": "USD" },
          { "@type": "Offer", "price": "45.00", "priceCurrency": "USD" }
        ]
      }
      </script>
    `;
    const $ = cheerio.load(html);
    const candidates = extractJsonLdCandidates($);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].price).toBe(45);
  });

  it('gracefully survives malformed JSON in script tag without throwing', () => {
    const html = `
      <script type="application/ld+json">
        { invalid json content ...
      </script>
    `;
    const $ = cheerio.load(html);
    expect(() => extractJsonLdCandidates($)).not.toThrow();
    expect(extractJsonLdCandidates($)).toEqual([]);
  });
});
