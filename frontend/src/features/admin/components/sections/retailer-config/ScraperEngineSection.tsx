import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RetailerConfig } from '../../../../../types/api';
import ToggleSwitch from '../../../../../components/ToggleSwitch';
import { PRESET_USER_AGENTS } from '../../index';
import { adminSystemSettingsQuery } from '../../../../../api/queries';

interface ScraperEngineSectionProps {
  draftConfig: Partial<RetailerConfig>;
  onUpdateConfig: (updates: Partial<RetailerConfig>) => void;
}

export default function ScraperEngineSection({ draftConfig, onUpdateConfig }: ScraperEngineSectionProps) {
  const { data: systemSettings } = useQuery(adminSystemSettingsQuery());
  const isSystemProxyEnabled = Boolean(systemSettings?.scraper_proxy);

  const isHttpTrue = draftConfig.use_proxy_http === true;
  const isHttpFalse = draftConfig.use_proxy_http === false;
  const isBrowserTrue = draftConfig.use_proxy_browser === true;
  const isBrowserFalse = draftConfig.use_proxy_browser === false;

  const isSplit = (isHttpTrue !== isBrowserTrue) || (isHttpFalse !== isBrowserFalse);
  const [showAdvancedProxy, setShowAdvancedProxy] = useState(isSplit);

  let currentMode: 'system' | 'always' | 'direct' | 'custom' = 'system';
  if (isSplit) {
    currentMode = 'custom';
  } else if (isHttpTrue) {
    currentMode = 'always';
  } else if (isHttpFalse) {
    currentMode = 'direct';
  } else {
    currentMode = 'system';
  }

  return (
    <div className="scraper-engine-section">
      <div className="form-grid" style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Use Browser Scraper</span>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              Render pages via remote Chromium container when JavaScript execution is required.
            </small>
          </div>
          <ToggleSwitch 
            active={!!draftConfig.use_browser_scraper} 
            onToggle={() => onUpdateConfig({ use_browser_scraper: !draftConfig.use_browser_scraper })} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Skip Denoising</span>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              Bypass regex cleanup of noisy tags before extraction.
            </small>
          </div>
          <ToggleSwitch
            active={!!draftConfig.skip_denoising}
            onToggle={() => onUpdateConfig({ skip_denoising: !draftConfig.skip_denoising })}
          />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Proxy Routing</span>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              {isSystemProxyEnabled
                ? 'System proxy is currently ENABLED globally.'
                : 'System proxy is currently DISABLED globally.'}
            </small>
          </div>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '220px' }}
            value={currentMode}
            onChange={e => {
              const val = e.target.value;
              if (val === 'always') {
                onUpdateConfig({ use_proxy_http: true, use_proxy_browser: true, use_proxy: true });
              } else if (val === 'direct') {
                onUpdateConfig({ use_proxy_http: false, use_proxy_browser: false, use_proxy: false });
              } else if (val === 'system') {
                onUpdateConfig({ use_proxy_http: null, use_proxy_browser: null, use_proxy: false });
              }
            }}
          >
            <option value="system">
              System Default ({isSystemProxyEnabled ? 'Proxied' : 'Direct'})
            </option>
            <option value="always">Always Proxy</option>
            <option value="direct">Direct Only (Bypass Proxy)</option>
            {currentMode === 'custom' && <option value="custom" disabled>Custom (Split HTTP / Browser)</option>}
          </select>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAdvancedProxy}
              onChange={e => setShowAdvancedProxy(e.target.checked)}
            />
            Separate HTTP and Browser proxy settings
          </label>
        </div>

        {showAdvancedProxy && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>HTTP Proxy (Axios)</label>
              <select
                className="form-control"
                value={draftConfig.use_proxy_http === true ? 'always' : (draftConfig.use_proxy_http === false ? 'direct' : 'system')}
                onChange={e => {
                  const val = e.target.value;
                  const nextHttp = val === 'always' ? true : (val === 'direct' ? false : null);
                  onUpdateConfig({
                    use_proxy_http: nextHttp,
                    use_proxy: nextHttp === true || draftConfig.use_proxy_browser === true
                  });
                }}
              >
                <option value="system">System Default</option>
                <option value="always">Always Proxy</option>
                <option value="direct">Direct Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Browser Proxy (Chromium)</label>
              <select
                className="form-control"
                value={draftConfig.use_proxy_browser === true ? 'always' : (draftConfig.use_proxy_browser === false ? 'direct' : 'system')}
                onChange={e => {
                  const val = e.target.value;
                  const nextBrowser = val === 'always' ? true : (val === 'direct' ? false : null);
                  onUpdateConfig({
                    use_proxy_browser: nextBrowser,
                    use_proxy: nextBrowser === true || draftConfig.use_proxy_http === true
                  });
                }}
              >
                <option value="system">System Default</option>
                <option value="always">Always Proxy</option>
                <option value="direct">Direct Only</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      <div className="form-group">
        <label>User Agent Profile</label>
        <select 
          className="form-control mb-2" 
          defaultValue="" 
          onChange={e => { if (e.target.value) onUpdateConfig({ user_agent: e.target.value }); }}
        >
          <option value="" disabled>Select Preset...</option>
          {PRESET_USER_AGENTS.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
        </select>
        <input 
          type="text" 
          className="form-control" 
          value={draftConfig.user_agent || ''} 
          onChange={e => onUpdateConfig({ user_agent: e.target.value })} 
          placeholder="Custom UA string..." 
        />
      </div>
      
      <div className="form-group mt-2">
        <label>HTTP Referrer</label>
        <input 
          type="text" 
          className="form-control" 
          value={draftConfig.referrer || ''} 
          onChange={e => onUpdateConfig({ referrer: e.target.value })} 
          placeholder="https://www.google.com" 
        />
      </div>
    </div>
  );
}
