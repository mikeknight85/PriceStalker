import { AISettings } from '../../../../types/api';
import { ToggleSwitch } from '../../components';
import { AIService } from '../../services/AIService';
import PasswordInput from '../../../../components/PasswordInput';
import Icon from '../../../../components/Icon';
import { useAsyncAction } from '../../../../hooks/useAsyncAction';
import { useToast } from '../../../../context/ToastContext';

interface GeminiModel {
  id: string;
  name: string;
  description: string;
}

interface AIProviderConfigProps {
  aiSettings: AISettings | null;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings | null>>;
  aiModels: GeminiModel[];
  setAiModels: React.Dispatch<React.SetStateAction<GeminiModel[]>>;
  isRefreshingModels: boolean;
  setIsRefreshingModels: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function AIProviderConfig({
  aiSettings, setAiSettings, aiModels, setAiModels,
  isRefreshingModels, setIsRefreshingModels
}: AIProviderConfigProps) {
  const { execute: runFetchAIModels } = useAsyncAction();
  const { execute: runTestProvider } = useAsyncAction();
  const { showToast } = useToast();

  const handleFetchAIModels = () => runFetchAIModels(async () => {
    setIsRefreshingModels(true);
    try {
      await AIService.refreshGeminiModels(aiSettings?.gemini_api_key || undefined);
      const res = await AIService.getGeminiModels();
      setAiModels(res.models);
    } finally {
      setIsRefreshingModels(false);
    }
  }, { onSuccessMessage: 'AI models refreshed', onErrorFallback: 'Failed to refresh models' });

  const handleTestProvider = (provider: string) => runTestProvider(async () => {
    let res: any;
    if (provider === 'gemini') {
      if (!aiSettings?.gemini_api_key) {
        showToast('Enter a Gemini API key before verifying.', 'error');
        return;
      }
      if (!aiSettings.gemini_model) {
        showToast('Verify needs a model: press Sync to load the model list, then select one.', 'error');
        return;
      }
      res = await AIService.testGemini(aiSettings.gemini_api_key, aiSettings.gemini_model);
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
                <PasswordInput 
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
          {aiModels.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', background: 'var(--background)', border: '1px solid var(--warning, #f59e0b)', color: 'var(--text)', fontSize: '0.8rem' }}>
              <Icon name="alertTriangle" /> No cached Gemini model list. Enter your API key and press
              Sync to load the available models — model selection, Verify, and saving need it.
            </div>
          )}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              Primary Model
              {aiModels.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{aiModels.length} models available</span>}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select className="form-control" style={{ flex: 1 }} value={aiSettings?.gemini_model || ''} onChange={e => setAiSettings(s => s ? { ...s, gemini_model: e.target.value } : null)}>
                <option value="" disabled>Select Model...</option>
                {aiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleFetchAIModels}
                disabled={isRefreshingModels || !aiSettings?.gemini_api_key}
                title="Sync with Google API"
              >
                {isRefreshingModels ? '...' : '↻ Sync'}
              </button>
            </div>
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'vertex' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="vertex-api-key">Vertex API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
                <PasswordInput 
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
          <div className="form-group">
            <label>OpenAI Model</label>
            <input type="text" className="form-control" value={aiSettings?.openai_model || ''} onChange={e => setAiSettings(s => s ? { ...s, openai_model: e.target.value } : null)} placeholder="gpt-4o" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'anthropic' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="anthropic-api-key">Anthropic API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
          <div className="form-group">
            <label>Anthropic Model</label>
            <input type="text" className="form-control" value={aiSettings?.anthropic_model || ''} onChange={e => setAiSettings(s => s ? { ...s, anthropic_model: e.target.value } : null)} placeholder="claude-3-5-sonnet-latest" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'deepseek' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="deepseek-api-key">DeepSeek API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
          <div className="form-group">
            <label>DeepSeek Model</label>
            <input type="text" className="form-control" value={aiSettings?.deepseek_model || ''} onChange={e => setAiSettings(s => s ? { ...s, deepseek_model: e.target.value } : null)} placeholder="deepseek-chat" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'groq' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="groq-api-key">Groq API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
          <div className="form-group">
            <label>Groq Model</label>
            <input type="text" className="form-control" value={aiSettings?.groq_model || ''} onChange={e => setAiSettings(s => s ? { ...s, groq_model: e.target.value } : null)} placeholder="llama-3.1-70b-versatile" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'mistral' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="mistral-api-key">Mistral API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
          <div className="form-group">
            <label>Mistral Model</label>
            <input type="text" className="form-control" value={aiSettings?.mistral_model || ''} onChange={e => setAiSettings(s => s ? { ...s, mistral_model: e.target.value } : null)} placeholder="mistral-large-latest" />
          </div>
        </>
      )}

      {aiSettings?.ai_provider === 'openrouter' && (
        <>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="openrouter-api-key">OpenRouter API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput 
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
          <div className="form-group">
            <label>OpenRouter Model</label>
            <input type="text" className="form-control" value={aiSettings?.openrouter_model || ''} onChange={e => setAiSettings(s => s ? { ...s, openrouter_model: e.target.value } : null)} placeholder="meta-llama/llama-3.1-8b-instruct:free" />
          </div>
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
            <PasswordInput 
              id="openai-compatible-api-key"
              name="openai-compatible-api-key"
              value={aiSettings?.openai_compatible_api_key || ''} 
              onChange={e => setAiSettings(s => s ? { ...s, openai_compatible_api_key: e.target.value } : null)} 
              placeholder="Leave empty for unauthenticated local servers" 
              autoComplete="new-password"
              allowReveal={!aiSettings?.redact_api_keys}
            />
          </form>
          <div className="form-group">
            <label>Model</label>
            <input type="text" className="form-control" value={aiSettings?.openai_compatible_model || ''} onChange={e => setAiSettings(s => s ? { ...s, openai_compatible_model: e.target.value } : null)} placeholder="e.g. Qwen/Qwen2.5-7B-Instruct" />
          </div>
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
              <button className="btn btn-secondary btn-sm" onClick={() => handleTestProvider('ollama')}>Verify</button>
            </div>
          </div>
          <div className="form-group">
            <label>Ollama Model</label>
            <input type="text" className="form-control" value={aiSettings?.ollama_model || ''} onChange={e => setAiSettings(s => s ? { ...s, ollama_model: e.target.value } : null)} placeholder="llama3" />
          </div>
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
