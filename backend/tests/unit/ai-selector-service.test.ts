import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiSelectorService } from '../../src/services/domain/retailer/AISelectorService';
import { configCache, settingsCache } from '../../src/utils/cache';

vi.mock('../../src/utils/cache', () => {
  return {
    configCache: {
      getConfig: vi.fn(),
    },
    settingsCache: {
      getGenericAIPriceSelectors: vi.fn(),
      getGenericAIImageSelectors: vi.fn(),
    }
  };
});

describe('AISelectorService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fall back to generic system-wide selectors when no domain config exists', async () => {
    vi.mocked(configCache.getConfig).mockResolvedValue(null);
    vi.mocked(settingsCache.getGenericAIPriceSelectors).mockResolvedValue(['.generic-price']);
    vi.mocked(settingsCache.getGenericAIImageSelectors).mockResolvedValue(['.generic-image']);

    const selectors = await aiSelectorService.getAISelectorsForDomain('example.com');

    expect(selectors.price).toEqual(['.generic-price']);
    expect(selectors.image).toEqual(['.generic-image']);
    expect(configCache.getConfig).toHaveBeenCalledWith('example.com');
  });

  it('should fall back to generic system-wide selectors when domain config has null ai_selectors', async () => {
    vi.mocked(configCache.getConfig).mockResolvedValue({
      id: 1,
      domain: 'example.com',
      ai_selectors: null,
    } as any);
    vi.mocked(settingsCache.getGenericAIPriceSelectors).mockResolvedValue(['.generic-price']);
    vi.mocked(settingsCache.getGenericAIImageSelectors).mockResolvedValue(['.generic-image']);

    const selectors = await aiSelectorService.getAISelectorsForDomain('https://example.com/product');

    expect(selectors.price).toEqual(['.generic-price']);
    expect(selectors.image).toEqual(['.generic-image']);
    expect(configCache.getConfig).toHaveBeenCalledWith('example.com/product');
  });

  it('should use override selectors when domain config contains valid ai_selectors', async () => {
    vi.mocked(configCache.getConfig).mockResolvedValue({
      id: 2,
      domain: 'override.com',
      ai_selectors: {
        price: ['.custom-price'],
        image: ['.custom-image'],
      },
    } as any);

    const selectors = await aiSelectorService.getAISelectorsForDomain('override.com');

    expect(selectors.price).toEqual(['.custom-price']);
    expect(selectors.image).toEqual(['.custom-image']);
    expect(settingsCache.getGenericAIPriceSelectors).not.toHaveBeenCalled();
    expect(settingsCache.getGenericAIImageSelectors).not.toHaveBeenCalled();
  });
});
