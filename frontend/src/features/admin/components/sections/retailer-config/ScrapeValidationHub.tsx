import { formatPrice } from '../../../../../utils/format';

interface ScrapeValidationHubProps {
  testUrl: string;
  setTestUrl: (url: string) => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: any;
  userLocale?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info', details?: any) => void;
}

export default function ScrapeValidationHub({
  testUrl,
  setTestUrl,
  onTest,
  isTesting,
  testResult,
  userLocale,
  showToast
}: ScrapeValidationHubProps) {
  return (
    <div className="scrape-validation-hub">
      <div className="form-group">
        <label>Scrape Test URL</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="form-control" 
            value={testUrl} 
            onChange={e => setTestUrl(e.target.value)} 
            placeholder="https://..." 
            style={{ flex: '1', minWidth: '200px' }} 
          />
          <button 
            className="btn btn-secondary" 
            onClick={onTest} 
            disabled={isTesting} 
            style={{ width: 'auto' }}
          >
            {isTesting ? 'Testing...' : 'Extract'}
          </button>
        </div>
      </div>
      
      {testResult && (
        <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginTop: '1rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <strong style={{ fontSize: '1rem' }}>Test Results</strong>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => showToast('Test details logged to session activity', 'info', testResult)}
            >
              Log Details
            </button>
          </div>
          <div className="form-grid" style={{ gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong>Status:</strong> 
              <span style={{ color: testResult.success ? 'var(--secondary)' : 'var(--danger)', fontWeight: 700 }}>
                {testResult.success ? '✅ SUCCESS' : '❌ FAILED'}
              </span>
            </div>
            <div>
              <strong>Stock:</strong> 
              <span className={`badge status-${testResult.stockStatus}`}>
                {testResult.stockStatus}
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '0.5rem', background: 'var(--background)', borderRadius: '0.25rem' }}>
              <strong>Found Title:</strong> {testResult.name || '---'}
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '0.5rem', background: 'var(--background)', borderRadius: '0.25rem' }}>
              <strong>Found Price:</strong> {testResult.price ? formatPrice(testResult.price.price, testResult.price.currency, userLocale) : '---'}
            </div>
          </div>
          {testResult.error && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '0.375rem', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
              <strong>Error Trace:</strong><br />
              {testResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
