import { describe, it, expect } from 'vitest';
import { cleanUrl, canonicalizeUrl, findMatchingCanonicalRule, UrlCanonicalRule } from '../../src/utils/scraping/urlHelper';

const DEFAULT_TEST_RULES: UrlCanonicalRule[] = [
  {
    domain_pattern: '(?:^|\\.)amazon\\..*',
    path_match: '(?:^|.*\\/)(?:dp|gp\\/product)\\/([A-Z0-9]{10})(?:\\/.*)?$',
    path_replacement: '/dp/$1',
    description: 'Amazon ASIN canonicalizer'
  },
  {
    domain_pattern: '(?:^|\\.)ebay\\..*',
    path_match: '^/itm/(?:.+/)?([0-9]{10,14})(?:/.*)?$',
    path_replacement: '/itm/$1',
    description: 'eBay Item ID canonicalizer'
  },
  {
    domain_pattern: '(?:^|\\.)aliexpress\\..*',
    path_match: '^/item/(?:.+/)?([0-9]+)\\.html(?:/.*)?$',
    path_replacement: '/item/$1.html',
    description: 'AliExpress Item ID canonicalizer'
  },
  {
    domain_pattern: '.*',
    path_match: '^/collections/[^/]+/products/([^/?#]+)$',
    path_replacement: '/products/$1',
    description: 'Shopify collection path canonicalizer'
  }
];

describe('URL Canonicalization Rules (#289, #282)', () => {
  describe('Amazon ASIN normalisation', () => {
    it('normalises complex localized Amazon URLs with title slugs and ref paths', () => {
      const url = 'https://www.amazon.fr/frient-Intelligent-Notification-Instantan%C3%A9e-Alimentation/dp/B08WXT12BN/ref=pd_bxgy_thbs_d_sccl_1/261-1234567-1234567';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.amazon.fr/dp/B08WXT12BN');
    });

    it('rewrites /gp/product/ paths to canonical /dp/<ASIN>', () => {
      const url = 'https://www.amazon.com/gp/product/B08WXT12BN';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.amazon.com/dp/B08WXT12BN');
    });

    it('preserves essential variation query parameters like th=1 while stripping tracking', () => {
      const url = 'https://www.amazon.de/Some-Title-Slug/dp/B08WXT12BN?ref=sr_1_1&th=1&tag=affiliate-21';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.amazon.de/dp/B08WXT12BN?th=1');
    });

    it('works across different Amazon TLDs (e.g. .co.uk, .com, .de, .fr)', () => {
      expect(cleanUrl('https://amazon.co.uk/product-slug/dp/B000000000', DEFAULT_TEST_RULES))
        .toBe('https://amazon.co.uk/dp/B000000000');
      expect(cleanUrl('https://www.amazon.co.jp/product-slug/dp/B000000000', DEFAULT_TEST_RULES))
        .toBe('https://www.amazon.co.jp/dp/B000000000');
    });
  });

  describe('eBay Item ID normalisation', () => {
    it('strips verbose title slugs from eBay URLs', () => {
      const url = 'https://www.ebay.com/itm/Awesome-Retro-Collectible-Action-Figure/123456789012?hash=item1234&_trkparms=5079%3A0';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.ebay.com/itm/123456789012');
    });

    it('leaves already-clean eBay URLs intact', () => {
      const url = 'https://www.ebay.com/itm/123456789012';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.ebay.com/itm/123456789012');
    });
  });

  describe('AliExpress normalisation', () => {
    it('normalises category-nested AliExpress item paths', () => {
      const url = 'https://www.aliexpress.com/item/consumer-electronics/1005001234567890.html?spm=a2g0o.productlist.0.0';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://www.aliexpress.com/item/1005001234567890.html');
    });
  });

  describe('Shopify collection path normalisation', () => {
    it('collapses /collections/<name>/products/<slug> to /products/<slug>', () => {
      const url = 'https://boutique.example.com/collections/summer-deals-2026/products/linen-shirt?variant=45678&utm_source=fb';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://boutique.example.com/products/linen-shirt?variant=45678');
    });
  });

  describe('Non-matching domains & standard query cleaning', () => {
    it('does not alter pathname when no rule matches', () => {
      const url = 'https://myrandomstore.org/shop/items/gadget-123?utm_campaign=winter&sku=SKU-99';
      const cleaned = cleanUrl(url, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://myrandomstore.org/shop/items/gadget-123?sku=SKU-99');
    });

    it('works when rules list is empty or undefined', () => {
      const url = 'https://www.amazon.fr/Slug/dp/B08WXT12BN?utm_source=twitter';
      const cleaned = cleanUrl(url);
      expect(cleaned).toBe('https://www.amazon.fr/Slug/dp/B08WXT12BN');
    });

    it('respects domain boundaries and does not match spoofed domains', () => {
      const spoofedUrl = 'https://notamazon.com/dp/B08WXT12BN';
      const cleaned = cleanUrl(spoofedUrl, DEFAULT_TEST_RULES);
      expect(cleaned).toBe('https://notamazon.com/dp/B08WXT12BN');
      expect(findMatchingCanonicalRule(spoofedUrl, DEFAULT_TEST_RULES)).toBeNull();
    });
  });

  describe('Fault tolerance & safety', () => {
    it('handles malformed regexes in user-configured rules gracefully without throwing', () => {
      const invalidRules: UrlCanonicalRule[] = [
        {
          domain_pattern: '[invalid(regex',
          path_match: '*bad-path-regex',
          path_replacement: '/clean',
          description: 'Broken rule'
        },
        ...DEFAULT_TEST_RULES
      ];

      const url = 'https://www.amazon.fr/product/dp/B08WXT12BN';
      expect(() => cleanUrl(url, invalidRules)).not.toThrow();
      expect(cleanUrl(url, invalidRules)).toBe('https://www.amazon.fr/dp/B08WXT12BN');
    });

    it('handles malformed URLs gracefully by returning original input', () => {
      expect(cleanUrl('not a url', DEFAULT_TEST_RULES)).toBe('not a url');
    });
  });

  describe('findMatchingCanonicalRule helper', () => {
    it('identifies the rule that matches the URL', () => {
      const match = findMatchingCanonicalRule('https://www.amazon.fr/title/dp/B08WXT12BN', DEFAULT_TEST_RULES);
      expect(match).not.toBeNull();
      expect(match?.description).toBe('Amazon ASIN canonicalizer');
    });

    it('returns null if no rule matches', () => {
      const match = findMatchingCanonicalRule('https://www.somestore.com/product/123', DEFAULT_TEST_RULES);
      expect(match).toBeNull();
    });
  });

  describe('canonicalizeUrl alias', () => {
    it('produces the same result as cleanUrl', () => {
      const url = 'https://www.ebay.com/itm/Title/123456789012?utm_source=google';
      expect(canonicalizeUrl(url, DEFAULT_TEST_RULES)).toBe(cleanUrl(url, DEFAULT_TEST_RULES));
    });
  });
});
