import axios from 'axios';

/**
 * Test Connection: Gemini
 */
export async function testGeminiConnection(apiKey: string, modelName?: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName || 'gemini-2.0-flash' });
  const result = await model.generateContent('Say "HELLO WORLD"');
  if (!result || !result.response) {
    throw new Error('No response received from Gemini API');
  }
  const text = result.response.text();
  if (!text) {
    throw new Error('Empty response received from Gemini API');
  }
  return text.trim();
}

/**
 * Test Connection: OpenAI Compatible (OpenAI, DeepSeek, Groq, Mistral)
 */
export async function testOpenAICompatibleConnection(params: {
  apiKey: string;
  baseUrl?: string;
  model: string;
}): Promise<void> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: params.apiKey, baseURL: params.baseUrl });
  await client.chat.completions.create({
    model: params.model,
    messages: [{ role: 'user', content: 'Say "valid"' }],
    max_tokens: 5,
  });
}

/**
 * Test Connection: Anthropic
 */
export async function testAnthropicConnection(apiKey: string, modelName?: string): Promise<void> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  await client.messages.create({
    model: modelName || 'claude-3-haiku-20240307',
    max_tokens: 5,
    messages: [{ role: 'user', content: 'Say "valid"' }],
  });
}

/**
 * Test Connection: Ollama
 */
export async function testOllamaConnection(baseUrl: string): Promise<string[]> {
  const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
  const models = response.data?.models || [];
  return models.map((m: any) => m.name);
}

/**
 * Test Connection: Vertex AI
 */
export async function testVertexConnection(params: {
  apiKey: string;
  projectId: string;
  location: string;
  model: string;
}): Promise<void> {
  const location = params.location || 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${params.projectId}/locations/${location}/publishers/google/models/${params.model}:generateContent`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'Say "valid"' }] }],
    generationConfig: { maxOutputTokens: 5 }
  };

  await axios.post(endpoint, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': params.apiKey
    },
    timeout: 10000
  });
}
