import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeSelector, parseSelector } from '../../src/services/scraper/core/selectors';
import { CANONICAL_USER_AGENT } from '../../src/utils/system/user-agent-constants';

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
    const settings = await service.resetToDefaults('selectors', 1);
    expect(settings).toBeDefined();
    const insertCalls = mockClient.query.mock.calls.filter(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO system_settings')
    );
    expect(insertCalls.length).toBe(14);
  });
});
