import { GoogleGenerativeAI } from '@google/generative-ai';
import { AISettings } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { withRetry } from '../../../utils/system/retry';
import { AIProvider, AIRequestOptions, AIResponse } from './types';

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

export class GeminiProvider implements AIProvider {
  private client: any;
  private model: any;
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.client = new GoogleGenerativeAI(settings.gemini_api_key!);
    this.model = this.client.getGenerativeModel({
      model: settings.gemini_model || DEFAULT_GEMINI_MODEL
    });
    this.settings = settings;
  }

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const result: any = await withRetry(() => this.model.generateContent(prompt),
      { maxRetries: this.settings.ai_max_retries ?? 2 },
      options?.retryLabel || 'Gemini'
    );
    const response = result.response;

    if (response.usageMetadata) {
      logger.debug(`AI | Gemini | Tokens: ${response.usageMetadata.totalTokenCount}`, 'AI', {
        tokens: {
          input: response.usageMetadata.promptTokenCount,
          output: response.usageMetadata.candidatesTokenCount,
          total: response.usageMetadata.totalTokenCount
        },
        provider: 'Gemini',
        product_id: options?.productId
      });
    }

    return {
      text: response.text(),
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount
      } : undefined
    };
  }
}
