import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVertexEndpoint, getVertexAuthToken } from '../../src/services/ai/providers/vertex-auth';
import { VertexProvider } from '../../src/services/ai/providers/vertex';
import axios from 'axios';
import { AISettingsService } from '../../src/services/domain/system/settings/ai';
import { systemSettingsRepository } from '../../src/models';

vi.mock('axios');
vi.mock('../../src/models', () => ({
  systemSettingsRepository: {
    getAISettings: vi.fn(),
    getAll: vi.fn(),
  },
}));

describe('Vertex AI Provider & Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVertexEndpoint', () => {
    it('constructs regional endpoint correctly with location prefix', () => {
      const endpoint = getVertexEndpoint('test-project', 'us-central1', 'gemini-1.5-pro-002');
      expect(endpoint).toBe(
        'https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/publishers/google/models/gemini-1.5-pro-002:generateContent'
      );
    });

    it('constructs global endpoint correctly WITHOUT global- prefix (fixes 404)', () => {
      const endpoint = getVertexEndpoint('test-project', 'global', 'gemini-1.5-pro-002');
      expect(endpoint).toBe(
        'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-1.5-pro-002:generateContent'
      );
    });
  });

  describe('getVertexAuthToken', () => {
    it('returns direct OAuth access token if passed', async () => {
      const token = await getVertexAuthToken('ya29.sample-access-token');
      expect(token).toBe('ya29.sample-access-token');
    });

    it('throws descriptive error on malformed JSON credentials', async () => {
      await expect(getVertexAuthToken('{ "invalid": json ')).rejects.toThrow(
        /Invalid Google Service Account JSON credentials/
      );
    });
  });

  describe('VertexProvider.generate', () => {
    it('sends Authorization: Bearer token header instead of x-goog-api-key', async () => {
      const provider = new VertexProvider({
        ai_enabled: true,
        ai_verification_enabled: false,
        ai_auto_mapping_enabled: false,
        ai_provider: 'vertex',
        vertex_project_id: 'test-project',
        vertex_location: 'us-central1',
        vertex_api_key: 'ya29.valid-oauth-token',
        vertex_model: 'gemini-1.5-pro-002',
        anthropic_api_key: null,
        anthropic_model: null,
        openai_api_key: null,
        openai_model: null,
        ollama_base_url: null,
        ollama_model: null,
        gemini_api_key: null,
        gemini_model: null,
        deepseek_api_key: null,
        deepseek_model: null,
        groq_api_key: null,
        groq_model: null,
        mistral_api_key: null,
        mistral_model: null,
        openrouter_api_key: null,
        openrouter_model: null,
        openai_compatible_base_url: null,
        openai_compatible_api_key: null,
        openai_compatible_model: null,
        jsonld_image_key: 'image',
        jsonld_price_key: 'price',
        jsonld_name_key: 'name',
        prefer_jsonld_image: false,
        ai_timeout: 5000,
        ai_max_retries: 0,
      });

      const mockResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: '{"price": 49.99}' }],
              },
            },
          ],
        },
      };
      (axios.post as any).mockResolvedValueOnce(mockResponse);

      const res = await provider.generate('Extract price');
      expect(res.text).toBe('{"price": 49.99}');
      expect(axios.post).toHaveBeenCalledWith(
        'https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/publishers/google/models/gemini-1.5-pro-002:generateContent',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer ya29.valid-oauth-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('AISettingsService key redaction', () => {
    it('masks vertex_api_key when REDACT_API_KEYS=true', async () => {
      const originalEnv = process.env.REDACT_API_KEYS;
      process.env.REDACT_API_KEYS = 'true';

      try {
        (systemSettingsRepository.getAISettings as any).mockResolvedValueOnce({
          ai_enabled: true,
          vertex_api_key: 'ya29.my-secret-long-token-12345',
          openai_api_key: 'sk-secret-key-12345',
        });

        const service = new AISettingsService();
        const settings = await service.getAISettings();

        expect(settings.vertex_api_key).toMatch(/^ya29\.\.\.2345$/);
        expect(settings.openai_api_key).toMatch(/^sk-s\.\.\.2345$/);
        expect(settings.redact_api_keys).toBe(true);
      } finally {
        process.env.REDACT_API_KEYS = originalEnv;
      }
    });
  });
});
