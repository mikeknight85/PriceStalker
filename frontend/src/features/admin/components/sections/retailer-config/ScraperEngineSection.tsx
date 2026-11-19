import { RetailerConfig } from '../../../../../types/api';
import ToggleSwitch from '../../../../../components/ToggleSwitch';
import { PRESET_USER_AGENTS } from '../../index';


interface ScraperEngineSectionProps {
  draftConfig: Partial<RetailerConfig>;
  onUpdateConfig: (updates: Partial<RetailerConfig>) => void;
}

export default function ScraperEngineSection({ draftConfig, onUpdateConfig }: ScraperEngineSectionProps) {
  return (
    <div className="scraper-engine-section">
      <div className="form-grid" style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>Use Browser Scraper</span>
          <ToggleSwitch 
            active={!!draftConfig.use_browser_scraper} 
            onToggle={() => onUpdateConfig({ use_browser_scraper: !draftConfig.use_browser_scraper })} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span>HTTP Proxy (Axios)</span>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Route standard HTTP requests through the proxy
            </small>
          </div>
          <ToggleSwitch
            active={draftConfig.use_proxy_http !== undefined ? !!draftConfig.use_proxy_http : !!draftConfig.use_proxy}
            onToggle={() => {
              const current = draftConfig.use_proxy_http !== undefined ? !!draftConfig.use_proxy_http : !!draftConfig.use_proxy;
              const next = !current;
              onUpdateConfig({
                use_proxy_http: next,
                use_proxy: next || (draftConfig.use_proxy_browser !== undefined ? !!draftConfig.use_proxy_browser : !!draftConfig.use_proxy)
              });
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span>Browser Proxy (Scraper)</span>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Route remote browser scraper sessions through the proxy
            </small>
          </div>
          <ToggleSwitch
            active={draftConfig.use_proxy_browser !== undefined ? !!draftConfig.use_proxy_browser : !!draftConfig.use_proxy}
            onToggle={() => {
              const current = draftConfig.use_proxy_browser !== undefined ? !!draftConfig.use_proxy_browser : !!draftConfig.use_proxy;
              const next = !current;
              onUpdateConfig({
                use_proxy_browser: next,
                use_proxy: next || (draftConfig.use_proxy_http !== undefined ? !!draftConfig.use_proxy_http : !!draftConfig.use_proxy)
              });
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>Skip Denoising</span>
          <ToggleSwitch 
            active={!!draftConfig.skip_denoising} 
            onToggle={() => onUpdateConfig({ skip_denoising: !draftConfig.skip_denoising })} 
          />
        </div>
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
