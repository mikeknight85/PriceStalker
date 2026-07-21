import axios from 'axios';
import { AISettings } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { withRetry } from '../../../utils/system/retry';
import { AIProvider, AIRequestOptions, AIResponse } from './types';

const DEFAULT_VERTEX_MODEL = 'gemini-1.5-pro-002';

export class VertexProvider implements AIProvider {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const projectId = this.settings.vertex_project_id;
    const location = this.settings.vertex_location || 'us-central1';
    const apiKey = this.settings.vertex_api_key;
    const model = this.settings.vertex_model || DEFAULT_VERTEX_MODEL;

    if (!projectId || !apiKey) {
      throw new Error('Vertex AI requires Project ID and API Key to be configured.');
    }

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: options?.maxTokens,
        responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
      }
    };

    const result = await withRetry(
      async () => {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          timeout: this.settings.ai_timeout || 30000
        });
        return response.data;
      },
      { maxRetries: this.settings.ai_max_retries ?? 2 },
      options?.retryLabel || 'Vertex'
    );

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.usageMetadata;

    if (usageMetadata) {
      logger.debug(`AI | Vertex | Tokens: ${usageMetadata.totalTokenCount}`, 'AI', {
        tokens: {
          input: usageMetadata.promptTokenCount,
          output: usageMetadata.candidatesTokenCount,
          total: usageMetadata.totalTokenCount
        },
        provider: 'Vertex',
        product_id: options?.productId
      });
    }

    return {
      text,
      usage: usageMetadata ? {
        promptTokens: usageMetadata.promptTokenCount,
        completionTokens: usageMetadata.candidatesTokenCount,
        totalTokens: usageMetadata.totalTokenCount
      } : undefined
    };
  }
}
