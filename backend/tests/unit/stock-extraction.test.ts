import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { checkGenericStockPhrases } from '../../src/services/scraper/extractors/stock/generic';
import { checkCustomStockSelectors } from '../../src/services/scraper/extractors/stock/custom';

describe('checkGenericStockPhrases Unit Tests', () => {
  const phrases = {
    pre: ['preorder', 'pre-order'],
    oos: ['out of stock', 'sold out', 'not available'],
    is: ['add to cart', 'in stock', 'buy now']
  };

  it('should not flag a product as in_stock just because "clearance" is in a sidebar menu', () => {
    const html = `
      <html>
        <body>
          <div class="sidebar">
            <a href="/clearance">Shop Clearance Items</a>
          </div>
          <main class="product-detail">
            <h1>My Product</h1>
            <div class="stock-status">Currently Unavailable</div>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, phrases);
    expect(result).toBeNull();
  });

  it('should not flag a product as in_stock if clearance is in the body of a flat HTML document', () => {
    const html = `
      <html>
        <body>
          <div class="header">
            <a href="/clearance">Shop Clearance Items</a>
          </div>
          <h1>My Product</h1>
          <div class="stock-status">Currently Unavailable</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, phrases);
    expect(result).toBeNull();
  });

  it('should prioritize schema.org/outofstock over add to cart button', () => {
    const html = `
      <html>
        <body>
          <main>
            <div class="availability">http://schema.org/outofstock</div>
            <button class="add-to-cart">Add to Cart</button>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, phrases);
    expect(result).not.toBeNull();
    expect(result?.value).toBe('out_of_stock');
  });

  it('should prioritize generic OOS phrases over general in_stock phrases, preventing available substring traps', () => {
    // Both "Currently Unavailable" contains "available".
    // Under inverted priority, checking "available" first would return in_stock.
    // We expect out_of_stock since out_of_stock checks happen first.
    const customPhrases = {
      pre: ['preorder', 'pre-order'],
      oos: ['out of stock', 'sold out', 'not available', 'currently unavailable'],
      is: ['add to cart', 'in stock', 'buy now', 'available']
    };
    const html = `
      <html>
        <body>
          <main>
            <div class="stock-status">Currently Unavailable</div>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, customPhrases);
    expect(result).not.toBeNull();
    expect(result?.value).toBe('out_of_stock');
  });

  it('should prioritize pre_order phrases over general in_stock phrases', () => {
    // "Available for Pre-Order" contains "available" and "pre-order".
    // We expect pre_order since pre_order checks happen before in_stock checks.
    const customPhrases = {
      pre: ['preorder', 'pre-order'],
      oos: ['out of stock', 'sold out', 'not available', 'currently unavailable'],
      is: ['add to cart', 'in stock', 'buy now', 'available']
    };
    const html = `
      <html>
        <body>
          <main>
            <div class="stock-status">Available for Pre-Order</div>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, customPhrases);
    expect(result).not.toBeNull();
    expect(result?.value).toBe('pre_order');
  });

  it('should ignore text inside script and style blocks during phrase matching', () => {
    const html = `
      <html>
        <body>
          <main>
            <script>
              const config = { status: "out of stock" };
            </script>
            <style>
              .out-of-stock { color: red; }
            </style>
            <h1>My Product</h1>
            <div class="buy-box">
              <button>Buy now</button>
            </div>
          </main>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = checkGenericStockPhrases($, phrases);
    // If it read the script, it would return 'out_of_stock'.
    // We expect it to find 'Buy now' and return 'in_stock'.
    expect(result).not.toBeNull();
    expect(result?.value).toBe('in_stock');
  });
});

describe('checkCustomStockSelectors Unit Tests', () => {
  const globalPhrases = {
    pre: ['preorder', 'pre-order'],
    oos: ['out of stock', 'sold out', 'not available'],
    is: ['add to cart', 'in stock', 'buy now']
  };

  it('should process custom stock selectors using text matching', () => {
    const html = `
      <html>
        <body>
          <div class="custom-stock">SOLD OUT</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      stock_selectors: ['.custom-stock']
    };
    const candidates = checkCustomStockSelectors($, domainConfig, globalPhrases);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].value).toBe('out_of_stock');
  });

  it('should process custom stock selectors with attribute values', () => {
    const html = `
      <html>
        <body>
          <div class="stock-info" data-avail="in stock">Some text</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      stock_selectors: ['.stock-info::attr(data-avail)']
    };
    const candidates = checkCustomStockSelectors($, domainConfig, globalPhrases);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].value).toBe('in_stock');
  });

  it('should process custom stock selectors with equals modifier', () => {
    const html = `
      <html>
        <body>
          <div class="pdp-form" data-preorder="true">Form content</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      stock_selectors: ['.pdp-form::attr(data-preorder)::equals(true)->pre_order']
    };
    const candidates = checkCustomStockSelectors($, domainConfig, globalPhrases);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].value).toBe('pre_order');
    expect(candidates[0].selector).toBe('.pdp-form::attr(data-preorder)::equals(true)->pre_order');
  });

  it('should skip phrase-checks and return nothing if modifier does not match', () => {
    const html = `
      <html>
        <body>
          <div class="pdp-form" data-preorder="false">Form content</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      stock_selectors: ['.pdp-form::attr(data-preorder)::equals(true)->pre_order']
    };
    // Even though "false" might match OOS phrases in some lists,
    // since the modifier ".pdp-form::attr(data-preorder)::equals(true)->pre_order" has a modifier condition that fails,
    // it should skip standard checks for this selector and return no candidates.
    const candidates = checkCustomStockSelectors($, domainConfig, globalPhrases);
    expect(candidates).toHaveLength(0);
  });

  it('should process custom stock selectors with contains modifier', () => {
    const html = `
      <html>
        <body>
          <div class="stock-alert">We are temporarily sold out of this item</div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig = {
      stock_selectors: ['.stock-alert::contains(sold out)->out_of_stock']
    };
    const candidates = checkCustomStockSelectors($, domainConfig, globalPhrases);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].value).toBe('out_of_stock');
  });
});
