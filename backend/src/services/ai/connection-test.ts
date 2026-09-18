import axios from 'axios';
import { getVertexEndpoint, getVertexAuthToken } from './providers/vertex-auth';

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
 * Test Connection: Anthropic
 */
export async function testAnthropicConnection(apiKey: string, modelName?: string): Promise<string> {
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: modelName || 'claude-3-5-haiku-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say "HELLO WORLD"' }]
  });
  const block = response.content[0];
  if (block.type === 'text') {
    return block.text.trim();
  }
  throw new Error('Unexpected response format from Anthropic API');
}

/**
 * Test Connection: OpenAI Compatible (OpenAI, DeepSeek, Groq, Mistral, OpenRouter, Local servers)
 */
export async function testOpenAICompatibleConnection(params: {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}): Promise<string> {
  const { OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: params.apiKey || 'dummy-key',
    baseURL: params.baseUrl
  });
  const response = await client.chat.completions.create({
    model: params.model,
    messages: [{ role: 'user', content: 'Say "HELLO WORLD"' }],
    max_tokens: 10
  });
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Empty response from OpenAI-compatible API');
  }
  return text.trim();
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
  apiKey?: string;
  projectId: string;
  location: string;
  model: string;
}): Promise<void> {
  const endpoint = getVertexEndpoint(params.projectId, params.location, params.model);
  const authToken = await getVertexAuthToken(params.apiKey);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'Say "valid"' }] }],
    generationConfig: { maxOutputTokens: 5 }
  };

  await axios.post(endpoint, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    timeout: 10000
  });
}
