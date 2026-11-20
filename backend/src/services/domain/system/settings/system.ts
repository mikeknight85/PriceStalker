import { systemSettingsRepository } from '../../../../models';
import { logger } from '../../../../utils/system/logger';
import { settingsCache } from '../../../../utils/cache';
import {
  DEFAULT_REFRESH_INTERVAL_SETTING_KEY,
  FALLBACK_REFRESH_INTERVAL_SECONDS,
  normaliseDefaultRefreshInterval,
} from '../../../../utils/system/check-interval';

export class SystemSettingsService {
  async getSettings(): Promise<Record<string, string>> {
    return await systemSettingsRepository.getAll();
  }

  async getSetting(key: string): Promise<string | null> {
    return await systemSettingsRepository.get(key);
  }

  async updateSettings(updates: Record<string, any>, userId: number): Promise<Record<string, string>> {
    const updatedKeys: string[] = [];
    const validKeys = [
      'registration_enabled',
      'password_reset_enabled',
      'browser_timeout', 
      'browser_delay', 
      'scraper_proxy', 
      'remote_scraper_url',
      'default_user_agent',
      'default_referrer',
      'generic_price_selectors',
      'generic_deal_price_selectors',
      'generic_member_price_selectors',
      'generic_pre_order_price_selectors',
      'generic_retailer_name_selectors',
      'generic_original_price_selectors',
      'generic_name_selectors',
      'generic_image_selectors',
      'generic_stock_selectors',
      'generic_exclusion_selectors',
      'generic_in_stock_phrases',
      'generic_out_of_stock_phrases',
      'generic_pre_order_phrases',
      'generic_challenge_phrases',
      'debug_page_enabled',
      'retailer_updates_disabled',
      'scheduler_disabled',
      'prefer_jsonld_image',
      'searxng_url',
      'searxng_enabled',
      'telemetry_enabled',
      'telemetry_instance_id',
      'telemetry_last_ping_at',
      'url_canonical_rules',
      DEFAULT_REFRESH_INTERVAL_SETTING_KEY
    ];

    for (const key of validKeys) {
      if (updates[key] !== undefined) {
        await systemSettingsRepository.set(key, this.serialiseSetting(key, updates[key]));
        updatedKeys.push(key);
      }
    }

    if (updatedKeys.length > 0) {
      logger.info(`Settings | System Updated | ID: ${userId} | Keys: ${updatedKeys.join(', ')}`, 'Admin');
      settingsCache.clear();
    }

    return await systemSettingsRepository.getAll();
  }

  /**
   * Everything in `system_settings` is stored as text, and for all but one key
   * that is just `String(value)`.
   *
   * The instance default check interval is held to a floor and a ceiling first
   * (issue #239). It is the one setting here that is applied to every product
   * somebody adds, so a five-minute value entered by hand -- or sent straight
   * to the API -- would multiply into traffic against every retailer on the
   * instance. An unusable value falls back to the 12 hours the form used to
   * hardcode rather than being stored as 'NaN' for the next reader to puzzle
   * over.
   */
  private serialiseSetting(key: string, value: any): string {
    if (key === DEFAULT_REFRESH_INTERVAL_SETTING_KEY) {
      return String(normaliseDefaultRefreshInterval(value) ?? FALLBACK_REFRESH_INTERVAL_SECONDS);
    }
    if (key === 'url_canonical_rules') {
      let candidate: any = value;
      if (typeof value === 'string') {
        try {
          candidate = JSON.parse(value);
        } catch {
          throw new Error('Invalid URL canonicalization rules: payload must be valid JSON');
        }
      }
      if (!Array.isArray(candidate)) {
        throw new Error('Invalid URL canonicalization rules: rules must be an array');
      }

      const validated = candidate.map((rule, idx) => {
        if (!rule || typeof rule !== 'object') {
          throw new Error(`Invalid URL canonicalization rule at index ${idx}: expected an object`);
        }
        const { domain_pattern, path_match, path_replacement, description } = rule;
        if (!domain_pattern || typeof domain_pattern !== 'string') {
          throw new Error(`Invalid URL canonicalization rule at index ${idx}: domain_pattern is required`);
        }
        if (!path_match || typeof path_match !== 'string') {
          throw new Error(`Invalid URL canonicalization rule at index ${idx}: path_match is required`);
        }
        if (typeof path_replacement !== 'string') {
          throw new Error(`Invalid URL canonicalization rule at index ${idx}: path_replacement is required`);
        }

        try {
          new RegExp(domain_pattern);
        } catch (e: any) {
          throw new Error(`Invalid domain pattern regex at index ${idx}: ${e.message}`);
        }
        try {
          new RegExp(path_match);
        } catch (e: any) {
          throw new Error(`Invalid path match regex at index ${idx}: ${e.message}`);
        }

        return {
          domain_pattern: domain_pattern.trim(),
          path_match: path_match.trim(),
          path_replacement: path_replacement.trim(),
          description: typeof description === 'string' ? description.trim() : undefined,
        };
      });

      return JSON.stringify(validated);
    }
    return String(value);
  }
}

export const systemSettingsService = new SystemSettingsService();
