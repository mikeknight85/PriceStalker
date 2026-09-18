import React, { useState, useEffect } from 'react';
import { AISettings, AIModel, AIProviderTestResult } from '../../../../types/api';
import ToggleSwitch from '../../../../components/ToggleSwitch';
import { AIService } from '../../services/AIService';
import PasswordInput from '../../../../components/PasswordInput';
import { useAsyncAction } from '../../../../hooks/useAsyncAction';
import { useToast } from '../../../../context/ToastContext';
import { apiErrorMessage } from '../../../../api/error';
import ModelSelector from './ModelSelector';

interface AIProviderConfigProps {
  aiSettings: AISettings | null;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings | null>>;
}

export default function AIProviderConfig({
  aiSettings,
  setAiSettings,
}: AIProviderConfigProps) {
  const { execute: runTestProvider } = useAsyncAction();
  const { showToast } = useToast();

  const [modelsCache, setModelsCache] = useState<Record<string, AIModel[]>>({});
  const [isSyncingMap, setIsSyncingMap] = useState<Record<string, boolean>>({});

  const currentProvider = aiSettings?.ai_provider || 'gemini';

  useEffect(() => {
    if (currentProvider && !modelsCache[currentProvider]) {
      void loadCachedModels(currentProvider);
    }
  }, [currentProvider]);

  const loadCachedModels = async (provider: string) => {
    try {
      const res = await AIService.getProviderModels(provider);
      setModelsCache(prev => ({ ...prev, [provider]: res.models || [] }));
    } catch {
      // ignore
    }
  };

  const handleSyncModels = async (provider: string) => {
    setIsSyncingMap(prev => ({ ...prev, [provider]: true }));
    try {
      let apiKey: string | undefined;
      let baseUrl: string | undefined;

      if (provider === 'gemini') apiKey = aiSettings?.gemini_api_key || undefined;
      else if (provider === 'openai') apiKey = aiSettings?.openai_api_key || undefined;
      else if (provider === 'anthropic') apiKey = aiSettings?.anthropic_api_key || undefined;
      else if (provider === 'deepseek') apiKey = aiSettings?.deepseek_api_key || undefined;
      else if (provider === 'groq') apiKey = aiSettings?.groq_api_key || undefined;
      else if (provider === 'mistral') apiKey = aiSettings?.mistral_api_key || undefined;
      else if (provider === 'openrouter') apiKey = aiSettings?.openrouter_api_key || undefined;
      else if (provider === 'ollama') baseUrl = aiSettings?.ollama_base_url || undefined;
      else if (provider === 'openai_compatible') {
        baseUrl = aiSettings?.openai_compatible_base_url || undefined;
        apiKey = aiSettings?.openai_compatible_api_key || undefined;
      }

      const res = await AIService.refreshProviderModels(provider, { api_key: apiKey, base_url: baseUrl });
      setModelsCache(prev => ({ ...prev, [provider]: res.models || [] }));
      showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} models refreshed (${res.models.length} available)`, 'success');
    } catch (err) {
      showToast(apiErrorMessage(err, `Failed to refresh ${provider} models`), 'error');
    } finally {
      setIsSyncingMap(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTestProvider = (provider: string) => runTestProvider(async () => {
    let res: AIProviderTestResult | undefined;

    if (provider === 'gemini') {
      if (!aiSettings?.gemini_api_key) {
        showToast('Enter a Gemini API key before verifying.', 'error');
        return;
      }
      res = await AIService.testGemini(aiSettings.gemini_api_key, aiSettings.gemini_model || undefined);
    } else if (provider === 'vertex') {
      if (!aiSettings?.vertex_api_key || !aiSettings?.vertex_project_id || !aiSettings?.vertex_location || !aiSettings?.vertex_model) return;
      res = await AIService.testVertex(aiSettings.vertex_api_key, aiSettings.vertex_project_id, aiSettings.vertex_location, aiSettings.vertex_model);
    } else if (provider === 'openai') {
      if (!aiSettings?.openai_api_key) return;
      res = await AIService.testOpenAI(aiSettings.openai_api_key, aiSettings.openai_model || undefined);
    } else if (provider === 'anthropic') {
      if (!aiSettings?.anthropic_api_key) return;
      res = await AIService.testAnthropic(aiSettings.anthropic_api_key, aiSettings.anthropic_model || undefined);
    } else if (provider === 'deepseek') {
      if (!aiSettings?.deepseek_api_key) return;
      res = await AIService.testDeepSeek(aiSettings.deepseek_api_key, aiSettings.deepseek_model || undefined);
    } else if (provider === 'groq') {
      if (!aiSettings?.groq_api_key) return;
      res = await AIService.testGroq(aiSettings.groq_api_key, aiSettings.groq_model || undefined);
    } else if (provider === 'mistral') {
      if (!aiSettings?.mistral_api_key) return;
      res = await AIService.testMistral(aiSettings.mistral_api_key, aiSettings.mistral_model || undefined);
    } else if (provider === 'openrouter') {
      if (!aiSettings?.openrouter_api_key) {
        showToast('Enter an OpenRouter API key before verifying.', 'error');
        return;
      }
      res = await AIService.testOpenRouter(aiSettings.openrouter_api_key, aiSettings.openrouter_model || undefined);
    } else if (provider === 'openai_compatible') {
      if (!aiSettings?.openai_compatible_base_url || !aiSettings?.openai_compatible_model) {
        showToast('Enter the endpoint base URL and a model name before verifying.', 'error');
        return;
      }
      res = await AIService.testOpenAICompatible(aiSettings.openai_compatible_base_url, aiSettings.openai_compatible_model, aiSettings.openai_compatible_api_key || undefined);
    } else if (provider === 'ollama') {
      if (!aiSettings?.ollama_base_url) return;
      res = await AIService.testOllama(aiSettings.ollama_base_url);
    }

    const msg = res?.message || `${provider} API connection successful`;
    showToast(msg, 'success');
  }, { onErrorMessage: `${provider} Test failed` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enable AI Fallback</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use AI to extract prices when CSS selectors fail.</div>
          </div>
          <ToggleSwitch active={!!aiSettings?.ai_enabled} onToggle={() => setAiSettings(s => s ? { ...s, ai_enabled: !s.ai_enabled } : null)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>AI Verification</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically verify and update retailer selectors using AI.</div>
          </div>
          <ToggleSwitch active={!!aiSettings?.ai_verification_enabled} onToggle={() => setAiSettings(s => s ? { ...s, ai_verification_enabled: !s.ai_verification_enabled } : null)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Auto-Mapping</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Learn new retailers dynamically during monitoring.</div>
          </div>
          <ToggleSwitch active={!!aiSettings?.ai_auto_mapping_enabled} onToggle={() => setAiSettings(s => s ? { ...s, ai_auto_mapping_enabled: !s.ai_auto_mapping_enabled } : null)} />
        </div>
      </div>

      <div className="form-group">
        <label>Primary AI Provider</label>
        <select className="form-control" value={aiSettings?.ai_provider || 'gemini'} onChange={(e) => setAiSettings(s => s ? { ...s, ai_provider: e.target.value as any } : null)}>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="gemini">Google Gemini</option>
            <option value="vertex">Vertex AI (REST)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="groq">Groq (Llama 3)</option>
            <option value="mistral">Mistral AI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai_compatible">OpenAI-Compatible (vLLM, LM Studio, ...)</option>
            <option value="ollama">Local Ollama</option>
        </select>
      </div>

      {aiSettings?.ai_provider === 'gemini' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="gemini-api-key">Google Gemini API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="gemini-api-key"
                  name="gemini-api-key"
                  value={aiSettings?.gemini_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, gemini_api_key: e.target.value } : null)} 
                  placeholder="AI_..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('gemini')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="Google Gemini"
            value={aiSettings?.gemini_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, gemini_model: val } : null)}
            models={modelsCache['gemini'] || []}
            onSync={() => handleSyncModels('gemini')}
            isSyncing={!!isSyncingMap['gemini']}
            canSync={Boolean(aiSettings?.gemini_api_key)}
            syncDisabledTooltip="Enter a Gemini API key before syncing"
            customPlaceholder="e.g. gemini-2.0-flash"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'vertex' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="vertex-api-key">Vertex API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="vertex-api-key"
                  name="vertex-api-key"
                  value={aiSettings?.vertex_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, vertex_api_key: e.target.value } : null)} 
                  placeholder="AI..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('vertex')}>Verify</button>
            </div>
          </form>
          <div className="form-group">
            <label>GCP Project ID</label>
            <input className="form-control" value={aiSettings?.vertex_project_id || ''} onChange={e => setAiSettings(s => s ? { ...s, vertex_project_id: e.target.value } : null)} placeholder="my-gcp-project-id" autoComplete="off" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input className="form-control" value={aiSettings?.vertex_location || 'us-central1'} onChange={e => setAiSettings(s => s ? { ...s, vertex_location: e.target.value } : null)} placeholder="us-central1" autoComplete="off" />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input className="form-control" value={aiSettings?.vertex_model || ''} onChange={e => setAiSettings(s => s ? { ...s, vertex_model: e.target.value } : null)} placeholder="gemini-1.5-pro-002" autoComplete="off" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'openai' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="openai-api-key">OpenAI API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="openai-api-key"
                  name="openai-api-key"
                  value={aiSettings?.openai_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, openai_api_key: e.target.value } : null)} 
                  placeholder="sk-..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('openai')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="OpenAI"
            value={aiSettings?.openai_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, openai_model: val } : null)}
            models={modelsCache['openai'] || []}
            onSync={() => handleSyncModels('openai')}
            isSyncing={!!isSyncingMap['openai']}
            canSync={Boolean(aiSettings?.openai_api_key)}
            syncDisabledTooltip="Enter an OpenAI API key before syncing"
            customPlaceholder="e.g. gpt-4o, o1"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'anthropic' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="anthropic-api-key">Anthropic API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="anthropic-api-key"
                  name="anthropic-api-key"
                  value={aiSettings?.anthropic_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, anthropic_api_key: e.target.value } : null)} 
                  placeholder="sk-ant-..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('anthropic')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="Anthropic"
            value={aiSettings?.anthropic_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, anthropic_model: val } : null)}
            models={modelsCache['anthropic'] || []}
            onSync={() => handleSyncModels('anthropic')}
            isSyncing={!!isSyncingMap['anthropic']}
            canSync={Boolean(aiSettings?.anthropic_api_key)}
            syncDisabledTooltip="Enter an Anthropic API key before syncing"
            customPlaceholder="e.g. claude-3-7-sonnet-20250219"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'deepseek' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="deepseek-api-key">DeepSeek API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="deepseek-api-key"
                  name="deepseek-api-key"
                  value={aiSettings?.deepseek_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, deepseek_api_key: e.target.value } : null)} 
                  placeholder="sk-..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('deepseek')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="DeepSeek"
            value={aiSettings?.deepseek_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, deepseek_model: val } : null)}
            models={modelsCache['deepseek'] || []}
            onSync={() => handleSyncModels('deepseek')}
            isSyncing={!!isSyncingMap['deepseek']}
            canSync={Boolean(aiSettings?.deepseek_api_key)}
            syncDisabledTooltip="Enter a DeepSeek API key before syncing"
            customPlaceholder="e.g. deepseek-chat"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'groq' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="groq-api-key">Groq API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="groq-api-key"
                  name="groq-api-key"
                  value={aiSettings?.groq_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, groq_api_key: e.target.value } : null)} 
                  placeholder="gsk_..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('groq')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="Groq"
            value={aiSettings?.groq_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, groq_model: val } : null)}
            models={modelsCache['groq'] || []}
            onSync={() => handleSyncModels('groq')}
            isSyncing={!!isSyncingMap['groq']}
            canSync={Boolean(aiSettings?.groq_api_key)}
            syncDisabledTooltip="Enter a Groq API key before syncing"
            customPlaceholder="e.g. llama-3.3-70b-versatile"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'mistral' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="mistral-api-key">Mistral API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="mistral-api-key"
                  name="mistral-api-key"
                  value={aiSettings?.mistral_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, mistral_api_key: e.target.value } : null)} 
                  placeholder="...-..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('mistral')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="Mistral"
            value={aiSettings?.mistral_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, mistral_model: val } : null)}
            models={modelsCache['mistral'] || []}
            onSync={() => handleSyncModels('mistral')}
            isSyncing={!!isSyncingMap['mistral']}
            canSync={Boolean(aiSettings?.mistral_api_key)}
            syncDisabledTooltip="Enter a Mistral API key before syncing"
            customPlaceholder="e.g. mistral-large-latest"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'openrouter' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="openrouter-api-key">OpenRouter API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput secret
                  id="openrouter-api-key"
                  name="openrouter-api-key"
                  value={aiSettings?.openrouter_api_key || ''} 
                  onChange={e => setAiSettings(s => s ? { ...s, openrouter_api_key: e.target.value } : null)} 
                  placeholder="sk-or-..." 
                  autoComplete="new-password"
                  allowReveal={!aiSettings?.redact_api_keys}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('openrouter')}>Verify</button>
            </div>
          </form>

          <ModelSelector
            providerName="OpenRouter"
            value={aiSettings?.openrouter_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, openrouter_model: val } : null)}
            models={modelsCache['openrouter'] || []}
            onSync={() => handleSyncModels('openrouter')}
            isSyncing={!!isSyncingMap['openrouter']}
            canSync={true}
            customPlaceholder="e.g. meta-llama/llama-3.1-8b-instruct:free"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'openai_compatible' && (
        <>
          <div className="form-group">
            <label>Endpoint Base URL</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="form-control" style={{ flex: 1 }} value={aiSettings?.openai_compatible_base_url || ''} onChange={e => setAiSettings(s => s ? { ...s, openai_compatible_base_url: e.target.value } : null)} placeholder="http://localhost:8000/v1" autoComplete="off" />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('openai_compatible')}>Verify</button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Any server speaking the OpenAI chat-completions protocol: vLLM, LM Studio, LocalAI, text-generation-webui, ...
            </div>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="openai-compatible-api-key">API Key (optional)</label>
            <PasswordInput secret
              id="openai-compatible-api-key"
              name="openai-compatible-api-key"
              value={aiSettings?.openai_compatible_api_key || ''} 
              onChange={e => setAiSettings(s => s ? { ...s, openai_compatible_api_key: e.target.value } : null)} 
              placeholder="Leave empty for unauthenticated local servers" 
              autoComplete="new-password"
              allowReveal={!aiSettings?.redact_api_keys}
            />
          </form>

          <ModelSelector
            providerName="OpenAI-Compatible"
            value={aiSettings?.openai_compatible_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, openai_compatible_model: val } : null)}
            models={modelsCache['openai_compatible'] || []}
            onSync={() => handleSyncModels('openai_compatible')}
            isSyncing={!!isSyncingMap['openai_compatible']}
            canSync={Boolean(aiSettings?.openai_compatible_base_url)}
            syncDisabledTooltip="Enter an Endpoint Base URL before syncing"
            customPlaceholder="e.g. Qwen/Qwen2.5-7B-Instruct"
          />
        </>
      )}

      {aiSettings?.ai_provider === 'ollama' && (
        <>
          <div className="form-group">
            <label>Ollama Base URL</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-control" 
                style={{ flex: 1 }} 
                value={aiSettings?.ollama_base_url || ''} 
                onChange={e => setAiSettings(s => s ? { ...s, ollama_base_url: e.target.value } : null)} 
                placeholder="http://localhost:11434" 
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('ollama')}>Verify</button>
            </div>
          </div>

          <ModelSelector
            providerName="Ollama"
            value={aiSettings?.ollama_model || ''}
            onChange={val => setAiSettings(s => s ? { ...s, ollama_model: val } : null)}
            models={modelsCache['ollama'] || []}
            onSync={() => handleSyncModels('ollama')}
            isSyncing={!!isSyncingMap['ollama']}
            canSync={Boolean(aiSettings?.ollama_base_url)}
            syncDisabledTooltip="Enter an Ollama Base URL before syncing"
            customPlaceholder="e.g. llama3.2"
          />
        </>
      )}

      <div className="form-grid">
          <div className="form-group">
            <label>Request Timeout (ms)</label>
            <input 
              type="number" 
              className="form-control" 
              value={aiSettings?.ai_timeout || 60000} 
              onChange={e => setAiSettings(s => s ? { ...s, ai_timeout: parseInt(e.target.value) || 0 } : null)} 
            />
          </div>
          <div className="form-group">
            <label>Max Retries</label>
            <input 
              type="number" 
              className="form-control" 
              value={aiSettings?.ai_max_retries || 2} 
              onChange={e => setAiSettings(s => s ? { ...s, ai_max_retries: parseInt(e.target.value) || 0 } : null)} 
            />
          </div>
      </div>
    </div>
  );
}
