import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { extractProductTitle } from '../../src/services/scraper/metadata/title';
import { ScrapedProductWithVoting } from '../../src/types/scraper';

// Mock settingsCache to avoid DB connections in unit tests
vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getNameSelectors: vi.fn().mockResolvedValue([]),
    getAISettings: vi.fn().mockResolvedValue({}),
    getRetailerNameSelectors: vi.fn().mockResolvedValue([]),
  }
}));

describe('extractProductTitle Unit Tests', () => {
  it('should strip retailer name from the end of the title', async () => {
    const html = `<html><head><title>Awesome Product - MyRetailer</title></head><body></body></html>`;
    const $ = cheerio.load(html);
    const domainConfig = { domain: 'myretailer.com', name: 'MyRetailer', retailer_name_selectors: [] } as any;
    const result = { nameCandidates: [] } as unknown as ScrapedProductWithVoting;
    const steps: string[] = [];

    // Mock retailerName resolution
    result.retailerName = 'MyRetailer';

    await extractProductTitle($, domainConfig, steps, result);
    expect(result.name).toBe('Awesome Product');
  });

  it('should strip retailer name from the start of the title', async () => {
    const html = `<html><head><title>MyRetailer - Awesome Product</title></head><body></body></html>`;
    const $ = cheerio.load(html);
    const domainConfig = { domain: 'myretailer.com', name: 'MyRetailer', retailer_name_selectors: [] } as any;
    const result = { nameCandidates: [] } as unknown as ScrapedProductWithVoting;
    const steps: string[] = [];

    // Mock retailerName resolution
    result.retailerName = 'MyRetailer';

    await extractProductTitle($, domainConfig, steps, result);
    expect(result.name).toBe('Awesome Product');
  });
});
