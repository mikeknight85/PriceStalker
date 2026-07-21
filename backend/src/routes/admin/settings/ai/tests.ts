import { Router, Response } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { systemService } from '../../../../services/domain/system';
import { asyncHandler } from '../../../../utils/system/route-helpers';

const router = Router();

/**
 * Generic handler for AI provider connection tests.
 */
function handleAiTest(
  provider: string, 
  testFn: (ai: any, apiKey: string, model?: string) => Promise<any>
) {
  return asyncHandler(async (req: AuthRequest, res: Response) => {
    const { api_key, model: selectedModel } = req.body;
    if (!api_key) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    const aiModule = await import('../../../../services/ai');
    const result = await testFn(aiModule, api_key, selectedModel);

    const message = result 
      ? `Successfully connected to ${provider} API. Response: ${result}`
      : `Successfully connected to ${provider} API`;

    res.json({ success: true, message });
  }, `Admin | ${provider} Test`, 'Admin', `Connection failed`);
}

// Global Extraction Test
router.post('/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  const settings = await systemService.getAISettings();
  if (!settings.ai_enabled) {
    res.status(400).json({ error: 'Global AI extraction is not enabled' });
    return;
  }

  const { extractWithAI } = await import('../../../../services/ai');
  const result = await extractWithAI(url, settings);
  res.json({ success: !!result.price, ...result });
}, 'AI | Global Test', 'Admin', 'Failed to test global AI extraction'));

// Provider Specific Tests
router.post('/test-gemini', handleAiTest('Gemini', (ai, k, m) => ai.testGeminiConnection(k, m)));
router.post('/test-vertex', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { api_key, project_id, location, model } = req.body;
  if (!api_key || !project_id || !location || !model) {
    res.status(400).json({ error: 'API Key, Project ID, Location, and Model are required' });
    return;
  }
  const { testVertexConnection } = await import('../../../../services/ai');
  await testVertexConnection({ apiKey: api_key, projectId: project_id, location, model });
  res.json({ success: true, message: 'Successfully connected to Vertex AI API' });
}, 'Admin | Vertex Test', 'Admin', 'Connection failed'));

router.post('/test-anthropic', handleAiTest('Anthropic', (ai, k, m) => ai.testAnthropicConnection(k, m)));

router.post('/test-deepseek', handleAiTest('DeepSeek', (ai, k, m) => 
  ai.testOpenAICompatibleConnection({ apiKey: k, baseUrl: 'https://api.deepseek.com', model: m || 'deepseek-chat' })));

router.post('/test-groq', handleAiTest('Groq', (ai, k, m) => 
  ai.testOpenAICompatibleConnection({ apiKey: k, baseUrl: 'https://api.groq.com/openai/v1', model: m || 'llama-3.3-70b-versatile' })));

router.post('/test-mistral', handleAiTest('Mistral', (ai, k, m) => 
  ai.testOpenAICompatibleConnection({ apiKey: k, baseUrl: 'https://api.mistral.ai/v1', model: m || 'mistral-large-latest' })));

router.post('/test-openai', handleAiTest('OpenAI', (ai, k, m) => 
  ai.testOpenAICompatibleConnection({ apiKey: k, model: m || 'gpt-4o-mini' })));

// Specialized Test for Ollama (base_url instead of api_key)
router.post('/test-ollama', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { base_url } = req.body;
  if (!base_url) {
    res.status(400).json({ error: 'Base URL is required' });
    return;
  }

  const { testOllamaConnection } = await import('../../../../services/ai');
  const models = await testOllamaConnection(base_url);
  res.json({ success: true, models });
}, 'Admin | Ollama Test', 'Admin', 'Connection failed'));

export default router;
