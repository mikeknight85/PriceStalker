import { systemSettingsRepository, userRepository } from '../../../models';
import {
  DEFAULT_REFRESH_INTERVAL_SETTING_KEY,
  parseRefreshInterval,
  resolveRefreshInterval,
} from '../../../utils/system/check-interval';

export interface ProductCheckDefaults {
  /** What the Add Product form should start at for this user. */
  refresh_interval: number;
  /** The instance default, so the UI can label "follow the instance default". */
  instance_refresh_interval: number;
}

/**
 * Answers "how often should a product this person is adding be checked?"
 * (issue #239).
 *
 * The ranking itself is pure and lives in `utils/system/check-interval`; this
 * service is only the part that has to read the two stored values.
 *
 * ## Why this does not go through SettingsCache
 *
 * `settingsCache` exists so the scraper can consult selector lists on every
 * extraction without a query, and it holds them for 30 minutes. That trade is
 * wrong for this value twice over: it is read once when the Add Product form
 * mounts and once per product added, so the cache saves nothing measurable; and
 * an administrator who changes the instance default and then adds a product to
 * check it would be shown the old number for up to half an hour and conclude
 * the setting is broken. `systemSettingsService.updateSettings` does clear the
 * cache on save, but only in the process that served the save -- which is not a
 * guarantee worth relying on. A direct read has no staleness to explain.
 */
export class DefaultCheckIntervalService {
  /** The instance default from `system_settings`, or the hardcoded fallback. */
  async getInstanceDefault(): Promise<number> {
    const stored = await systemSettingsRepository.get(DEFAULT_REFRESH_INTERVAL_SETTING_KEY);
    return resolveRefreshInterval({ instanceDefault: stored });
  }

  /**
   * Both numbers the Add Product form and the Tracking settings section need:
   * the interval in force for this user, and the instance default it falls back
   * to.
   */
  async getDefaults(userId: number): Promise<ProductCheckDefaults> {
    const [userPreference, instanceDefault] = await Promise.all([
      userRepository.getDefaultRefreshInterval(userId),
      systemSettingsRepository.get(DEFAULT_REFRESH_INTERVAL_SETTING_KEY),
    ]);

    return {
      refresh_interval: resolveRefreshInterval({ userPreference, instanceDefault }),
      instance_refresh_interval: resolveRefreshInterval({ instanceDefault }),
    };
  }

  /**
   * The interval to create a product with.
   *
   * An explicit value short-circuits both reads: the request already said what
   * it wants, and it is honoured exactly as sent.
   */
  async resolveForNewProduct(userId: number, explicit?: unknown): Promise<number> {
    const chosen = parseRefreshInterval(explicit);
    if (chosen !== null) return chosen;

    const { refresh_interval } = await this.getDefaults(userId);
    return refresh_interval;
  }
}

export const defaultCheckIntervalService = new DefaultCheckIntervalService();
