import { useState, useEffect } from 'react';
import { AIService } from '../../services/AIService';
import { AISettings } from '../../../../types/api';
import { useAsyncAction, useExpandedSections } from '../../../../hooks';
import { useToast } from '../../../../context/ToastContext';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import AIStatusBadge from '../../../../components/AIStatusBadge';
import CollapsibleCard from '../../../../components/CollapsibleCard';
import AIProviderConfig from './AIProviderConfig';
import AIModelTester from './AIModelTester';
import Icon from '../../../../components/Icon';

export default function AISection() {
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const { execute: runFetchAIData, isLoading } = useAsyncAction(true);
  const { showToast } = useToast();
  const { execute: runSaveAISettings, isLoading: isSavingAI } = useAsyncAction();

  const { expandedSections, toggleSection } = useExpandedSections({
    ai_general: true,
    ai_tester: false,
  });

  const fetchAIData = () => runFetchAIData(async () => {
    const settingsRes = await AIService.getAI();
    setAiSettings(settingsRes);
  }, { onErrorFallback: 'Failed to load AI settings' });

  useEffect(() => {
    fetchAIData();
  }, []);

  const handleSaveAISettings = () => runSaveAISettings(async () => {
    if (!aiSettings) return;
    // Require a model when an AI provider is active
    const provider = aiSettings.ai_provider;
    if (provider) {
      const modelKey = `${provider}_model` as keyof AISettings;
      const modelVal = aiSettings[modelKey];
      if (!modelVal) {
        showToast(`Select or enter a model for ${provider} before saving.`, 'error');
        return;
      }
    }
    await AIService.updateAI(aiSettings);
  }, { onSuccessMessage: 'AI settings saved', onErrorFallback: 'Save failed' });

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="settings-card-title">AI Configuration</h2>
        <AIStatusBadge status={aiSettings?.ai_enabled ? 'verified' : null} />
      </div>

      <CollapsibleCard title="Provider Settings" leadingIcon={<Icon name="cpu" />} id="ai_general" isExpanded={expandedSections.ai_general} onToggle={toggleSection}>
        <AIProviderConfig 
          aiSettings={aiSettings}
          setAiSettings={setAiSettings}
        />
        <div className="settings-actions">
           <button className="btn btn-primary btn-sm" onClick={handleSaveAISettings} disabled={isSavingAI}>Save AI Configuration</button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="AI Extraction Tester" leadingIcon={<Icon name="flask" />} id="ai_tester" isExpanded={expandedSections.ai_tester} onToggle={toggleSection}>
         <AIModelTester />
      </CollapsibleCard>
    </div>
  );
}
