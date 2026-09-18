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
      settings.vertex_api_key = settings.vertex_api_key ? maskKey(settings.vertex_api_key) : null;
      settings.deepseek_api_key = settings.deepseek_api_key ? maskKey(settings.deepseek_api_key) : null;
      settings.groq_api_key = settings.groq_api_key ? maskKey(settings.groq_api_key) : null;
      settings.mistral_api_key = settings.mistral_api_key ? maskKey(settings.mistral_api_key) : null;
      settings.openrouter_api_key = settings.openrouter_api_key ? maskKey(settings.openrouter_api_key) : null;
      settings.openai_compatible_api_key = settings.openai_compatible_api_key ? maskKey(settings.openai_compatible_api_key) : null;
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
      if (isMasked(updates.openrouter_api_key)) delete updates.openrouter_api_key;
      if (isMasked(updates.openai_compatible_api_key)) delete updates.openai_compatible_api_key;
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

  async getProviderModels(provider: string): Promise<{ models: any[]; refreshed_at: string | null }> {
    const modelsStr = await systemSettingsRepository.get(`${provider}_available_models`);
    const refreshedAt = await systemSettingsRepository.get(`${provider}_models_refreshed_at`);
    let models: any[] = [];
    if (modelsStr) {
      try {
        models = JSON.parse(modelsStr);
      } catch {
        models = [];
      }
    }
    return { models, refreshed_at: refreshedAt };
  }

  async refreshProviderModels(
    provider: string,
    credentials?: { apiKey?: string; baseUrl?: string }
  ): Promise<{ models: any[]; refreshed_at: string }> {
    const axios = (await import('axios')).default;
    const isMasked = (val?: string | null) => typeof val === 'string' && val.includes('...');

    let apiKey = credentials?.apiKey;
    let baseUrl = credentials?.baseUrl;

    if (!apiKey || isMasked(apiKey)) {
      const settings = await systemSettingsRepository.getAISettings();
      apiKey = (settings as any)[`${provider}_api_key`] || undefined;
    }
    if (!baseUrl) {
      const settings = await systemSettingsRepository.getAISettings();
      baseUrl = (settings as any)[`${provider}_base_url`] || undefined;
    }

    let models: any[] = [];

    switch (provider) {
      case 'gemini': {
        if (!apiKey) throw new Error('Gemini API key is required');
        return this.refreshGeminiModels(apiKey);
      }

      case 'openai': {
        if (!apiKey) throw new Error('OpenAI API key is required');
        const res = await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from OpenAI API');
        models = res.data.data
          .filter((m: any) => {
            const id = (m.id || '').toLowerCase();
            const isChat = id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt-');
            const isExcluded = id.includes('realtime') || id.includes('audio') || id.includes('transcribe') ||
                               id.includes('tts') || id.includes('embedding') || id.includes('moderation') ||
                               id.includes('dall-e') || id.includes('search');
            return isChat && !isExcluded;
          })
          .map((m: any) => ({ id: m.id, name: m.id }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        break;
      }

      case 'anthropic': {
        if (!apiKey) throw new Error('Anthropic API key is required');
        try {
          const res = await axios.get('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            timeout: 10000,
          });
          if (Array.isArray(res.data?.data)) {
            models = res.data.data
              .map((m: any) => ({
                id: m.id,
                name: m.display_name || m.id,
              }))
              .sort((a: any, b: any) => a.name.localeCompare(b.name));
          }
        } catch {
          models = [
            { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
          ];
        }
        break;
      }

      case 'groq': {
        if (!apiKey) throw new Error('Groq API key is required');
        const res = await axios.get('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from Groq API');
        models = res.data.data
          .filter((m: any) => m.active !== false && !m.id.includes('whisper') && !m.id.includes('tts') && !m.id.includes('guard'))
          .map((m: any) => ({ id: m.id, name: m.id }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        break;
      }

      case 'mistral': {
        if (!apiKey) throw new Error('Mistral API key is required');
        const res = await axios.get('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from Mistral API');
        models = res.data.data
          .filter((m: any) => !m.id.includes('embed') && !m.id.includes('moderation'))
          .map((m: any) => ({ id: m.id, name: m.name || m.id, description: m.description }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      }

      case 'deepseek': {
        if (!apiKey) throw new Error('DeepSeek API key is required');
        try {
          const res = await axios.get('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 10000,
          });
          if (Array.isArray(res.data?.data)) {
            models = res.data.data.map((m: any) => ({ id: m.id, name: m.id }));
          }
        } catch {
          models = [
            { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
          ];
        }
        break;
      }

      case 'openrouter': {
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await axios.get('https://openrouter.ai/api/v1/models', { headers, timeout: 10000 });
        if (!res.data?.data) throw new Error('Invalid response from OpenRouter API');
        models = res.data.data
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            description: m.description ? `${m.description.slice(0, 100)}...` : undefined,
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      }

      case 'ollama': {
        const cleanUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        const res = await axios.get(`${cleanUrl}/api/tags`, { timeout: 10000 });
        const rawModels = res.data?.models || [];
        models = rawModels.map((m: any) => ({ id: m.name, name: m.name }));
        break;
      }

      case 'openai_compatible': {
        if (!baseUrl) throw new Error('Base URL is required for OpenAI-compatible endpoints');
        const cleanUrl = baseUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = {};
        if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;
        let rawList: any[] = [];
        try {
          const res = await axios.get(`${cleanUrl}/v1/models`, { headers, timeout: 10000 });
          rawList = res.data?.data || res.data || [];
        } catch {
          const res = await axios.get(`${cleanUrl}/models`, { headers, timeout: 10000 });
          rawList = res.data?.data || res.data || [];
        }
        models = rawList.map((m: any) => ({ id: m.id || m.name, name: m.id || m.name }));
        break;
      }

      case 'vertex': {
        models = [
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
          { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash' },
        ];
        break;
      }

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    await systemSettingsRepository.set(`${provider}_available_models`, JSON.stringify(models));
    const now = new Date().toISOString();
    await systemSettingsRepository.set(`${provider}_models_refreshed_at`, now);

    return { models, refreshed_at: now };
  }

  async refreshGeminiModels(apiKey: string): Promise<{ models: any[]; refreshed_at: string }> {
    const axios = (await import('axios')).default;
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { timeout: 10000 });
    
    if (!response.data?.models) throw new Error('Invalid response from Gemini API');

    const models = response.data.models
      .filter((m: any) => {
        const name = m.name.toLowerCase();
        const isGemini = name.includes('gemini');
        const supportsGen = m.supportedGenerationMethods?.includes('generateContent');
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
