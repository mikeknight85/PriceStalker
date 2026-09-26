import { systemSettingsRepository } from '../../../../models';
import { AISettings, DiscoveredModel } from '../../../../models/types';
import { logger } from '../../../../utils/system/logger';
import { settingsCache } from '../../../../utils/cache';
import { isMaskedSecret, maskSecret } from '../../../ai/masking';

/**
 * The slice of an OpenAI-style `GET /models` body that model discovery reads.
 *
 * Every field is optional and nothing is assumed about it: this is a third
 * party's JSON, not ours. OpenAI, Groq, Mistral, DeepSeek, OpenRouter,
 * Anthropic and any OpenAI-compatible local server all answer in this shape,
 * differing only in which of these fields they bother to fill in.
 */
interface OpenAIStyleModelEntry {
  id?: string;
  name?: string;
  /** Anthropic's human-readable name. */
  display_name?: string;
  description?: string;
  /** Groq marks retired models `false`. */
  active?: boolean;
}

interface OpenAIStyleModelsResponse {
  data?: OpenAIStyleModelEntry[];
}

/** A local OpenAI-compatible server may answer with the bare array instead of `{ data: [...] }`. */
type OpenAICompatibleModelsBody = OpenAIStyleModelsResponse | OpenAIStyleModelEntry[];

interface OllamaTagsResponse {
  models?: { name?: string }[];
}

interface GeminiModelEntry {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModelEntry[];
}

/**
 * Keeps only the entries that actually carry a usable string id, so the filters
 * below can call `.includes()` on it without a provider's stray `{ id: null }`
 * taking the whole refresh down with a TypeError.
 */
function withUsableId<T extends { id?: string }>(entries: T[] | undefined): (T & { id: string })[] {
  return (entries ?? []).filter(
    (entry): entry is T & { id: string } => typeof entry.id === 'string' && entry.id.length > 0
  );
}

/** Guards the cached JSON in `system_settings`, which nothing validates on the way in. */
function isDiscoveredModel(value: unknown): value is DiscoveredModel {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; name?: unknown };
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

/**
 * Reads one `<provider>_api_key` / `<provider>_base_url` field off typed
 * settings. The field name is built from the provider string, so it is checked
 * against `AISettings`' keys rather than widened away, and a provider with no
 * such column (there is no `openai_base_url`) simply reads as undefined.
 */
function readSettingsField(settings: AISettings, field: string): string | undefined {
  const value = settings[field as keyof AISettings];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export class AISettingsService {
  async getAISettings() {
    const settings = await systemSettingsRepository.getAISettings();
    const redactEnabled = process.env.REDACT_API_KEYS === 'true';

    if (redactEnabled) {
      settings.anthropic_api_key = maskSecret(settings.anthropic_api_key);
      settings.openai_api_key = maskSecret(settings.openai_api_key);
      settings.gemini_api_key = maskSecret(settings.gemini_api_key);
      settings.vertex_api_key = maskSecret(settings.vertex_api_key);
      settings.deepseek_api_key = maskSecret(settings.deepseek_api_key);
      settings.groq_api_key = maskSecret(settings.groq_api_key);
      settings.mistral_api_key = maskSecret(settings.mistral_api_key);
      settings.openrouter_api_key = maskSecret(settings.openrouter_api_key);
      settings.openai_compatible_api_key = maskSecret(settings.openai_compatible_api_key);
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
      // The UI echoes back whatever `getAISettings` gave it, masked keys
      // included. Dropping those leaves the stored key alone instead of
      // overwriting a real credential with its own placeholder.
      if (isMaskedSecret(updates.anthropic_api_key)) delete updates.anthropic_api_key;
      if (isMaskedSecret(updates.openai_api_key)) delete updates.openai_api_key;
      if (isMaskedSecret(updates.gemini_api_key)) delete updates.gemini_api_key;
      if (isMaskedSecret(updates.vertex_api_key)) delete updates.vertex_api_key;
      if (isMaskedSecret(updates.deepseek_api_key)) delete updates.deepseek_api_key;
      if (isMaskedSecret(updates.groq_api_key)) delete updates.groq_api_key;
      if (isMaskedSecret(updates.mistral_api_key)) delete updates.mistral_api_key;
      if (isMaskedSecret(updates.openrouter_api_key)) delete updates.openrouter_api_key;
      if (isMaskedSecret(updates.openai_compatible_api_key)) delete updates.openai_compatible_api_key;
    }

    const settings = await systemSettingsRepository.updateAISettings(updates);

    const previous: Record<string, unknown> = { ...oldSettings };
    const changes: string[] = [];
    const keys = Object.keys(updates);
    keys.forEach(key => {
      const newVal = updates[key];
      const oldVal = previous[key];
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

  async getProviderModels(provider: string): Promise<{ models: DiscoveredModel[]; refreshed_at: string | null }> {
    const modelsStr = await systemSettingsRepository.get(`${provider}_available_models`);
    const refreshedAt = await systemSettingsRepository.get(`${provider}_models_refreshed_at`);
    let models: DiscoveredModel[] = [];
    if (modelsStr) {
      try {
        const parsed: unknown = JSON.parse(modelsStr);
        models = Array.isArray(parsed) ? parsed.filter(isDiscoveredModel) : [];
      } catch {
        models = [];
      }
    }
    return { models, refreshed_at: refreshedAt };
  }

  async refreshProviderModels(
    provider: string,
    credentials?: { apiKey?: string; baseUrl?: string }
  ): Promise<{ models: DiscoveredModel[]; refreshed_at: string }> {
    const axios = (await import('axios')).default;

    // One read serves both fallbacks below. A masked key is the placeholder the
    // admin UI was given, so it resolves to the stored credential; an absent one
    // does too, because the scheduled refresh (AIModelRefreshTask) supplies only
    // what the cached settings happened to hold.
    const storedSettings = await systemSettingsRepository.getAISettings();

    let apiKey = credentials?.apiKey;
    let baseUrl = credentials?.baseUrl;
    const storedBaseUrl = readSettingsField(storedSettings, `${provider}_base_url`);

    // Ollama and the OpenAI-compatible providers fetch the caller's own base
    // URL, so a stored key is only substituted when that URL is the saved one.
    // With REDACT_API_KEYS=true an administrator cannot read the saved key back
    // through the API, and this endpoint must not become a way to have it
    // posted to an address of their choosing. Every other provider talks to a
    // URL hard-coded below, where there is nothing to redirect.
    const willFetchCallerUrl = provider === 'ollama' || provider === 'openai_compatible';
    const storedKeyIsSafeToUse =
      !willFetchCallerUrl || !credentials?.baseUrl || credentials.baseUrl === storedBaseUrl;

    if (!apiKey || isMaskedSecret(apiKey)) {
      // A masked placeholder is dropped rather than forwarded: it is not a
      // credential and would only reach the provider as a malformed one.
      apiKey = storedKeyIsSafeToUse ? readSettingsField(storedSettings, `${provider}_api_key`) : undefined;
    }
    if (!baseUrl) {
      baseUrl = storedBaseUrl;
    }

    let models: DiscoveredModel[] = [];

    switch (provider) {
      case 'gemini': {
        if (!apiKey) throw new Error('Gemini API key is required');
        return this.refreshGeminiModels(apiKey);
      }

      case 'openai': {
        if (!apiKey) throw new Error('OpenAI API key is required');
        const res = await axios.get<OpenAIStyleModelsResponse>('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from OpenAI API');
        models = withUsableId(res.data.data)
          .filter((m) => {
            const id = m.id.toLowerCase();
            const isChat = id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt-');
            const isExcluded = id.includes('realtime') || id.includes('audio') || id.includes('transcribe') ||
                               id.includes('tts') || id.includes('embedding') || id.includes('moderation') ||
                               id.includes('dall-e') || id.includes('search');
            return isChat && !isExcluded;
          })
          .map((m) => ({ id: m.id, name: m.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
        break;
      }

      case 'anthropic': {
        if (!apiKey) throw new Error('Anthropic API key is required');
        try {
          const res = await axios.get<OpenAIStyleModelsResponse>('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            timeout: 10000,
          });
          if (Array.isArray(res.data?.data)) {
            models = withUsableId(res.data.data)
              .map((m) => ({
                id: m.id,
                name: m.display_name || m.id,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
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
        const res = await axios.get<OpenAIStyleModelsResponse>('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from Groq API');
        models = withUsableId(res.data.data)
          .filter((m) => m.active !== false && !m.id.includes('whisper') && !m.id.includes('tts') && !m.id.includes('guard'))
          .map((m) => ({ id: m.id, name: m.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
        break;
      }

      case 'mistral': {
        if (!apiKey) throw new Error('Mistral API key is required');
        const res = await axios.get<OpenAIStyleModelsResponse>('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        });
        if (!res.data?.data) throw new Error('Invalid response from Mistral API');
        models = withUsableId(res.data.data)
          .filter((m) => !m.id.includes('embed') && !m.id.includes('moderation'))
          .map((m) => ({ id: m.id, name: m.name || m.id, description: m.description }))
          .sort((a, b) => a.name.localeCompare(b.name));
        break;
      }

      case 'deepseek': {
        if (!apiKey) throw new Error('DeepSeek API key is required');
        try {
          const res = await axios.get<OpenAIStyleModelsResponse>('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 10000,
          });
          if (Array.isArray(res.data?.data)) {
            models = withUsableId(res.data.data).map((m) => ({ id: m.id, name: m.id }));
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
        const res = await axios.get<OpenAIStyleModelsResponse>('https://openrouter.ai/api/v1/models', { headers, timeout: 10000 });
        if (!res.data?.data) throw new Error('Invalid response from OpenRouter API');
        models = withUsableId(res.data.data)
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            description: m.description ? `${m.description.slice(0, 100)}...` : undefined,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        break;
      }

      case 'ollama': {
        const cleanUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        const res = await axios.get<OllamaTagsResponse>(`${cleanUrl}/api/tags`, { timeout: 10000 });
        models = (res.data?.models ?? [])
          .map((m) => m.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
          .map((name) => ({ id: name, name }));
        break;
      }

      case 'openai_compatible': {
        if (!baseUrl) throw new Error('Base URL is required for OpenAI-compatible endpoints');
        const cleanUrl = baseUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = {};
        if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;
        let body: OpenAICompatibleModelsBody | undefined;
        try {
          const res = await axios.get<OpenAICompatibleModelsBody>(`${cleanUrl}/v1/models`, { headers, timeout: 10000 });
          body = res.data;
        } catch {
          const res = await axios.get<OpenAICompatibleModelsBody>(`${cleanUrl}/models`, { headers, timeout: 10000 });
          body = res.data;
        }
        const entries = Array.isArray(body) ? body : body?.data ?? [];
        models = entries
          .map((entry) => entry.id || entry.name)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .map((id) => ({ id, name: id }));
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

  async refreshGeminiModels(apiKey: string): Promise<{ models: DiscoveredModel[]; refreshed_at: string }> {
    const axios = (await import('axios')).default;
    const response = await axios.get<GeminiModelsResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 10000 }
    );

    if (!response.data?.models) throw new Error('Invalid response from Gemini API');

    const models: DiscoveredModel[] = response.data.models
      .filter((m): m is GeminiModelEntry & { name: string } => typeof m.name === 'string' && m.name.length > 0)
      .filter((m) => {
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
      .map((m) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name,
        description: m.description,
      }))
      .sort((a, b) => {
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
