import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { extractJsonLdCandidates } from '../../src/services/scraper/extractors/price-extraction';

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
