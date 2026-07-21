import { systemSettingsRepository } from '../../../../models';
import { logger } from '../../../../utils/system/logger';
import { settingsCache } from '../../../../utils/cache';

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
      'debug_page_enabled',
      'retailer_updates_disabled',
      'scheduler_disabled',
      'prefer_jsonld_image',
      'searxng_url',
      'searxng_enabled'
    ];

    for (const key of validKeys) {
      if (updates[key] !== undefined) {
        await systemSettingsRepository.set(key, String(updates[key]));
        updatedKeys.push(key);
      }
    }

    if (updatedKeys.length > 0) {
      logger.info(`Settings | System Updated | ID: ${userId} | Keys: ${updatedKeys.join(', ')}`, 'Admin');
      settingsCache.clear();
    }

    return await systemSettingsRepository.getAll();
  }
}

export const systemSettingsService = new SystemSettingsService();
