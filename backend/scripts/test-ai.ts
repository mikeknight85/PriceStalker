import { extractWithAI } from '../src/services/ai';
import { systemSettingsRepository } from '../src/models';

async function test() {
  const url = 'https://www.example.com';
  const settings = await systemSettingsRepository.getAISettings();
  console.log('Testing with settings:', { provider: settings.ai_provider, model: settings.openai_model || settings.anthropic_model || settings.gemini_model });
  try {
    const result = await extractWithAI(url, settings);
    console.log('Result:', result);
  } catch (error) {
    console.error('Extraction failed:', error);
  }
}

test().catch(console.error);
