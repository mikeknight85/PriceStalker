import axios from 'axios';
import { AISettings } from '../../../models';
import { withRetry } from '../../../utils/system/retry';
import { AIProvider, AIRequestOptions, AIResponse } from './types';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.baseUrl = settings.ollama_base_url || 'http://localhost:11434';
    this.model = settings.ollama_model || 'llama3';
    this.settings = settings;
  }

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const response = await withRetry(() => axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: this.model,
        messages: [
          { role: 'user', content: '/nothink' },
          { role: 'assistant', content: 'Ok.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        format: options?.jsonMode ? 'json' : undefined,
        options: { num_ctx: 16384 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.settings.ai_timeout || 120000,
      }
    ), { maxRetries: this.settings.ai_max_retries ?? 1 }, options?.retryLabel || 'Ollama');

    const content = response.data?.message?.content || '';
    return { text: content };
  }
}
