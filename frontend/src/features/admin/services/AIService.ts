import { api } from '../../../api/client';
import { AISettings, AIModel, AIExtractionTestResult, AIProviderTestResult } from '../../../types/api';

export const AIService = {
  getAI: () => api.get<AISettings>('/admin/settings/ai'),
  updateAI: (data: Partial<AISettings>) => api.put<AISettings>('/admin/settings/ai', data),
  getGeminiModels: () => api.get<{ models: AIModel[]; refreshed_at: string }>('/admin/settings/ai/gemini/models'),
  refreshGeminiModels: (key?: string) => api.post<{ models: AIModel[]; refreshed_at: string }>('/admin/settings/ai/gemini/models/refresh', { api_key: key }),
  getProviderModels: (provider: string) => api.get<{ models: AIModel[]; refreshed_at: string }>(`/admin/settings/ai/${provider}/models`),
  refreshProviderModels: (provider: string, data?: { api_key?: string; base_url?: string }) =>
    api.post<{ models: AIModel[]; refreshed_at: string }>(`/admin/settings/ai/${provider}/models/refresh`, data || {}),
  testAI: (url: string) => api.post<AIExtractionTestResult>('/admin/settings/ai/test', { url }),
  
  // Specific AI Provider Tests
  testOllama: (url: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-ollama', { base_url: url }),
  testGemini: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-gemini', { api_key, model }),
  testVertex: (api_key: string, project_id: string, location: string, model: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-vertex', { api_key, project_id, location, model }),
  testDeepSeek: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-deepseek', { api_key, model }),
  testGroq: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-groq', { api_key, model }),
  testMistral: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-mistral', { api_key, model }),
  testAnthropic: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-anthropic', { api_key, model }),
  testOpenAI: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-openai', { api_key, model }),
  testOpenRouter: (api_key: string, model?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-openrouter', { api_key, model }),
  testOpenAICompatible: (base_url: string, model: string, api_key?: string) => api.post<AIProviderTestResult>('/admin/settings/ai/test-openai-compatible', { base_url, model, api_key }),
};
