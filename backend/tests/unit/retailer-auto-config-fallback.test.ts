import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRetailerMaintenance } from '../../src/services/scraper/orchestration/maintenance';
import { retailerRepository } from '../../src/models';
import { configCache, settingsCache } from '../../src/utils/cache';
import type { RetailerConfig } from '../../src/models';

vi.mock('../../src/models', () => ({
  retailerRepository: {
    upsert: vi.fn(),
  },
}));

vi.mock('../../src/utils/cache', () => ({
  configCache: {
    invalidate: vi.fn(),
  },
  settingsCache: {
    getRemoteScraperUrl: vi.fn(),
  },
}));

vi.mock('../../src/services/scraper/retailer-maintenance', () => ({
  flagBlockedRetailer: vi.fn(),
  restoreRetailerStatus: vi.fn(),
}));

describe('handleRetailerMaintenance auto-config on fallback and challenges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue('http://scraper:5100');
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
    vi.mocked(retailerRepository.upsert).mockResolvedValue(mockCreated as RetailerConfig);

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
    vi.mocked(retailerRepository.upsert).mockResolvedValue(mockCreated as RetailerConfig);

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

  // Blocker 1. With no `remote_scraper_url` there is no browser path at all
  // (`fetchBrowserHtml` returns '' without opening one), so writing the flag
  // cannot route the domain anywhere -- it only takes HTTP away from it,
  // permanently, because nothing ever clears it.
  it('does not enable the browser scraper on a new config when no remote scraper URL is set', async () => {
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue(null);
    const steps: string[] = [];
    vi.mocked(retailerRepository.upsert).mockResolvedValue({
      id: 101,
      domain: 'dicksmith.com.au',
      use_browser_scraper: false,
    } as RetailerConfig);

    await handleRetailerMaintenance(
      null,
      'DataDome Challenge',
      false,
      steps,
      undefined,
      { domain: 'dicksmith.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(retailerRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'dicksmith.com.au',
      status: 'BLOCKED',
      use_browser_scraper: false,
    }));
    expect(steps).toContain('Retailer | Config | Auto-created as BLOCKED with Browser Scraper: false');
  });

  it('creates no config at all for an unchallenged domain when no remote scraper URL is set', async () => {
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue(null);
    const steps: string[] = [];

    const result = await handleRetailerMaintenance(
      null,
      null,
      false,
      steps,
      undefined,
      { domain: 'example.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(retailerRepository.upsert).not.toHaveBeenCalled();
    expect(configCache.invalidate).not.toHaveBeenCalled();
    expect(result).toBeNull();
    expect(steps).toContain('Retailer | Config | Browser Scraper not configured, no config auto-created');
  });

  it('does not flip an existing config to the browser scraper when no remote scraper URL is set', async () => {
    vi.mocked(settingsCache.getRemoteScraperUrl).mockResolvedValue(null);
    const steps: string[] = [];
    const existing = { id: 7, domain: 'example.com.au', use_browser_scraper: false } as RetailerConfig;

    const result = await handleRetailerMaintenance(
      existing,
      'Akamai Access Denied',
      false,
      steps,
      undefined,
      { domain: 'example.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(result?.use_browser_scraper).toBe(false);
    expect(retailerRepository.upsert).not.toHaveBeenCalled();
  });

  it('does flip an existing config to the browser scraper once one is configured', async () => {
    const steps: string[] = [];
    const existing = { id: 7, domain: 'example.com.au', use_browser_scraper: false } as RetailerConfig;

    const result = await handleRetailerMaintenance(
      existing,
      'Akamai Access Denied',
      false,
      steps,
      undefined,
      { domain: 'example.com.au', learnedFlags: { use_browser_scraper: true } }
    );

    expect(result?.use_browser_scraper).toBe(true);
  });
});
