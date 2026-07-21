import Anthropic from '@anthropic-ai/sdk';
import { AISettings } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { withRetry } from '../../../utils/system/retry';
import { AIProvider, AIRequestOptions, AIResponse } from './types';

const DEFAULT_ANTHROPIC_MODEL = 'claude-3-haiku-20240307';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.client = new Anthropic({
      apiKey: settings.anthropic_api_key!,
      timeout: settings.ai_timeout || 30000
    });
    this.model = settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL;
    this.settings = settings;
  }

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const response = await withRetry(() => this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
    }), { maxRetries: this.settings.ai_max_retries ?? 2 }, options?.retryLabel || 'Anthropic');

    if (response.usage) {
      logger.debug(`AI | Anthropic | Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`, 'AI', {
        tokens: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        },
        provider: 'Anthropic',
        product_id: options?.productId
      });
    }

    const content = response.content[0];
    return {
      text: content.type === 'text' ? content.text : '',
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  }
}
