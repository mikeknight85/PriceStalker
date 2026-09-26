import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { isMaskedSecret, maskSecret } from '../../src/services/ai/masking';
import { AISettingsService } from '../../src/services/domain/system/settings/ai';
import { systemSettingsRepository } from '../../src/models';
import type { AISettings } from '../../src/models/types';

/**
 * Masked credentials, in one place (issues #196, #198, #200).
 *
 * With REDACT_API_KEYS=true the admin UI never holds a real provider key: it is
 * given a masked form and hands that same string back when it saves a section,
 * tests a connection or syncs a model list. The rules below are the ones that
 * had drifted into three different copies, so they are pinned here.
 */

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../../src/models', () => ({
  systemSettingsRepository: {
    getAISettings: vi.fn(),
    updateAISettings: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn(),
  },
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const repo = vi.mocked(systemSettingsRepository);
const get = vi.mocked(axios.get);

/**
 * Stores only the fields a test cares about. `Partial<AISettings>` still checks
 * every field name and type -- a mistyped `gemini_api_ky` fails to compile --
 * and the widening happens once, here at the mock boundary, rather than at
 * every call site.
 */
function storedSettings(fields: Partial<AISettings>): AISettings {
  return fields as AISettings;
}

describe('AI credential masking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('maskSecret and isMaskedSecret are a matched pair', () => {
    it('keeps the four-and-four form for a key long enough to hide', () => {
      expect(maskSecret('sk-abcdefghijkl1234')).toBe('sk-a...1234');
    });

    it('replaces a short key wholesale rather than revealing most of it', () => {
      expect(maskSecret('short')).toBe('********');
    });

    it('reports nothing stored as nothing, not as a mask', () => {
      expect(maskSecret(null)).toBeNull();
      expect(maskSecret(undefined)).toBeNull();
      expect(maskSecret('')).toBeNull();
    });

    it('recognises every mask it can itself produce', () => {
      // The invariant that keeps a masked key from being sent to a provider:
      // if maskSecret can return it, isMaskedSecret has to spot it. A short key
      // masks to ******** and carries no ellipsis, which is how one copy of the
      // old check missed it.
      for (const key of ['sk-abcdefghijkl1234', 'short', 'ya29.a-longer-token-value', 'abcdefgh']) {
        const masked = maskSecret(key);
        expect(masked).not.toBeNull();
        expect(isMaskedSecret(masked)).toBe(true);
      }
    });

    it('does not treat a missing credential as a masked one', () => {
      // "Missing" and "withheld" are answered differently: a missing key is a
      // 400, a withheld one is resolved from storage.
      expect(isMaskedSecret(undefined)).toBe(false);
      expect(isMaskedSecret(null)).toBe(false);
      expect(isMaskedSecret('')).toBe(false);
    });

    it('does not treat a real key as masked', () => {
      expect(isMaskedSecret('sk-proj-abcdef0123456789')).toBe(false);
      expect(isMaskedSecret('ya29.c0AY_VpZgLongOpaqueToken')).toBe(false);
    });
  });

  describe('updateAISettings', () => {
    it('drops a masked key instead of overwriting the stored one', async () => {
      const originalEnv = process.env.REDACT_API_KEYS;
      process.env.REDACT_API_KEYS = 'true';
      try {
        repo.getAISettings.mockResolvedValue(storedSettings({ openai_api_key: 'sk-realkey1234' }));
        repo.updateAISettings.mockResolvedValue(storedSettings({}));

        const service = new AISettingsService();
        // Both mask shapes: the ellipsis form and the wholesale form a short
        // key produces. Neither is a credential and neither must be saved.
        await service.updateAISettings(
          { openai_api_key: 'sk-r...1234', groq_api_key: '********', gemini_model: 'gemini-2.5-flash' },
          7
        );

        expect(repo.updateAISettings).toHaveBeenCalledWith({ gemini_model: 'gemini-2.5-flash' });
      } finally {
        process.env.REDACT_API_KEYS = originalEnv;
      }
    });
  });

  describe('getProviderModels', () => {
    it('ignores cached entries that are not models', async () => {
      // Nothing validates this JSON on the way into system_settings.
      repo.get.mockImplementation(async (key: string) =>
        key.endsWith('_available_models')
          ? '[{"id":"gpt-4o-mini","name":"gpt-4o-mini"},{"name":"no id"},"nonsense",null]'
          : '2026-09-20T05:00:00.000Z'
      );

      const service = new AISettingsService();
      const result = await service.getProviderModels('openai');

      expect(result.models).toEqual([{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }]);
      expect(result.refreshed_at).toBe('2026-09-20T05:00:00.000Z');
    });

    it('returns an empty list rather than throwing on malformed JSON', async () => {
      repo.get.mockResolvedValue('{not json');
      const service = new AISettingsService();
      await expect(service.getProviderModels('openai')).resolves.toEqual({
        models: [],
        refreshed_at: '{not json',
      });
    });
  });

  describe('refreshProviderModels', () => {
    it('resolves the stored key behind a masked one, reading settings once', async () => {
      repo.getAISettings.mockResolvedValue(storedSettings({ openai_api_key: 'sk-realkey1234' }));
      get.mockResolvedValue({ data: { data: [{ id: 'gpt-4o-mini' }] } });

      const service = new AISettingsService();
      const result = await service.refreshProviderModels('openai', { apiKey: 'sk-r...1234' });

      expect(get).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-realkey1234' } })
      );
      expect(result.models).toEqual([{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }]);
      // One round-trip serves both the key and the base-URL fallback.
      expect(repo.getAISettings).toHaveBeenCalledTimes(1);
    });

    it('survives a provider that answers with an entry carrying no id', async () => {
      repo.getAISettings.mockResolvedValue(storedSettings({ groq_api_key: 'gsk-real' }));
      get.mockResolvedValue({
        data: { data: [{ id: 'llama-3.3-70b-versatile' }, { id: null }, { id: 'whisper-large-v3' }] },
      });

      const service = new AISettingsService();
      const result = await service.refreshProviderModels('groq');

      // The filter calls .includes() on the id; an entry without one used to
      // take the whole refresh down with a TypeError.
      expect(result.models).toEqual([{ id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile' }]);
    });

    it('does not send a stored key to a base URL the caller supplied', async () => {
      // With REDACT_API_KEYS=true an administrator cannot read the saved key
      // back through the API, so this endpoint must not post it to an address
      // of their choosing.
      repo.getAISettings.mockResolvedValue(
        storedSettings({
          openai_compatible_api_key: 'sk-local-secret',
          openai_compatible_base_url: 'http://localhost:1234',
        })
      );
      get.mockResolvedValue({ data: { data: [{ id: 'local-model' }] } });

      const service = new AISettingsService();
      await service.refreshProviderModels('openai_compatible', { baseUrl: 'https://elsewhere.example' });

      expect(get).toHaveBeenCalledWith(
        'https://elsewhere.example/v1/models',
        expect.objectContaining({ headers: {} })
      );
    });

    it('still uses the stored key for the stored base URL', async () => {
      repo.getAISettings.mockResolvedValue(
        storedSettings({
          openai_compatible_api_key: 'sk-local-secret',
          openai_compatible_base_url: 'http://localhost:1234',
        })
      );
      get.mockResolvedValue({ data: [{ id: 'local-model' }] });

      const service = new AISettingsService();
      const result = await service.refreshProviderModels('openai_compatible', { baseUrl: 'http://localhost:1234' });

      expect(get).toHaveBeenCalledWith(
        'http://localhost:1234/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-local-secret' } })
      );
      // A bare array body, which some local servers answer with, reads the same.
      expect(result.models).toEqual([{ id: 'local-model', name: 'local-model' }]);
    });

    it('caches the discovered list and the time it was discovered', async () => {
      repo.getAISettings.mockResolvedValue(storedSettings({ mistral_api_key: 'ms-real' }));
      get.mockResolvedValue({
        data: { data: [{ id: 'mistral-large-latest', name: 'Mistral Large' }, { id: 'mistral-embed' }] },
      });

      const service = new AISettingsService();
      const result = await service.refreshProviderModels('mistral');

      expect(result.models).toEqual([{ id: 'mistral-large-latest', name: 'Mistral Large', description: undefined }]);
      expect(repo.set).toHaveBeenCalledWith('mistral_available_models', JSON.stringify(result.models));
      expect(repo.set).toHaveBeenCalledWith('mistral_models_refreshed_at', result.refreshed_at);
    });

    it('refuses a provider it does not know', async () => {
      repo.getAISettings.mockResolvedValue(storedSettings({}));
      const service = new AISettingsService();
      await expect(service.refreshProviderModels('not-a-provider')).rejects.toThrow(/Unsupported AI provider/);
    });
  });
});
