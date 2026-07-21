import { api } from '../../../api/client';
import { AISettings } from '../../../types/api';

export const AIService = {
  getAI: () => api.get<AISettings>('/admin/settings/ai'),
  updateAI: (data: Partial<AISettings>) => api.put<AISettings>('/admin/settings/ai', data),
  getGeminiModels: () => api.get<{ models: any[]; refreshed_at: string }>('/admin/settings/ai/gemini/models'),
  refreshGeminiModels: (key?: string) => api.post<{ models: any[]; refreshed_at: string }>('/admin/settings/ai/gemini/models/refresh', { api_key: key }),
  testAI: (url: string) => api.post('/admin/settings/ai/test', { url }),
  
  // Specific AI Provider Tests
  testOllama: (url: string) => api.post('/admin/settings/ai/test-ollama', { base_url: url }),
  testGemini: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-gemini', { api_key, model }),
  testVertex: (api_key: string, project_id: string, location: string, model: string) => api.post('/admin/settings/ai/test-vertex', { api_key, project_id, location, model }),
  testDeepSeek: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-deepseek', { api_key, model }),
  testGroq: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-groq', { api_key, model }),
  testMistral: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-mistral', { api_key, model }),
  testAnthropic: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-anthropic', { api_key, model }),
  testOpenAI: (api_key: string, model?: string) => api.post('/admin/settings/ai/test-openai', { api_key, model }),
};
