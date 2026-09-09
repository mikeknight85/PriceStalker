import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { normalizeSelector } from '../../src/services/scraper/core/selectors';
import { denoiseDomForExtraction } from '../../src/services/scraper/extractors/dom-denoiser';
import { checkSchemaStock } from '../../src/services/scraper/extractors/stock/schema';

/**
 * Findings from the scraper pipeline audit in #166, each verified against the
 * code before being fixed. Two of the five reported did not hold; see the issue
 * for the measurements. These cover the four that did.
 */

describe('normalizeSelector keeps CSS attribute operators intact', () => {
  it('does not split a dashmatch selector', () => {
    // `span[lang|="en"]` became `span[lang::attr(="en"])` -- not valid CSS, so
    // it matched nothing and the rule silently found no elements.
    expect(normalizeSelector('span[lang|="en"]')).toBe('span[lang|="en"]');
  });

  it('does not split a namespaced attribute selector', () => {
    expect(normalizeSelector('[svg|href]')).toBe('[svg|href]');
  });

  it('still converts the legacy selector|attribute form', () => {
    expect(normalizeSelector('.price|content')).toBe('.price::attr(content)');
  });

  it('splits on the last pipe outside brackets, so both forms can coexist', () => {
    expect(normalizeSelector('.a[x|="1"]|content')).toBe('.a[x|="1"]::attr(content)');
  });

  it('keeps a pipe in the base, which the legacy form allows', () => {
    expect(normalizeSelector('a|b|attr')).toBe('a|b::attr(attr)');
  });

  it('leaves regex and html markers alone', () => {
    expect(normalizeSelector('~price: ([\\d.]+)~')).toBe('~price: ([\\d.]+)~');
    expect(normalizeSelector('!.raw')).toBe('!.raw');
  });
});

describe('the denoiser does not duplicate JSON-LD', () => {
  const ld = (body: string) => load(`<html><head></head><body>${body}<p>content</p></body></html>`);

  it('leaves a block that was never removed exactly once', () => {
    // Step 3 excludes JSON-LD from script removal, so the original survived and
    // step 5 appended a clone on top of it -- every extractor read it twice.
    const $ = load('<html><head><script type="application/ld+json">{"a":1}</script></head><body><p>x</p></body></html>');
    denoiseDomForExtraction($);
    expect($('script[type="application/ld+json"]')).toHaveLength(1);
  });

  it('rescues a block that noise removal took with it', () => {
    // This is what step 5 exists for: a footer goes, and its JSON-LD with it.
    const $ = ld('<footer><script type="application/ld+json">{"b":2}</script></footer>');
    denoiseDomForExtraction($);
    expect($('script[type="application/ld+json"]')).toHaveLength(1);
    expect($('script[type="application/ld+json"]').html()).toContain('"b":2');
  });

  it('keeps both when a page genuinely ships the same block twice', () => {
    // Matched by content and counted, so multiplicity survives rather than
    // being collapsed by a Set.
    const $ = load('<html><head><script type="application/ld+json">{"c":3}</script><script type="application/ld+json">{"c":3}</script></head><body><p>x</p></body></html>');
    denoiseDomForExtraction($);
    expect($('script[type="application/ld+json"]')).toHaveLength(2);
  });
});

describe('JSON-LD stock walking is depth-bounded', () => {
  const withGraph = (obj: unknown) =>
    load(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`);

  const nest = (depth: number, leaf: unknown) => {
    let o: unknown = leaf;
    for (let i = 0; i < depth; i++) o = { nested: o };
    return o;
  };

  it('reads an ordinary product graph', () => {
    const $ = withGraph({ '@type': 'Product', offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' } });
    expect(checkSchemaStock($)[0]?.value).toBe('in_stock');
  });

  it('keeps a reachable offer despite a deeply nested branch elsewhere', () => {
    // The case that mattered. Unbounded recursion threw a RangeError, which the
    // empty catch swallowed, so the page reported no stock at all -- silently.
    //
    // 1,000 rather than the 20,000 this was first written with: the bound is
    // 64, so 1,000 exercises it fifteen times over, while 20,000 made
    // JSON.stringify overflow the stack on CI's smaller one -- the fixture
    // failing, not the code.
    const $ = withGraph({
      '@type': 'Product',
      offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
      unrelated: nest(1000, { junk: true }),
    });
    expect(checkSchemaStock($)[0]?.value).toBe('in_stock');
  });

  it('does not throw on a graph nested past any real depth', () => {
    const $ = withGraph(nest(1000, { '@type': 'Offer', availability: 'https://schema.org/InStock' }));
    expect(() => checkSchemaStock($)).not.toThrow();
  });

  it('stops descending past the bound rather than walking forever', () => {
    // An offer buried below the limit is not found. That is the trade: a bound
    // deep enough for any real graph, in exchange for never running away.
    const $ = withGraph(nest(1000, { '@type': 'Offer', availability: 'https://schema.org/InStock' }));
    expect(checkSchemaStock($)).toHaveLength(0);
  });

  it('still reaches an offer nested deeper than a real page but within the bound', () => {
    const $ = withGraph(nest(30, { '@type': 'Offer', availability: 'https://schema.org/OutOfStock' }));
    expect(checkSchemaStock($)[0]?.value).toBe('out_of_stock');
  });
});
