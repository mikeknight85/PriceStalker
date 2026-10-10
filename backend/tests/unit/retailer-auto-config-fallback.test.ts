import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRetailerMaintenance } from '../../src/services/scraper/orchestration/maintenance';
import { retailerRepository } from '../../src/models';
import { configCache } from '../../src/utils/cache';

vi.mock('../../src/models', () => ({
  retailerRepository: {
    upsert: vi.fn(),
  },
}));

vi.mock('../../src/utils/cache', () => ({
  configCache: {
    invalidate: vi.fn(),
  },
}));

vi.mock('../../src/services/scraper/retailer-maintenance', () => ({
  flagBlockedRetailer: vi.fn(),
  restoreRetailerStatus: vi.fn(),
}));

describe('handleRetailerMaintenance auto-config on fallback and challenges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-creates retailer config shell with use_browser_scraper=true when an unknown domain hits a challenge', async () => {
    const steps: string[] = [];
    const mockCreated = {
      id: 99,
      domain: 'dicksmith.com.au',
      name: 'Dicksmith',
      status: 'BLOCKED',
      use_browser_scraper: true,
    };
    (retailerRepository.upsert as any).mockResolvedValue(mockCreated);

    const result = await handleRetailerMaintenance(
      null,
      'DataDome Challenge',
      false,
      steps,
      undefined,
      { domain: 'dicksmith.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(retailerRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'dicksmith.com.au',
      name: 'Dicksmith',
      status: 'BLOCKED',
      use_browser_scraper: true,
      active: true,
    }));
    expect(configCache.invalidate).toHaveBeenCalledWith('dicksmith.com.au');
    expect(result).toEqual(mockCreated);
    expect(steps).toContain('Retailer | Config | Auto-created as BLOCKED with Browser Scraper: true');
  });

  it('auto-creates retailer config with use_browser_scraper=true when unknown domain needed fallback without persistent challenge', async () => {
    const steps: string[] = [];
    const mockCreated = {
      id: 100,
      domain: 'example.com.au',
      name: 'Example',
      status: 'OK',
      use_browser_scraper: true,
    };
    (retailerRepository.upsert as any).mockResolvedValue(mockCreated);

    const result = await handleRetailerMaintenance(
      null,
      null,
      false,
      steps,
      undefined,
      { domain: 'example.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(retailerRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'example.com.au',
      name: 'Example',
      status: 'OK',
      use_browser_scraper: true,
      active: true,
    }));
    expect(configCache.invalidate).toHaveBeenCalledWith('example.com.au');
    expect(result).toEqual(mockCreated);
  });
});
