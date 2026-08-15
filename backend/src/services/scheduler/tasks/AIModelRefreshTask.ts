import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { aiSettingsService } from '../../domain/system/settings/ai';

/**
 * Refreshes the cached Gemini model list daily so the admin UI's model
 * dropdown and Verify action keep working without a manual sync (issue #46).
 * Skipped when no Gemini API key is configured.
 */
export async function refreshAIModels(): Promise<void> {
  try {
    const settings = await settingsCache.getAISettings();
    const apiKey = settings?.gemini_api_key;
    if (!apiKey) {
      logger.debug('Scheduler | AI Models | Skipped: no Gemini API key configured', 'Scheduler');
      return;
    }

    const result = await aiSettingsService.refreshGeminiModels(apiKey);
    logger.info(`Scheduler | AI Models | Refreshed ${result.models.length} Gemini models`, 'Scheduler');
  } catch (error) {
    logger.error('Scheduler | AI Models | Refresh failed', 'Scheduler', error);
  }
}
