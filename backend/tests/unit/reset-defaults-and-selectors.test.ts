import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeSelector, parseSelector } from '../../src/services/scraper/core/selectors';
import { CANONICAL_USER_AGENT } from '../../src/utils/system/user-agent-constants';
import { validateSelector } from '../../src/services/ai/strategies/retailer-config';
import { parseSrcset } from '../../src/services/scraper/metadata/image';
import { resolveImageUrl } from '../../src/services/scraper/metadata/image-url';

vi.mock('../../src/config/database', () => {
  const fakePool = {
    query: vi.fn().mockImplementation((...args) => mockClient.query(...args)),
    connect: async () => mockClient,
  };
  return {
    default: fakePool,
    getPool: () => fakePool,
  };
});

vi.mock('../../src/utils/system/logging/system-event-logger', () => ({
  logSystemEvent: vi.fn(),
}));

vi.mock('../../src/utils/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/cache')>();
  return {
    ...actual,
    settingsCache: {
      ...actual.settingsCache,
      invalidate: vi.fn(),
      clear: vi.fn(),
    },
  };
});

let mockClient: any;

describe('Selector Normalization and Syntax Extensions', () => {
  it('converts Scrapy-style @attr outside brackets to ::attr(attr)', () => {
    expect(normalizeSelector('meta[property="og:image"]@content')).toBe(
      'meta[property="og:image"]::attr(content)'
    );
    expect(normalizeSelector('img.main-image@src')).toBe('img.main-image::attr(src)');
    expect(normalizeSelector('a.product-link@href')).toBe('a.product-link::attr(href)');
  });

  it('leaves @ inside attribute brackets intact', () => {
    expect(normalizeSelector('a[href*="@domain.com"]')).toBe('a[href*="@domain.com"]');
  });

  it('automatically appends ::attr(content) to bare meta selectors', () => {
    expect(normalizeSelector('meta[property="og:image"]')).toBe(
      'meta[property="og:image"]::attr(content)'
    );
    expect(normalizeSelector('meta[name="twitter:title"]')).toBe(
      'meta[name="twitter:title"]::attr(content)'
    );
    expect(normalizeSelector('meta[itemprop="price"]')).toBe(
      'meta[itemprop="price"]::attr(content)'
    );
  });

  it('does not duplicate ::attr(content) if already present', () => {
    expect(normalizeSelector('meta[property="og:image"]::attr(content)')).toBe(
      'meta[property="og:image"]::attr(content)'
    );
  });

  it('parses Scrapy ::attr(attr) with parseSelector correctly', () => {
    const parsed = parseSelector('meta[property="og:image"]::attr(content)');
    expect(parsed.realSelector).toBe('meta[property="og:image"]');
    expect(parsed.method).toBe('attr');
    expect(parsed.attribute).toBe('content');
  });

  it('exports canonical User-Agent Chrome 154 string', () => {
    expect(CANONICAL_USER_AGENT).toContain('Chrome/154.0.0.0');
  });
});

describe('SystemSettingsService resetToDefaults Scoping', () => {
  let SystemSettingsService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };

    const mod = await import('../../src/services/domain/system/settings/system');
    SystemSettingsService = mod.SystemSettingsService;
  });

  it('resets selectors scope without resetting network or phrases', async () => {
    const service = new SystemSettingsService();
    const { settings, reset_count } = await service.resetToDefaults('selectors', 1);
    expect(settings).toBeDefined();
    expect(reset_count).toBe(14);
    const insertCalls = mockClient.query.mock.calls.filter(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO system_settings')
    );
    expect(insertCalls.length).toBe(14);
  });
});

describe('CSS-in-JS vs BEM Selector Validation (issue #281 review)', () => {
  it('accepts standard BEM modifier classes', () => {
    expect(validateSelector('.product-single__price--compare-at', 'price_selectors', 'https://example.com')).toBe(true);
    expect(validateSelector('.price--current', 'price_selectors', 'https://example.com')).toBe(true);
    expect(validateSelector('.product__price--compare', 'price_selectors', 'https://example.com')).toBe(true);
    expect(validateSelector('[class*="price--regular"]', 'price_selectors', 'https://example.com')).toBe(true);
    expect(validateSelector('.price--large', 'price_selectors', 'https://example.com')).toBe(true);
  });

  it('rejects hashed CSS-in-JS classes', () => {
    expect(validateSelector('.css-1x84a9z', 'price_selectors', 'https://example.com')).toBe(false);
    expect(validateSelector('.styled-abc123', 'price_selectors', 'https://example.com')).toBe(false);
    expect(validateSelector('.button--3k9xZ1', 'price_selectors', 'https://example.com')).toBe(false);
    expect(validateSelector('.Price__price--2mK9x', 'price_selectors', 'https://example.com')).toBe(false);
  });
});

describe('Image Srcset & Fragment Resolution (issue #262)', () => {
  it('preserves commas inside CDN transform parameters during srcset parsing', () => {
    const logitechSrcset =
      'https://resource.logitech.com/w_1440,c_limit,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png 1440w, https://resource.logitech.com/w_720,c_limit,q_auto,f_auto,dpr_2.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png 720w';

    const candidates = parseSrcset(logitechSrcset);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].width).toBe(1440);
    expect(candidates[0].url).toContain('w_1440,c_limit,q_auto');
    expect(candidates[1].width).toBe(720);
    expect(candidates[1].url).toContain('w_720,c_limit,q_auto');
  });

  it('rejects single-token CDN transform fragments from resolving to relative page URLs', () => {
    const pageUrl = 'https://www.logitech.com/en-au/shop/p/m650';
    expect(resolveImageUrl('c_fill', pageUrl)).toBeNull();
    expect(resolveImageUrl('w_1440', pageUrl)).toBeNull();
    expect(resolveImageUrl('h_660', pageUrl)).toBeNull();
    expect(resolveImageUrl('ar_24:11', pageUrl)).toBeNull();
    expect(resolveImageUrl('q_auto', pageUrl)).toBeNull();
    expect(resolveImageUrl('dpr_1.0', pageUrl)).toBeNull();
  });

  it('permits valid relative images with extensions or directory paths', () => {
    const pageUrl = 'https://example.com/products/item';
    expect(resolveImageUrl('hero.jpg', pageUrl)).toBe('https://example.com/products/hero.jpg');
    expect(resolveImageUrl('/media/c_fill/photo.png', pageUrl)).toBe('https://example.com/media/c_fill/photo.png');
  });
});
