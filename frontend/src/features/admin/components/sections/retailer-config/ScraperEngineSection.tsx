import { RetailerConfig } from '../../../../../types/api';
import ToggleSwitch from '../../../../../components/ToggleSwitch';
import Icon from '../../../../../components/Icon';
import { GROUPED_PRESET_USER_AGENTS, diagnoseRetailerUserAgent } from '../../index';


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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>Proxy Traffic</span>
          <ToggleSwitch 
            active={!!draftConfig.use_proxy} 
            onToggle={() => onUpdateConfig({ use_proxy: !draftConfig.use_proxy })} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>Skip Denoising</span>
          <ToggleSwitch 
            active={!!draftConfig.skip_denoising} 
            onToggle={() => onUpdateConfig({ skip_denoising: !draftConfig.skip_denoising })} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', gridColumn: '1 / -1' }}>
          <div>
            <span>Re-map on Next Scrape</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Automatically trigger auto-mapping or heuristic re-discovery on the next price check.
            </div>
          </div>
          <ToggleSwitch
            active={!!draftConfig.re_auto_map}
            onToggle={() => onUpdateConfig({ re_auto_map: !draftConfig.re_auto_map })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>User Agent Profile</label>
        <select
          className="form-control mb-2"
          value={draftConfig.user_agent || ''}
          onChange={e => { onUpdateConfig({ user_agent: e.target.value || null }); }}
        >
          <option value="">Use System Default (Inherit)</option>
          {GROUPED_PRESET_USER_AGENTS.map(grp => (
            <optgroup key={grp.group} label={grp.group}>
              {grp.options.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="text"
          className="form-control"
          value={draftConfig.user_agent || ''}
          onChange={e => onUpdateConfig({ user_agent: e.target.value || null })}
          placeholder="System default (leave empty to inherit)..."
        />
        {(() => {
          const diag = diagnoseRetailerUserAgent(draftConfig.user_agent, !!draftConfig.use_browser_scraper);
          if (diag.message) {
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning-color, #f59e0b)',
                  fontSize: '0.8rem'
                }}
              >
                <Icon name="alertTriangle" size="16px" />
                <span>{diag.message}</span>
              </div>
            );
          }
          return null;
        })()}
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
