import { systemSettingsRepository } from '../../../../models';
import { logger } from '../../../../utils/system/logger';
import { settingsCache } from '../../../../utils/cache';

export class AISettingsService {
  async getAISettings() {
    const settings = await systemSettingsRepository.getAISettings();
    const redactEnabled = process.env.REDACT_API_KEYS === 'true';

    if (redactEnabled) {
      const maskKey = (key: string | null) => {
        if (!key || key.length < 8) return '********';
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
      };

      settings.anthropic_api_key = settings.anthropic_api_key ? maskKey(settings.anthropic_api_key) : null;
      settings.openai_api_key = settings.openai_api_key ? maskKey(settings.openai_api_key) : null;
      settings.gemini_api_key = settings.gemini_api_key ? maskKey(settings.gemini_api_key) : null;
      settings.deepseek_api_key = settings.deepseek_api_key ? maskKey(settings.deepseek_api_key) : null;
      settings.groq_api_key = settings.groq_api_key ? maskKey(settings.groq_api_key) : null;
      settings.mistral_api_key = settings.mistral_api_key ? maskKey(settings.mistral_api_key) : null;
    }

    return {
      ...settings,
      redact_api_keys: redactEnabled
    };
  }

  async updateAISettings(updates: any, userId: number) {
    const redactEnabled = process.env.REDACT_API_KEYS === 'true';
    const oldSettings = await systemSettingsRepository.getAISettings();
    
    if (redactEnabled) {
      const isMasked = (val: any) => typeof val === 'string' && val.includes('...');
      
      if (isMasked(updates.anthropic_api_key)) delete updates.anthropic_api_key;
      if (isMasked(updates.openai_api_key)) delete updates.openai_api_key;
      if (isMasked(updates.gemini_api_key)) delete updates.gemini_api_key;
      if (isMasked(updates.vertex_api_key)) delete updates.vertex_api_key;
      if (isMasked(updates.deepseek_api_key)) delete updates.deepseek_api_key;
      if (isMasked(updates.groq_api_key)) delete updates.groq_api_key;
      if (isMasked(updates.mistral_api_key)) delete updates.mistral_api_key;
    }

    const settings = await systemSettingsRepository.updateAISettings(updates);

    const changes: string[] = [];
    const keys = Object.keys(updates);
    keys.forEach(key => {
      const newVal = updates[key];
      const oldVal = (oldSettings as any)[key];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        if (key.includes('api_key')) {
          changes.push(`${key} (REDACTED)`);
        } else {
          changes.push(`${key}: ${oldVal} -> ${newVal}`);
        }
      }
    });

    if (changes.length > 0) {
      logger.info(`Settings | Global AI Updated | ID: ${userId} | ${changes.join(' | ')}`, 'Admin');
      settingsCache.clear();
    }

    return this.getAISettings();
  }

  async refreshGeminiModels(apiKey: string): Promise<{ models: any[]; refreshed_at: string }> {
    const axios = (await import('axios')).default;
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { timeout: 10000 });
    
    if (!response.data?.models) throw new Error('Invalid response from Gemini API');

    const models = response.data.models
      .filter((m: any) => {
        const name = m.name.toLowerCase();
        const isGemini = name.includes('gemini');
        const supportsGen = m.supportedGenerationMethods.includes('generateContent');
        const isSpecialized = name.includes('tts') || 
                             name.includes('image') || 
                             name.includes('robotics') || 
                             name.includes('computer-use') ||
                             name.includes('embedding') ||
                             name.includes('customtools');
        
        return isGemini && supportsGen && !isSpecialized;
      })
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name,
        description: m.description,
      }))
      .sort((a: any, b: any) => {
        const aStable = a.description?.toLowerCase().includes('stable');
        const bStable = b.description?.toLowerCase().includes('stable');
        if (aStable && !bStable) return -1;
        if (!aStable && bStable) return 1;
        return 0;
      });

    await systemSettingsRepository.set('gemini_available_models', JSON.stringify(models));
    const now = new Date().toISOString();
    await systemSettingsRepository.set('gemini_models_refreshed_at', now);

    return { models, refreshed_at: now };
  }
}

export const aiSettingsService = new AISettingsService();
