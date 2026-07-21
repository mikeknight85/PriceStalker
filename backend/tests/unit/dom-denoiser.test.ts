import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { denoiseDomForExtraction, denoiseHtmlForRegex } from '../../src/services/scraper/extractors/dom-denoiser';

describe('denoiseDomForExtraction Unit Tests', () => {
  it('should not strip a price element that happens to have "related" or "recommend" in its class', () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>My Product</h1>
            <div class="product-price-related-info">$99.99</div>
            <span class="recommended-product-price">$89.99</span>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    denoiseDomForExtraction($);
    // The elements should NOT be removed by the denoiser
    expect($('.product-price-related-info').length).toBe(1);
    expect($('.recommended-product-price').length).toBe(1);
  });

  it('should still strip major noise sections like aside or footers', () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>My Product</h1>
          </main>
          <aside class="related-items">
            <div>Related Item 1</div>
          </aside>
          <footer>
            <div>Footer Links</div>
          </footer>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    denoiseDomForExtraction($);
    expect($('aside').length).toBe(0);
    expect($('footer').length).toBe(0);
  });

  it('should preserve elements and all their ancestors matching custom config selectors', () => {
    const html = `
      <html>
        <body>
          <header class="header">Header</header>
          <div class="pdp-container">
            <main>
              <h1>My Product</h1>
              <span class="price">$199</span>
            </main>
          </div>
          <footer>
            <div class="promo-box">
              <span class="custom-footer-price">$50 (Promo)</span>
            </div>
          </footer>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      price_selectors: ['footer .custom-footer-price']
    };

    // Before denoising, we expect footer and custom-footer-price to exist
    expect($('footer').length).toBe(1);
    expect($('.custom-footer-price').length).toBe(1);

    // Run denoiser with custom config
    denoiseDomForExtraction($, domainConfig);

    // Normal noise elements (like .header) should be removed
    // But since the custom selector targets "footer .custom-footer-price",
    // the footer element, .promo-box element, and .custom-footer-price elements
    // should all be preserved as ancestors/nodes of the custom selector.
    expect($('.header').length).toBe(0);
    expect($('footer').length).toBe(1);
    expect($('.promo-box').length).toBe(1);
    expect($('.custom-footer-price').length).toBe(1);
  });

  it('should bypass denoising completely if skip_denoising flag is set', () => {
    const html = `
      <html>
        <body>
          <aside class="related-items">Related</aside>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      skip_denoising: true
    };
    denoiseDomForExtraction($, domainConfig);
    expect($('aside').length).toBe(1);
    expect($('footer').length).toBe(1);
  });

  it('should preserve elements matching high-confidence global selectors even inside noise containers', () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>My Product</h1>
          </main>
          <aside class="sidebar">
            <div data-automation-test-id="buy-box-price">$219.00</div>
          </aside>
          <footer>
            <div class="footer-promo" itemprop="price" content="219.00"></div>
          </footer>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const globalSelectors = ['[data-automation-test-id*="price"]', '[itemprop="price"]'];

    // Before denoising
    expect($('aside').length).toBe(1);
    expect($('footer').length).toBe(1);

    // Run denoiser with global selectors
    denoiseDomForExtraction($, undefined, globalSelectors);

    // Normally aside and footer are noise. 
    // But since they contain elements matching the global high-confidence selectors,
    // they (and their targets) should be preserved.
    expect($('aside').length).toBe(1);
    expect($('[data-automation-test-id="buy-box-price"]').length).toBe(1);
    expect($('footer').length).toBe(1);
    expect($('[itemprop="price"]').length).toBe(1);
  });

  it('should explicitly remove elements matching exclusion selectors even if they would otherwise be preserved', () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>My Product</h1>
            <div class="unwanted-carousel">Carousel</div>
          </main>
          <div class="site-wide-ad">Ad</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      exclusion_selectors: ['.unwanted-carousel']
    };
    const globalExclusions = ['.site-wide-ad'];

    denoiseDomForExtraction($, domainConfig, [], globalExclusions);

    expect($('.unwanted-carousel').length).toBe(0);
    expect($('.site-wide-ad').length).toBe(0);
    expect($('h1').length).toBe(1);
  });
});

describe('denoiseHtmlForRegex Unit Tests', () => {
  it('should strip script, style, and noscript blocks from a raw HTML string', () => {
    const rawHtml = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>var x = "$9.99";</script>
        </head>
        <body>
          <h1>Product</h1>
          <noscript><p>Please enable JS to view $12.34 price</p></noscript>
          <div>Price: $100</div>
        </body>
      </html>
    `;
    const denoised = denoiseHtmlForRegex(rawHtml);
    expect(denoised).toContain('<h1>Product</h1>');
    expect(denoised).toContain('<div>Price: $100</div>');
    expect(denoised).not.toContain('color: red');
    expect(denoised).not.toContain('var x =');
    expect(denoised).not.toContain('Please enable JS');
  });
});
