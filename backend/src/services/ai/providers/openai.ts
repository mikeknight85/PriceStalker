import OpenAI from 'openai';
import { AISettings } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { withRetry } from '../../../utils/system/retry';
import { AIProvider, AIRequestOptions, AIResponse } from './types';

const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo-0125';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_GROQ_MODEL = 'llama3-8b-8192';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  private settings: AISettings;
  private providerName: string;

  constructor(settings: AISettings, provider: 'openai' | 'deepseek' | 'groq' | 'mistral' = 'openai') {
    this.providerName = provider;
    let apiKey = settings.openai_api_key;
    this.model = settings.openai_model || DEFAULT_OPENAI_MODEL;
    let baseURL = undefined;

    if (provider === 'deepseek') {
      apiKey = settings.deepseek_api_key;
      this.model = settings.deepseek_model || DEFAULT_DEEPSEEK_MODEL;
      baseURL = 'https://api.deepseek.com';
    } else if (provider === 'groq') {
      apiKey = settings.groq_api_key;
      this.model = settings.groq_model || DEFAULT_GROQ_MODEL;
      baseURL = 'https://api.groq.com/openai/v1';
    } else if (provider === 'mistral') {
      apiKey = settings.mistral_api_key;
      this.model = settings.mistral_model || DEFAULT_MISTRAL_MODEL;
      baseURL = 'https://api.mistral.ai/v1';
    }

    this.client = new OpenAI({
      apiKey: apiKey!,
      baseURL,
      timeout: settings.ai_timeout || 30000
    });
    this.settings = settings;
  }

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const response = await withRetry(() => this.client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined
    }), { maxRetries: this.settings.ai_max_retries ?? 2 }, options?.retryLabel || this.providerName);

    if (response.usage) {
      logger.debug(`AI | ${this.providerName} | Tokens: ${response.usage.total_tokens}`, 'AI', {
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens
        },
        provider: this.providerName,
        product_id: options?.productId
      });
    }

    return {
      text: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined
    };
  }
}
