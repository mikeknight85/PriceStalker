import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { aiSettingsService } from '../../domain/system/settings/ai';

/**
 * Refreshes cached model lists daily for all configured AI providers so the admin UI's
 * model dropdowns and verification actions remain up to date without requiring manual sync (issues #46, #200).
 */
export async function refreshAIModels(): Promise<void> {
  try {
    const settings = await settingsCache.getAISettings();
    if (!settings) return;

    const providers: { name: string; key?: string | null; baseUrl?: string | null }[] = [
      { name: 'gemini', key: settings.gemini_api_key },
      { name: 'openai', key: settings.openai_api_key },
      { name: 'anthropic', key: settings.anthropic_api_key },
      { name: 'groq', key: settings.groq_api_key },
      { name: 'mistral', key: settings.mistral_api_key },
      { name: 'deepseek', key: settings.deepseek_api_key },
      { name: 'openrouter', key: settings.openrouter_api_key },
      { name: 'ollama', baseUrl: settings.ollama_base_url },
      { name: 'openai_compatible', baseUrl: settings.openai_compatible_base_url, key: settings.openai_compatible_api_key },
    ];

    for (const p of providers) {
      if (!p.key && !p.baseUrl) continue;
      try {
        const result = await aiSettingsService.refreshProviderModels(p.name, {
          apiKey: p.key || undefined,
          baseUrl: p.baseUrl || undefined,
        });
        logger.info(`Scheduler | AI Models | Refreshed ${result.models.length} ${p.name} models`, 'Scheduler');
      } catch (err) {
        logger.warn(`Scheduler | AI Models | ${p.name} refresh skipped or failed`, 'Scheduler', err);
      }
    }
  } catch (error) {
    logger.error('Scheduler | AI Models | Refresh task failed', 'Scheduler', error);
  }
}
