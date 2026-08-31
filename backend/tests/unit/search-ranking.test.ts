import { describe, it, expect } from 'vitest';
import { rankSearchResults, scoreResult, type RankableResult } from '../../src/services/domain/product/utils/search-ranking';

const result = (over: Partial<RankableResult>): RankableResult => ({
  title: 'Widget',
  url: 'https://shop.example.com/p/widget',
  content: '',
  domain: 'shop.example.com',
  isSupported: false,
  ...over,
});

describe('Search result ranking', () => {
  describe('it reorders, it never removes', () => {
    it('keeps every result', () => {
      // The issue warns against assuming a URL pattern. Anything confident
      // enough to exclude on would also exclude working retailers that do not
      // follow it, and an empty result reads as "no such product" rather than
      // "our heuristic was wrong".
      const input = [
        result({ url: 'https://youtube.com/watch?v=1', domain: 'youtube.com' }),
        result({ url: 'https://shop.example.com/p/widget', isSupported: true }),
        result({ url: 'https://blog.example.com/blog/widget-review', domain: 'blog.example.com' }),
      ];
      expect(rankSearchResults(input)).toHaveLength(3);
    });

    it('still returns an unusual retailer, just lower down', () => {
      const odd = result({ url: 'https://tiny-shop.example', domain: 'tiny-shop.example' });
      const ranked = rankSearchResults([
        result({ url: 'https://shop.example.com/p/widget', isSupported: true }),
        odd,
      ]);
      expect(ranked).toContain(odd);
    });
  });

  describe('ordering', () => {
    it('puts a configured retailer first', () => {
      // The strongest signal that does not assume a URL shape: the scraper is
      // already known to work on this domain.
      const ranked = rankSearchResults([
        result({ url: 'https://unknown.example/p/widget', domain: 'unknown.example' }),
        result({ url: 'https://known.example/p/widget', domain: 'known.example', isSupported: true }),
      ]);
      expect(ranked[0].domain).toBe('known.example');
    });

    it('demotes video, forum and encyclopedia hosts', () => {
      const ranked = rankSearchResults([
        result({ url: 'https://www.youtube.com/watch?v=abc', domain: 'youtube.com' }),
        result({ url: 'https://old.reddit.com/r/deals/x', domain: 'reddit.com' }),
        result({ url: 'https://shop.example.com/p/widget' }),
      ]);
      expect(ranked[0].domain).toBe('shop.example.com');
    });

    it('demotes articles and buying guides', () => {
      const ranked = rankSearchResults([
        result({ url: 'https://shop.example.com/blog/best-widgets-2026' }),
        result({ url: 'https://shop.example.com/p/widget' }),
      ]);
      expect(ranked[0].url).toContain('/p/widget');
    });

    it('promotes a result whose snippet contains a price', () => {
      const ranked = rankSearchResults([
        result({ url: 'https://shop.example.com/a', content: 'Everything about widgets' }),
        result({ url: 'https://shop.example.com/b', content: 'Buy now for $49.99' }),
      ]);
      expect(ranked[0].url).toContain('/b');
    });

    it('demotes a bare home page', () => {
      const ranked = rankSearchResults([
        result({ url: 'https://shop.example.com/', domain: 'shop.example.com' }),
        result({ url: 'https://shop.example.com/p/widget' }),
      ]);
      expect(ranked[0].url).toContain('/p/widget');
    });
  });

  describe('where the heuristic has nothing to say', () => {
    it('preserves the search engine order', () => {
      // The engine's own relevance ranking beats anything invented here, so
      // equal scores must not be reshuffled.
      const input = [
        result({ url: 'https://shop.example.com/p/one', title: 'one' }),
        result({ url: 'https://shop.example.com/p/two', title: 'two' }),
        result({ url: 'https://shop.example.com/p/three', title: 'three' }),
      ];
      expect(rankSearchResults(input).map(r => r.title)).toEqual(['one', 'two', 'three']);
    });
  });

  it('does not throw on a malformed URL', () => {
    expect(() => scoreResult(result({ url: 'not a url' }))).not.toThrow();
    expect(rankSearchResults([result({ url: 'not a url' })])).toHaveLength(1);
  });
});
