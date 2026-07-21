import { AISettings } from '../../models';
import { AIProvider } from './providers/types';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { VertexProvider } from './providers/vertex';

export * from './providers/types';

export function getAIProvider(settings: AISettings): AIProvider {
  const provider = settings.ai_provider;

  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(settings);
    case 'openai':
      return new OpenAIProvider(settings, 'openai');
    case 'deepseek':
      return new OpenAIProvider(settings, 'deepseek');
    case 'groq':
      return new OpenAIProvider(settings, 'groq');
    case 'mistral':
      return new OpenAIProvider(settings, 'mistral');
    case 'ollama':
      return new OllamaProvider(settings);
    case 'gemini':
      return new GeminiProvider(settings);
    case 'vertex':
      return new VertexProvider(settings);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
