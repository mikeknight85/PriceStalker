import { describe, it, expect } from 'vitest';
import { resolveImageUrl, isPlaceholderImageUrl } from '../../src/services/scraper/metadata/image-url';
import { sanitizeProductImage } from '../../src/services/domain/product/utils/metadata';

const PAGE = 'https://shop.example.com/catalog/widgets/blue-widget';

describe('resolveImageUrl', () => {
  describe('resolves against the page it was scraped from', () => {
    it('resolves a root-relative path', () => {
      expect(resolveImageUrl('/content/dam/example/image.jpg', PAGE)).toBe(
        'https://shop.example.com/content/dam/example/image.jpg'
      );
    });

    it('resolves a path-relative value against the current directory', () => {
      expect(resolveImageUrl('../img/product.jpg', PAGE)).toBe(
        'https://shop.example.com/catalog/img/product.jpg'
      );
    });

    it('normalizes a protocol-relative URL', () => {
      expect(resolveImageUrl('//cdn.example.com/image.jpg', PAGE)).toBe(
        'https://cdn.example.com/image.jpg'
      );
    });

    it('leaves an absolute URL alone', () => {
      expect(resolveImageUrl('https://cdn.example.com/a.jpg', PAGE)).toBe(
        'https://cdn.example.com/a.jpg'
      );
    });

    it('upgrades a protocol-relative URL to https even from an http page', () => {
      // The dashboard is usually served over https; an http image is blocked
      // there as mixed content and shows as broken.
      expect(resolveImageUrl('//cdn.example.com/a.jpg', 'http://shop.example.com/p')).toBe(
        'https://cdn.example.com/a.jpg'
      );
    });
  });

  describe('accepts URLs that are valid but unusual', () => {
    it('keeps a dynamic endpoint ending in a slash', () => {
      // Several CDNs serve images from a directory-style endpoint. Rejecting
      // these threw away working images.
      expect(resolveImageUrl('https://cdn.example.com/img/12345/', PAGE)).toBe(
        'https://cdn.example.com/img/12345/'
      );
    });

    it('keeps a query-string image endpoint', () => {
      expect(resolveImageUrl('/render?sku=99&w=800', PAGE)).toBe(
        'https://shop.example.com/render?sku=99&w=800'
      );
    });

    it('keeps a large inline image', () => {
      const big = `data:image/png;base64,${'A'.repeat(2000)}`;
      expect(resolveImageUrl(big, PAGE)).toBe(big);
    });
  });

  describe('rejects what cannot be displayed', () => {
    it('rejects an empty or whitespace value', () => {
      expect(resolveImageUrl('', PAGE)).toBeNull();
      expect(resolveImageUrl('   ', PAGE)).toBeNull();
    });

    it('rejects non-fetchable schemes', () => {
      expect(resolveImageUrl('javascript:void(0)', PAGE)).toBeNull();
      expect(resolveImageUrl('about:blank', PAGE)).toBeNull();
      expect(resolveImageUrl('file:///etc/hosts', PAGE)).toBeNull();
    });

    it('rejects a tiny inline spacer', () => {
      // The 1x1 transparent gif a lazy-loading script swaps out.
      expect(
        resolveImageUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', PAGE)
      ).toBeNull();
    });

    it('rejects placeholder assets under several spellings', () => {
      for (const path of [
        '/img/placeholder.jpg',
        '/assets/no-image.png',
        '/static/noimage.jpg',
        '/i/image-not-available.webp',
        '/img/spacer.gif',
        '/img/1x1.png',
        '/media/default-product.jpg',
      ]) {
        expect(resolveImageUrl(path, PAGE), path).toBeNull();
      }
    });

    it('rejects a relative value when there is no page to resolve against', () => {
      expect(resolveImageUrl('/content/dam/image.jpg', null)).toBeNull();
    });

    it('rejects an unparseable value', () => {
      expect(resolveImageUrl('http://', PAGE)).toBeNull();
    });
  });

  it('does not treat a product whose name contains a marker as a placeholder', () => {
    // The marker check runs on the path, and only for known stand-in filenames.
    expect(isPlaceholderImageUrl('https://cdn.example.com/products/widget.jpg')).toBe(false);
  });
});

describe('sanitizeProductImage', () => {
  it('refuses to overwrite a stored image with an unresolvable value', () => {
    const stored = 'https://cdn.example.com/good.jpg';
    expect(sanitizeProductImage('/still/relative.jpg', stored)).toBeNull();
    expect(sanitizeProductImage('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', stored)).toBeNull();
    expect(sanitizeProductImage('/img/placeholder.png', stored)).toBeNull();
  });

  it('still lets a genuinely new image replace a stale one', () => {
    // Retailers rotate CDN asset URLs; a stored URL that never refreshes 404s
    // forever once the old asset disappears.
    expect(
      sanitizeProductImage('https://cdn.example.com/new.jpg', 'https://cdn.example.com/old.jpg')
    ).toBe('https://cdn.example.com/new.jpg');
  });

  it('reports no change when the image is unchanged', () => {
    expect(
      sanitizeProductImage('https://cdn.example.com/same.jpg', 'https://cdn.example.com/same.jpg')
    ).toBeNull();
  });
});
