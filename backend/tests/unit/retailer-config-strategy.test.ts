import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRetailerConfig } from '../../src/services/ai/strategies/retailer-config';
import { settingsCache } from '../../src/utils/cache';
import { currencyCache } from '../../src/utils/i18n/currency/cache';
import { getAIProvider } from '../../src/services/ai/client';
import type { AISettings } from '../../src/models/types/system';
import type { AIProvider } from '../../src/services/ai/providers/types';

vi.mock('../../src/utils/cache', () => ({
  settingsCache: {
    getAISettings: vi.fn(),
  },
}));

vi.mock('../../src/utils/i18n/currency/cache', () => ({
  currencyCache: {
    getGlobalCurrencies: vi.fn(),
  },
}));

vi.mock('../../src/services/ai/client', () => ({
  getAIProvider: vi.fn(),
}));

vi.mock('../../src/services/ai/html-preprocessor', () => ({
  prepareHtmlForAI: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
}));

describe('generateRetailerConfig quality gate', () => {
  const mockProvider = {
    generate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsCache.getAISettings).mockResolvedValue({
      ai_auto_mapping_enabled: true,
      ai_provider: 'gemini',
    } as unknown as AISettings);
    vi.mocked(currencyCache.getGlobalCurrencies).mockResolvedValue([
      { iso: 'AUD' },
      { iso: 'USD' },
    ] as unknown as Awaited<ReturnType<typeof currencyCache.getGlobalCurrencies>>);
    vi.mocked(getAIProvider).mockReturnValue(mockProvider as unknown as AIProvider);
  });

  it('accepts config with deal_price_selectors even if standard price_selectors are empty', async () => {
    mockProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        retailer_name: 'Store With Deal',
        deal_price_selectors: ['.deal-price-amount'],
        name_selectors: ['h1.title'],
      }),
    });

    const result = await generateRetailerConfig('<html></html>', 'https://example.com/item');
    expect(result).not.toBeNull();
    expect(result?.deal_price_selectors).toEqual(['.deal-price-amount']);
  });

  it('accepts config with member_price_selectors even if standard price_selectors are empty', async () => {
    mockProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        retailer_name: 'Store With Member Price',
        member_price_selectors: ['.member-price-val'],
        name_selectors: ['h1.title'],
      }),
    });

    const result = await generateRetailerConfig('<html></html>', 'https://example.com/item');
    expect(result).not.toBeNull();
    expect(result?.member_price_selectors).toEqual(['.member-price-val']);
  });

  it('accepts config with pre_order_price_selectors even if standard price_selectors are empty', async () => {
    mockProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        retailer_name: 'Store With Pre-Order',
        pre_order_price_selectors: ['.preorder-price-val'],
        name_selectors: ['h1.title'],
      }),
    });

    const result = await generateRetailerConfig('<html></html>', 'https://example.com/item');
    expect(result).not.toBeNull();
    expect(result?.pre_order_price_selectors).toEqual(['.preorder-price-val']);
  });

  it('accepts config with jsonld_price_key even if CSS price selectors are empty', async () => {
    mockProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        retailer_name: 'Store With JsonLD',
        jsonld_price_key: 'offers.price',
        name_selectors: ['h1.title'],
      }),
    });

    const result = await generateRetailerConfig('<html></html>', 'https://example.com/item');
    expect(result).not.toBeNull();
    expect(result?.jsonld_price_key).toBe('offers.price');
  });

  it('rejects config when no price selectors of any category and no jsonld price key are found', async () => {
    mockProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        retailer_name: 'Store Without Price',
        name_selectors: ['h1.title'],
      }),
    });

    const result = await generateRetailerConfig('<html></html>', 'https://example.com/item');
    expect(result).toBeNull();
  });
});
