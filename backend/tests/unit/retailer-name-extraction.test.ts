import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractRetailerFromJsonLd } from '../../src/services/scraper/extractors/retailer/jsonld';
import { extractFromSelectors } from '../../src/services/scraper/extractors/retailer/selectors';

describe('Retailer Name Extraction (JSON-LD & CSS Selectors)', () => {
  describe('extractRetailerFromJsonLd', () => {
    it('returns null when no JSON-LD scripts are present in HTML', () => {
      const $ = cheerio.load('<html><head></head><body><h1>Hello</h1></body></html>');
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBeNull();
      expect(result.candidates).toEqual([]);
    });

    it('gracefully handles malformed/corrupt JSON-LD script tags without throwing', () => {
      const html = `
        <script type="application/ld+json">
          { malformed json content ...
        </script>
      `;
      const $ = cheerio.load(html);
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBeNull();
      expect(result.candidates).toEqual([]);
    });

    it('extracts retailer name from publisher.name', () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "publisher": {
              "@type": "Organization",
              "name": "Acme Megastore"
            }
          }
        </script>
      `;
      const $ = cheerio.load(html);
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBe('Acme Megastore');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toEqual({
        value: 'Acme Megastore',
        method: 'json-ld (publisher)',
        confidence: 0.95,
      });
    });

    it('extracts retailer name from Organization name', () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Global Retail Corp"
          }
        </script>
      `;
      const $ = cheerio.load(html);
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBe('Global Retail Corp');
      expect(result.candidates[0].method).toBe('json-ld (organization-name)');
    });

    it('extracts seller name or brand name from Product offers', () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Wireless Headphones",
            "offers": {
              "@type": "Offer",
              "seller": {
                "@type": "Organization",
                "name": "Audio Direct"
              }
            }
          }
        </script>
      `;
      const $ = cheerio.load(html);
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBe('Audio Direct');
      expect(result.candidates[0].method).toBe('json-ld (seller)');
      expect(result.candidates[0].confidence).toBe(0.7);
    });

    it('resolves retailer name from schema.org @graph array structure', () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Product Page"
              },
              {
                "@type": "WebSite",
                "name": "Boutique Shop",
                "url": "https://boutique.example.com"
              }
            ]
          }
        </script>
      `;
      const $ = cheerio.load(html);
      const result = extractRetailerFromJsonLd($);
      expect(result.name).toBe('Boutique Shop');
      expect(result.candidates[0].method).toBe('json-ld (website-name)');
    });
  });

  describe('extractFromSelectors', () => {
    it('extracts text from element matching selector', () => {
      const html = `<header><span class="site-branding">Digitec Galaxus</span></header>`;
      const $ = cheerio.load(html);

      const result = extractFromSelectors($, ['.site-branding'], 'header-brand');
      expect(result.name).toBe('Digitec Galaxus');
      expect(result.candidate).toEqual({
        value: 'Digitec Galaxus',
        method: 'header-brand',
        selector: '.site-branding',
        confidence: 1.0,
      });
    });

    it('extracts attribute from element when selector specifies ::attr(name)', () => {
      const html = `<div id="app" data-store-name="SuperStore"></div>`;
      const $ = cheerio.load(html);

      const result = extractFromSelectors($, ['#app::attr(data-store-name)'], 'data-attr');
      expect(result.name).toBe('SuperStore');
      expect(result.candidate?.selector).toBe('#app::attr(data-store-name)');
    });

    it('returns null when selectors do not match or match empty elements', () => {
      const html = `<div><span class="empty"></span></div>`;
      const $ = cheerio.load(html);

      const result1 = extractFromSelectors($, ['.non-existent'], 'test');
      expect(result1.name).toBeNull();
      expect(result1.candidate).toBeUndefined();

      const result2 = extractFromSelectors($, ['.empty'], 'test');
      expect(result2.name).toBeNull();
    });

    it('ignores throwing/invalid selector and tries next one', () => {
      const html = `<div class="retailer-name">Target Australia</div>`;
      const $ = cheerio.load(html);

      const result = extractFromSelectors($, [':::invalid[[selector', '.retailer-name'], 'fallback');
      expect(result.name).toBe('Target Australia');
    });
  });
});
