import pool from '../../../../config/database';
import { AISettings } from '../../../../models/types';

// System settings queries
export const systemSettingsRepository = {
  get: async (key: string): Promise<string | null> => {
    const result = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );
    return result.rows[0]?.value || null;
  },

  set: async (key: string, value: string): Promise<void> => {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  },

  getAISettings: async (): Promise<AISettings> => {
    const all = await systemSettingsRepository.getAll();
    return {
      ai_enabled: all.ai_enabled === 'true',
      ai_verification_enabled: all.ai_verification_enabled === 'true',
      ai_auto_mapping_enabled: all.ai_auto_mapping_enabled === 'true',
      ai_provider: (all.ai_provider as any) || 'anthropic',
      anthropic_api_key: all.anthropic_api_key || null,
      anthropic_model: all.anthropic_model || null,
      openai_api_key: all.openai_api_key || null,
      openai_model: all.openai_model || null,
      ollama_base_url: all.ollama_base_url || null,
      ollama_model: all.ollama_model || null,
      gemini_api_key: all.gemini_api_key || null,
      gemini_model: all.gemini_model || null,
      vertex_project_id: all.vertex_project_id || null,
      vertex_location: all.vertex_location || null,
      vertex_api_key: all.vertex_api_key || null,
      vertex_model: all.vertex_model || null,
      deepseek_api_key: all.deepseek_api_key || null,
      deepseek_model: all.deepseek_model || null,
      groq_api_key: all.groq_api_key || null,
      groq_model: all.groq_model || null,
      mistral_api_key: all.mistral_api_key || null,
      mistral_model: all.mistral_model || null,
      jsonld_image_key: all.jsonld_image_key || 'image',
      jsonld_price_key: all.jsonld_price_key || 'price',
      jsonld_name_key: all.jsonld_name_key || 'name',
      prefer_jsonld_image: all.prefer_jsonld_image === 'true',
      ai_timeout: parseInt(all.ai_timeout || '30000', 10),
      ai_max_retries: parseInt(all.ai_max_retries || '2', 10),
    };
  },

  updateAISettings: async (settings: Partial<AISettings>): Promise<AISettings> => {
    if (settings.ai_enabled !== undefined) await systemSettingsRepository.set('ai_enabled', String(settings.ai_enabled));
    if (settings.ai_verification_enabled !== undefined) await systemSettingsRepository.set('ai_verification_enabled', String(settings.ai_verification_enabled));
    if (settings.ai_auto_mapping_enabled !== undefined) await systemSettingsRepository.set('ai_auto_mapping_enabled', String(settings.ai_auto_mapping_enabled));
    if (settings.ai_provider !== undefined) await systemSettingsRepository.set('ai_provider', String(settings.ai_provider));
    if (settings.anthropic_api_key !== undefined) await systemSettingsRepository.set('anthropic_api_key', settings.anthropic_api_key || '');
    if (settings.anthropic_model !== undefined) await systemSettingsRepository.set('anthropic_model', settings.anthropic_model || '');
    if (settings.openai_api_key !== undefined) await systemSettingsRepository.set('openai_api_key', settings.openai_api_key || '');
    if (settings.openai_model !== undefined) await systemSettingsRepository.set('openai_model', settings.openai_model || '');
    if (settings.ollama_base_url !== undefined) await systemSettingsRepository.set('ollama_base_url', settings.ollama_base_url || '');
    if (settings.ollama_model !== undefined) await systemSettingsRepository.set('ollama_model', settings.ollama_model || '');
    if (settings.gemini_api_key !== undefined) await systemSettingsRepository.set('gemini_api_key', settings.gemini_api_key || '');
    if (settings.gemini_model !== undefined) await systemSettingsRepository.set('gemini_model', settings.gemini_model || '');
    if (settings.vertex_project_id !== undefined) await systemSettingsRepository.set('vertex_project_id', settings.vertex_project_id || '');
    if (settings.vertex_location !== undefined) await systemSettingsRepository.set('vertex_location', settings.vertex_location || '');
    if (settings.vertex_api_key !== undefined) await systemSettingsRepository.set('vertex_api_key', settings.vertex_api_key || '');
    if (settings.vertex_model !== undefined) await systemSettingsRepository.set('vertex_model', settings.vertex_model || '');
    if (settings.deepseek_api_key !== undefined) await systemSettingsRepository.set('deepseek_api_key', settings.deepseek_api_key || '');
    if (settings.deepseek_model !== undefined) await systemSettingsRepository.set('deepseek_model', settings.deepseek_model || '');
    if (settings.groq_api_key !== undefined) await systemSettingsRepository.set('groq_api_key', settings.groq_api_key || '');
    if (settings.groq_model !== undefined) await systemSettingsRepository.set('groq_model', settings.groq_model || '');
    if (settings.mistral_api_key !== undefined) await systemSettingsRepository.set('mistral_api_key', settings.mistral_api_key || '');
    if (settings.mistral_model !== undefined) await systemSettingsRepository.set('mistral_model', settings.mistral_model || '');
    if (settings.jsonld_image_key !== undefined) await systemSettingsRepository.set('jsonld_image_key', settings.jsonld_image_key || 'image');
    if (settings.jsonld_price_key !== undefined) await systemSettingsRepository.set('jsonld_price_key', settings.jsonld_price_key || 'price');
    if (settings.jsonld_name_key !== undefined) await systemSettingsRepository.set('jsonld_name_key', settings.jsonld_name_key || 'name');
    if (settings.prefer_jsonld_image !== undefined) await systemSettingsRepository.set('prefer_jsonld_image', String(settings.prefer_jsonld_image));
    if (settings.ai_timeout !== undefined) await systemSettingsRepository.set('ai_timeout', String(settings.ai_timeout));
    if (settings.ai_max_retries !== undefined) await systemSettingsRepository.set('ai_max_retries', String(settings.ai_max_retries));
    
    return systemSettingsRepository.getAISettings();
  },

  getAll: async (): Promise<Record<string, string>> => {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },
};
