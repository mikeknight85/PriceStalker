import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { extractProductTitle } from '../../src/services/scraper/metadata/title';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';
import type { RetailerConfig } from '../../src/models/types';

// Mock settingsCache to avoid DB connections in unit tests
vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getNameSelectors: vi.fn().mockResolvedValue([]),
    getAISettings: vi.fn().mockResolvedValue({}),
    getRetailerNameSelectors: vi.fn().mockResolvedValue([]),
  }
}));

describe('Title Extraction Noise & Modal Filtering', () => {
  it('discards Cart limit reached and lets JSON-LD Product.name win', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Google Pixel Buds Pro 2 Hazel"
            }
          </script>
        </head>
        <body>
          <h2 class="explore-modal-title">Cart limit reached</h2>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig: Partial<RetailerConfig> = {
      domain: 'telstra.com.au',
      name_selectors: ['h2.explore-modal-title']
    };

    const result: ScrapedProductWithVoting = {
      url: 'https://www.telstra.com.au/accessories/earbuds/google/pixel-buds-pro-2',
      price: null,
      imageUrl: null,
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false
    };

    const extractionSteps: string[] = [];
    await extractProductTitle($, domainConfig as RetailerConfig, extractionSteps, result);

    expect(result.name).not.toBe('Cart limit reached');
    expect(result.name).toBe('Google Pixel Buds Pro 2 Hazel');
  });

  it('discards Account limit reached and Limited stock available', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Apple iPhone 16 Pro Max"
            }
          </script>
        </head>
        <body>
          <div class="modal-box">
            <h2>Account limit reached</h2>
            <p>Limited stock available</p>
          </div>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig: Partial<RetailerConfig> = {
      domain: 'telstra.com.au',
      name_selectors: ['div.modal-box h2', 'div.modal-box p']
    };

    const result: ScrapedProductWithVoting = {
      url: 'https://www.telstra.com.au/mobile-phones/apple/iphone-16-pro-max',
      price: null,
      imageUrl: null,
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false
    };

    const extractionSteps: string[] = [];
    await extractProductTitle($, domainConfig as RetailerConfig, extractionSteps, result);

    expect(result.name).not.toBe('Account limit reached');
    expect(result.name).not.toBe('Limited stock available');
    expect(result.name).toBe('Apple iPhone 16 Pro Max');
  });

  it('preserves legitimate product titles containing cart or checkout', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "EZGO 48V Heavy Duty Golf Cart Battery"
            }
          </script>
        </head>
        <body>
          <h1 class="product-title">EZGO 48V Heavy Duty Golf Cart Battery</h1>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig: Partial<RetailerConfig> = {
      domain: 'batterystore.com',
      name_selectors: ['h1.product-title']
    };

    const result: ScrapedProductWithVoting = {
      url: 'https://batterystore.com/ezgo-battery',
      price: null,
      imageUrl: null,
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false
    };

    const extractionSteps: string[] = [];
    await extractProductTitle($, domainConfig as RetailerConfig, extractionSteps, result);

    expect(result.name).toBe('EZGO 48V Heavy Duty Golf Cart Battery');
  });

  it('prioritizes JSON-LD Product.name when confidence ties with DOM selector', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Clean Canonical Product Title"
            }
          </script>
        </head>
        <body>
          <h1 class="store-banner">Buy Clean Product Online Free Shipping</h1>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const domainConfig: Partial<RetailerConfig> = {
      domain: 'example.com',
      name_selectors: ['h1.store-banner']
    };

    const result: ScrapedProductWithVoting = {
      url: 'https://example.com/item',
      price: null,
      imageUrl: null,
      stockStatus: 'in_stock',
      priceCandidates: [],
      needsReview: false
    };

    const extractionSteps: string[] = [];
    await extractProductTitle($, domainConfig as RetailerConfig, extractionSteps, result);

    expect(result.name).toBe('Clean Canonical Product Title');
  });
});
