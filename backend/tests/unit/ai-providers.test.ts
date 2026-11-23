import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../../src/services/ai/providers/anthropic';
import { OpenAIProvider } from '../../src/services/ai/providers/openai';
import { GeminiProvider } from '../../src/services/ai/providers/gemini';
import { getAIProvider } from '../../src/services/ai/client';
import type { AISettings } from '../../src/models';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"price": 49.99}' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
    },
  };
});

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"price": 29.99}' } }],
            usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
          }),
        },
      };
    },
  };
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => '{"price": 39.99}',
              usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 8, totalTokenCount: 23 },
            },
          }),
        };
      }
    },
  };
});

describe('AI Providers', () => {
  const baseSettings: AISettings = {
    ai_provider: 'anthropic',
    ai_enabled: true,
    ai_verification_enabled: true,
    ai_timeout: 5000,
    ai_max_retries: 1,
    anthropic_api_key: 'sk-ant-test',
    anthropic_model: 'claude-3-haiku-20240307',
    openai_api_key: 'sk-test-key',
    gemini_api_key: 'gemini-key',
  };

  describe('AnthropicProvider', () => {
    it('generates text completion and tracks token usage', async () => {
      const provider = new AnthropicProvider(baseSettings);
      const res = await provider.generate('Extract price from html');

      expect(res.text).toBe('{"price": 49.99}');
      expect(res.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('OpenAIProvider', () => {
    it('supports openai provider mode', async () => {
      const provider = new OpenAIProvider(baseSettings, 'openai');
      const res = await provider.generate('Extract price', { jsonMode: true });

      expect(res.text).toBe('{"price": 29.99}');
      expect(res.usage).toEqual({
        promptTokens: 12,
        completionTokens: 6,
        totalTokens: 18,
      });
    });

    it('supports openrouter provider mode with custom model', async () => {
      const settings = {
        ...baseSettings,
        openrouter_api_key: 'sk-or-test',
        openrouter_model: 'meta-llama/llama-3-8b',
      };
      const provider = new OpenAIProvider(settings, 'openrouter');
      const res = await provider.generate('Extract price');

      expect(res.text).toBe('{"price": 29.99}');
    });

    it('supports openai_compatible provider with fallback key when empty', async () => {
      const settings = {
        ...baseSettings,
        openai_compatible_api_key: '',
        openai_compatible_base_url: 'http://localhost:11434/v1',
      };
      const provider = new OpenAIProvider(settings, 'openai_compatible');
      const res = await provider.generate('Extract price');

      expect(res.text).toBe('{"price": 29.99}');
    });
  });

  describe('GeminiProvider', () => {
    it('generates content and parses usageMetadata', async () => {
      const provider = new GeminiProvider(baseSettings);
      const res = await provider.generate('Extract price');

      expect(res.text).toBe('{"price": 39.99}');
      expect(res.usage).toEqual({
        promptTokens: 15,
        completionTokens: 8,
        totalTokens: 23,
      });
    });
  });

  describe('getAIProvider Factory', () => {
    it('returns AnthropicProvider for anthropic', () => {
      const p = getAIProvider({ ...baseSettings, ai_provider: 'anthropic' });
      expect(p).toBeInstanceOf(AnthropicProvider);
    });

    it('returns OpenAIProvider for openai', () => {
      const p = getAIProvider({ ...baseSettings, ai_provider: 'openai' });
      expect(p).toBeInstanceOf(OpenAIProvider);
    });

    it('returns GeminiProvider for gemini', () => {
      const p = getAIProvider({ ...baseSettings, ai_provider: 'gemini' });
      expect(p).toBeInstanceOf(GeminiProvider);
    });

    it('throws error for unsupported provider', () => {
      expect(() =>
        getAIProvider({ ...baseSettings, ai_provider: 'unsupported-provider' as any })
      ).toThrow('Unsupported AI provider: unsupported-provider');
    });
  });
});
