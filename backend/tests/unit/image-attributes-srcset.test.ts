import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  parseSrcset,
  extractAllImageAttributes,
  processImageElement,
  parseImageDimensions,
} from '../../src/services/scraper/metadata/image';

describe('Image Attributes, Srcset Parsing & Dimension Detection', () => {
  describe('parseSrcset', () => {
    it('returns empty array when srcset is null, undefined, or empty', () => {
      expect(parseSrcset('')).toEqual([]);
      expect(parseSrcset(null as any)).toEqual([]);
      expect(parseSrcset(undefined as any)).toEqual([]);
    });

    it('parses multiple srcset entries with pixel density (2x, 3x) scaled by 1000', () => {
      const srcset = 'https://example.com/img-1x.jpg 1x, https://example.com/img-2x.jpg 2x, https://example.com/img-1.5x.jpg 1.5x';
      const parsed = parseSrcset(srcset);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ url: 'https://example.com/img-1x.jpg', width: 1000 });
      expect(parsed[1]).toEqual({ url: 'https://example.com/img-2x.jpg', width: 2000 });
      expect(parsed[2]).toEqual({ url: 'https://example.com/img-1.5x.jpg', width: 1500 });
    });

    it('parses multiple srcset entries with width descriptors (w)', () => {
      const srcset = 'https://example.com/small.jpg 320w, https://example.com/medium.jpg 640w, https://example.com/large.jpg 1280w';
      const parsed = parseSrcset(srcset);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ url: 'https://example.com/small.jpg', width: 320 });
      expect(parsed[1]).toEqual({ url: 'https://example.com/medium.jpg', width: 640 });
      expect(parsed[2]).toEqual({ url: 'https://example.com/large.jpg', width: 1280 });
    });

    it('handles entries without width/density descriptors', () => {
      const srcset = 'https://example.com/default.jpg, https://example.com/retina.jpg 2x';
      const parsed = parseSrcset(srcset);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ url: 'https://example.com/default.jpg', width: undefined });
      expect(parsed[1]).toEqual({ url: 'https://example.com/retina.jpg', width: 2000 });
    });

    it('trims whitespace and ignores blank entries', () => {
      const srcset = '  https://example.com/a.jpg 400w ,  ,  https://example.com/b.jpg 800w  ';
      const parsed = parseSrcset(srcset);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].url).toBe('https://example.com/a.jpg');
      expect(parsed[1].url).toBe('https://example.com/b.jpg');
    });
  });

  describe('extractAllImageAttributes', () => {
    it('extracts URLs from all common image attributes including data-lazy-src and zoom attributes', () => {
      const html = `
        <img
          src="https://example.com/thumb.jpg"
          data-src="https://example.com/normal.jpg"
          data-lazy-src="https://example.com/lazy.jpg"
          data-original="https://example.com/orig.jpg"
          zoom-image="https://example.com/zoom1.jpg"
          data-zoom-image="https://example.com/zoom2.jpg"
          href="https://example.com/link-target.jpg"
        />
      `;
      const $ = cheerio.load(html);
      const urls = extractAllImageAttributes($('img')[0], $);

      expect(urls).toContain('https://example.com/thumb.jpg');
      expect(urls).toContain('https://example.com/normal.jpg');
      expect(urls).toContain('https://example.com/lazy.jpg');
      expect(urls).toContain('https://example.com/orig.jpg');
      expect(urls).toContain('https://example.com/zoom1.jpg');
      expect(urls).toContain('https://example.com/zoom2.jpg');
      expect(urls).toContain('https://example.com/link-target.jpg');
    });

    it('appends width parameter to srcset URLs when width exists and is not in URL', () => {
      const html = `<img srcset="https://example.com/item.jpg 800w, https://example.com/item2.jpg?color=blue 1200w" />`;
      const $ = cheerio.load(html);
      const urls = extractAllImageAttributes($('img')[0], $);

      expect(urls).toContain('https://example.com/item.jpg?width=800');
      expect(urls).toContain('https://example.com/item2.jpg?color=blue&width=1200');
    });
  });

  describe('processImageElement with <picture> hierarchy', () => {
    it('traverses nested <source> tags when <img> is wrapped inside a <picture> element', () => {
      const html = `
        <picture>
          <source srcset="https://example.com/source-avif.avif 1000w" type="image/avif">
          <source srcset="https://example.com/source-webp.webp 800w" type="image/webp">
          <img src="https://example.com/fallback.jpg" alt="Product Shot" />
        </picture>
      `;
      const $ = cheerio.load(html);
      const extracted: string[] = [];

      processImageElement($('img')[0], $, (url) => extracted.push(url));

      // Contains both the img fallback and the picture source URLs
      expect(extracted).toContain('https://example.com/fallback.jpg');
      expect(extracted.some(u => u.includes('source-avif.avif'))).toBe(true);
      expect(extracted.some(u => u.includes('source-webp.webp'))).toBe(true);
    });
  });

  describe('parseImageDimensions', () => {
    it('extracts dimensions from query parameters width & height', () => {
      const dims = parseImageDimensions('https://example.com/img.jpg?width=800&height=600');
      expect(dims).toEqual({ width: 800, height: 600, area: 480000 });
    });

    it('extracts dimensions from query parameters w & h or size / s', () => {
      const dims1 = parseImageDimensions('https://example.com/img.jpg?w=1024&h=768');
      expect(dims1).toEqual({ width: 1024, height: 768, area: 786432 });

      const dims2 = parseImageDimensions('https://example.com/img.jpg?size=500');
      expect(dims2).toEqual({ width: 500, height: 500, area: 250000 });
    });

    it('extracts dimensions from URL pathname pattern (e.g. /640x480/ or _1200x900.jpg)', () => {
      const dims = parseImageDimensions('https://example.com/products/item_1200x900.jpg');
      expect(dims).toEqual({ width: 1200, height: 900, area: 1080000 });
    });

    it('returns zero area when parameters are present but empty or unconstrained', () => {
      const dimsEmpty = parseImageDimensions('https://example.com/img.jpg?width=&height=');
      expect(dimsEmpty).toEqual({ width: 0, height: 0, area: 0 });

      const dimsAbsent = parseImageDimensions('https://example.com/img.jpg');
      expect(dimsAbsent).toEqual({ width: 0, height: 0, area: 0 });
    });
  });
});
