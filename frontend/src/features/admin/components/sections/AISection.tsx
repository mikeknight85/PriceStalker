import { useState, useEffect } from 'react';
import { AIService } from '../../services/AIService';
import { AISettings } from '../../../../types/api';
import { useAsyncAction } from '../../../../hooks/useAsyncAction';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import AIStatusBadge from '../../../../components/AIStatusBadge';
import { CollapsibleCard } from '../../components';
import AIProviderConfig from './AIProviderConfig';
import AIModelTester from './AIModelTester';
import Icon from '../../../../components/Icon';

export default function AISection() {
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [aiModels, setAiModels] = useState<any[]>([]);
  const { execute: runFetchAIData, isLoading } = useAsyncAction(true);
  const { execute: runSaveAISettings, isLoading: isSavingAI } = useAsyncAction();
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ai_general: true,
    ai_tester: false,
  });

  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const fetchAIData = () => runFetchAIData(async () => {
    const [settingsRes, modelsRes] = await Promise.all([
      AIService.getAI(),
      AIService.getGeminiModels(),
    ]);
    setAiSettings(settingsRes.data);
    setAiModels(modelsRes.data.models);
  }, { onErrorFallback: 'Failed to load AI settings' });

  useEffect(() => {
    fetchAIData();
  }, []);

  const handleSaveAISettings = () => runSaveAISettings(async () => {
    if (!aiSettings) return;
    await AIService.updateAI(aiSettings);
  }, { onSuccessMessage: 'AI settings saved', onErrorFallback: 'Save failed' });

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="settings-card-title" style={{ margin: 0 }}>AI Configuration</h2>
        <AIStatusBadge status={aiSettings?.ai_enabled ? 'verified' : null} />
      </div>

      <CollapsibleCard title="Provider Settings" leadingIcon={<Icon name="cpu" />} id="ai_general" expandedSections={expandedSections} onToggle={toggleSection}>
        <AIProviderConfig 
          aiSettings={aiSettings}
          setAiSettings={setAiSettings}
          aiModels={aiModels}
          setAiModels={setAiModels}
          isRefreshingModels={isRefreshingModels}
          setIsRefreshingModels={setIsRefreshingModels}
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

