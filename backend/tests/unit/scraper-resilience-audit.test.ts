import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { extractJsonLdCandidates } from '../../src/services/scraper/extractors/price-extraction';
import { checkSchemaStock } from '../../src/services/scraper/extractors/stock/schema';

/**
 * Findings from the resilience audit in #169. Four held; the fifth -- the
 * "unreachable" sentinel in the remote retry loop -- is required by
 * TypeScript's control-flow analysis and removing it fails the build. See the
 * issue.
 */

const withJsonLd = (obj: unknown) =>
  load(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`);

describe('JSON-LD price candidates are deduplicated', () => {
  it('returns one candidate when a graph repeats the same price', () => {
    // A @graph that cross-references by @id, or nests priceSpecification inside
    // offers, yields the same figure several times from one document.
    // Consensus weighs candidates, so repeats read as independent corroboration
    // when they are one source counted twice.
    const $ = withJsonLd({
      '@graph': [
        { '@type': 'Product', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'CHF' } },
        { '@type': 'Product', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'CHF' } },
      ],
    });
    const prices = extractJsonLdCandidates($);
    const at4999 = prices.filter(c => Number(c.price) === 49.99);
    expect(at4999).toHaveLength(1);
  });

  it('keeps genuinely different prices from the same document', () => {
    // Deduplication must not collapse a real price range into one figure.
    const $ = withJsonLd({
      '@graph': [
        { '@type': 'Product', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'CHF' } },
        { '@type': 'Product', offers: { '@type': 'Offer', price: '59.99', priceCurrency: 'CHF' } },
      ],
    });
    const values = extractJsonLdCandidates($).map(c => Number(c.price)).sort();
    expect(values).toContain(49.99);
    expect(values).toContain(59.99);
  });

  it('keeps the same figure in two currencies, which is not a duplicate', () => {
    const $ = withJsonLd({
      '@graph': [
        { '@type': 'Product', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'CHF' } },
        { '@type': 'Product', offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'EUR' } },
      ],
    });
    const currencies = new Set(extractJsonLdCandidates($).map(c => c.currency));
    expect(currencies.size).toBeGreaterThan(1);
  });

  it('returns nothing for a document with no offers, without throwing', () => {
    const $ = withJsonLd({ '@type': 'Article', headline: 'Not a product' });
    expect(() => extractJsonLdCandidates($)).not.toThrow();
  });
});

describe('JSON-LD multi-offer stock precedence (issue #169)', () => {
  it('prefers primary offer status in a marketplace when primary is out of stock but secondary is in stock', () => {
    // When primary/buybox offer is sold out, secondary marketplace seller stock
    // should not optimistically mark the product in_stock.
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '99.00', seller: { name: 'Direct Retailer' }, availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', price: '199.00', seller: { name: 'Marketplace Scalper' }, availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('out_of_stock');
  });

  it('prefers primary offer status when primary is in stock but secondary is out of stock', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '99.00', seller: { name: 'Direct Retailer' }, availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', price: '79.00', seller: { name: 'Refurbished Seller' }, availability: 'https://schema.org/OutOfStock' },
      ],
    });
    const candidates = checkSchemaStock($);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('in_stock');
  });

  it('prefers primary offer status when primary is preorder', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '99.00', availability: 'https://schema.org/PreOrder' },
        { '@type': 'Offer', price: '199.00', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('pre_order');
  });

  it('falls back to secondary offer if primary offer has no availability', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '99.00' }, // no availability
        { '@type': 'Offer', price: '199.00', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('in_stock');
  });

  it('resolves product variants to in_stock on base URL if any variant is available (Shopify pattern)', () => {
    // When visiting the base product URL without a variant selected, size S being
    // sold out should not mark the entire product out of stock if size M is available.
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', sku: 'JACKET-S', url: '/products/jacket?variant=101', availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', sku: 'JACKET-M', url: '/products/jacket?variant=102', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($, 'https://shop.example.com/products/jacket');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('in_stock');
  });

  it('resolves specific variant to out_of_stock when URL targets an out-of-stock variant', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', sku: 'JACKET-S', url: '/products/jacket?variant=101', availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', sku: 'JACKET-M', url: '/products/jacket?variant=102', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($, 'https://shop.example.com/products/jacket?variant=101');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('out_of_stock');
  });

  it('resolves specific variant to in_stock when URL targets an in-stock variant', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', sku: 'JACKET-S', url: '/products/jacket?variant=101', availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', sku: 'JACKET-M', url: '/products/jacket?variant=102', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($, 'https://shop.example.com/products/jacket?variant=102');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('in_stock');
  });

  it('defaults to first offer when offers are non-variant and have no seller information', () => {
    const $ = withJsonLd({
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '99.00', availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', price: '199.00', availability: 'https://schema.org/InStock' },
      ],
    });
    const candidates = checkSchemaStock($);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.value).toBe('out_of_stock');
  });
});
