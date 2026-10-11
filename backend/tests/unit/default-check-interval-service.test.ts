import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The stored half of the default check interval (issue #239).
 *
 * The ranking itself is covered by default-check-interval.test.ts. What is
 * tested here is that the service reads the two stored values that feed it, in
 * the right roles -- getting the user preference and the instance default the
 * wrong way round would look correct on a single-user instance and be wrong on
 * every other one -- and that an explicit interval costs no query at all.
 */

const users = { getDefaultRefreshInterval: vi.fn() };
const systemSettings = { get: vi.fn() };

vi.mock('../../src/models', () => ({
  userRepository: users,
  systemSettingsRepository: systemSettings,
}));

const ONE_HOUR = 3600;
const SIX_HOURS = 21600;
const TWELVE_HOURS = 43200;
const TWENTY_FOUR_HOURS = 86400;

async function service() {
  const mod = await import('../../src/services/domain/product/DefaultCheckIntervalService');
  return mod.defaultCheckIntervalService;
}

describe('DefaultCheckIntervalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    users.getDefaultRefreshInterval.mockResolvedValue(null);
    systemSettings.get.mockResolvedValue(null);
  });

  it("creates a product on the user's own default when they have one", async () => {
    users.getDefaultRefreshInterval.mockResolvedValue(SIX_HOURS);
    systemSettings.get.mockResolvedValue('86400');

    expect(await (await service()).resolveForNewProduct(1)).toBe(SIX_HOURS);
  });

  it('creates it on the instance default when the user has no preference', async () => {
    systemSettings.get.mockResolvedValue('21600');

    expect(await (await service()).resolveForNewProduct(1)).toBe(SIX_HOURS);
    expect(systemSettings.get).toHaveBeenCalledWith('default_refresh_interval');
  });

  it('creates it on 12 hours when neither is set', async () => {
    // What every instance did before this setting existed, and what one whose
    // settings row is missing still does.
    expect(await (await service()).resolveForNewProduct(1)).toBe(TWELVE_HOURS);
  });

  it('honours an interval the request carried without reading either default', async () => {
    const resolved = await (await service()).resolveForNewProduct(1, ONE_HOUR);

    expect(resolved).toBe(ONE_HOUR);
    expect(users.getDefaultRefreshInterval).not.toHaveBeenCalled();
    expect(systemSettings.get).not.toHaveBeenCalled();
  });

  it('reports the effective default and the instance default separately', async () => {
    // The settings screen needs both: the value in force, and the one it falls
    // back to, so it can say what "follow the instance default" means.
    users.getDefaultRefreshInterval.mockResolvedValue(TWENTY_FOUR_HOURS);
    systemSettings.get.mockResolvedValue('21600');

    expect(await (await service()).getDefaults(1)).toEqual({
      refresh_interval: TWENTY_FOUR_HOURS,
      instance_refresh_interval: SIX_HOURS,
    });
  });

  it('reports the fallback as the instance default when none is stored', async () => {
    expect(await (await service()).getInstanceDefault()).toBe(TWELVE_HOURS);
  });

  it('reads the user preference for the account doing the adding', async () => {
    await (await service()).getDefaults(42);

    expect(users.getDefaultRefreshInterval).toHaveBeenCalledWith(42);
  });
});
