import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';

/**
 * The per-retailer JSON-LD image preference is a tri-state: true, false, and
 * null meaning "inherit the global setting". `false` and `null` are easy to
 * conflate — a `||` instead of a `??` silently turns an explicit "prefer CSS
 * selectors" back into the global value.
 */

const settingsGet = vi.fn();

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    get: (key: string) => settingsGet(key),
    getImageSelectors: async () => ['img[class*="product"]'],
    getAISettings: async () => ({ jsonld_image_key: 'image' }),
  },
}));

const PAGE = 'https://shop.example.com/p/1';

const HTML = `
  <html><body>
    <script type="application/ld+json">
      {"@type":"Product","name":"Widget","image":"https://cdn.example.com/from-jsonld.jpg"}
    </script>
    <img class="product-main" src="https://cdn.example.com/from-css.jpg">
  </body></html>
`;

async function topCandidateMethod(retailerPreference: boolean | null | undefined, globalSetting: string) {
  settingsGet.mockImplementation(async (key: string) =>
    key === 'prefer_jsonld_image' ? globalSetting : null
  );

  const { extractProductImage } = await import('../../src/services/scraper/metadata/image');
  const $ = cheerio.load(HTML);
  const steps: string[] = [];
  const result: any = { imageCandidates: [] };

  const domainConfig: any =
    retailerPreference === undefined
      ? { image_selectors: ['img.product-main'] }
      : { image_selectors: ['img.product-main'], prefer_jsonld_image: retailerPreference };

  await extractProductImage($, domainConfig, steps, result, PAGE);

  return { method: result.imageCandidates[0]?.method as string, steps };
}

describe('Per-retailer JSON-LD image preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inherits the global setting when the retailer has no override', async () => {
    expect((await topCandidateMethod(null, 'true')).method).toBe('json-ld');
    expect((await topCandidateMethod(null, 'false')).method).not.toBe('json-ld');
  });

  it('inherits the global setting when the column is absent entirely', async () => {
    // A retailer row written before the column existed.
    expect((await topCandidateMethod(undefined, 'true')).method).toBe('json-ld');
  });

  it('lets a retailer opt out while the global setting stays on', async () => {
    // The case the issue is about: JSON-LD stays preferred everywhere else, but
    // this retailer's structured data points at something unusable.
    const { method } = await topCandidateMethod(false, 'true');
    expect(method).not.toBe('json-ld');
  });

  it('lets a retailer opt in while the global setting is off', async () => {
    expect((await topCandidateMethod(true, 'false')).method).toBe('json-ld');
  });

  it('records which source decided the preference', async () => {
    const override = await topCandidateMethod(false, 'true');
    expect(override.steps.join('\n')).toContain('retailer override');

    const inherited = await topCandidateMethod(null, 'true');
    expect(inherited.steps.join('\n')).toContain('global');
  });
});
