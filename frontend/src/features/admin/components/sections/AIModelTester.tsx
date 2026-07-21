import { useState } from 'react';
import { AIService } from '../../services/AIService';
import { useAsyncAction } from '../../../../hooks/useAsyncAction';

export default function AIModelTester() {
  const [aiTestUrl, setAiTestUrl] = useState('');
  const [aiTestResult, setAiTestResult] = useState<any>(null);
  const { execute: runTestAI, isLoading: isTestingAI } = useAsyncAction();

  const handleTestAI = () => runTestAI(async () => {
    if (!aiTestUrl) return;
    setAiTestResult(null);
    const res = await AIService.testAI(aiTestUrl);
    setAiTestResult(res.data);
  }, { onSuccessMessage: 'AI extraction complete', onErrorMessage: 'AI Test failed' });

  return (
    <>
      <div className="form-group">
        <label>Test URL</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="form-control" 
            value={aiTestUrl} 
            onChange={e => setAiTestUrl(e.target.value)} 
            placeholder="https://..." 
            style={{ flex: '1', minWidth: '200px' }} 
          />
          <button 
            className="btn btn-secondary" 
            onClick={handleTestAI} 
            disabled={isTestingAI}
          >
            {isTestingAI ? 'Extracting...' : 'Test AI'}
          </button>
        </div>
      </div>
      {aiTestResult && (
        <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border)', marginTop: '1rem' }}>
          <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(aiTestResult, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
