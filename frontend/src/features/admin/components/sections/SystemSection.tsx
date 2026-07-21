import { useState, useEffect } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { SystemSettings } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { 
  CollapsibleCard, 
  ToggleSwitch
} from '../../components';

export default function SystemSection() {
  const { showToast } = useToast();
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [isTestingSearXNG, setIsTestingSearXNG] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sys_network: false,
    sys_discovery: false,
    sys_browser: false,
    sys_jsonld: false,
    sys_security: false,
    sys_maintenance: false
  });

  const toggleSection = (name: string) => {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminSystemService.getSystemSettings();
      const settings = res.data;
      setSystemSettings(settings);
    } catch {
      showToast('Failed to load system settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRegistration = async () => {
    try {
      const res = await AdminSystemService.updateSystemSettings({ 
        registration_enabled: !(systemSettings?.registration_enabled === true || systemSettings?.registration_enabled === 'true') 
      });
      setSystemSettings(res.data);
      showToast('Registration toggled', 'success');
    } catch {
      showToast('Update failed', 'error');
    }
  };

  const handleToggleDebugPage = async () => {
    try {
      const res = await AdminSystemService.updateSystemSettings({ 
        debug_page_enabled: !(systemSettings?.debug_page_enabled === true || systemSettings?.debug_page_enabled === 'true') 
      });
      setSystemSettings(res.data);
      showToast('Debug page toggled', 'success');
    } catch {
      showToast('Update failed', 'error');
    }
  };

  const handleTestSearXNG = async () => {
    if (!systemSettings?.searxng_url) return;
    setIsTestingSearXNG(true);
    try {
      const res = await AdminSystemService.testSearXNG(systemSettings.searxng_url);
      if (res.data?.success) {
        showToast(res.data.message, 'success');
      } else {
        showToast(res.data?.error || 'Test failed', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to connect to SearXNG', 'error');
    } finally {
      setIsTestingSearXNG(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!systemSettings) return;
    
    if (systemSettings.browser_timeout && systemSettings.browser_timeout <= 0) { showToast('Browser timeout must be positive', 'error'); return; }
    if (systemSettings.browser_delay && systemSettings.browser_delay <= 0) { showToast('Browser delay must be positive', 'error'); return; }
    
    setIsSavingAdmin(true);
    try {
      const payload = {
        ...systemSettings
      };

      const res = await AdminSystemService.updateSystemSettings(payload);
      setSystemSettings(res.data);
      showToast('Admin settings saved', 'success');
    } catch { showToast('Save failed', 'error'); } finally { setIsSavingAdmin(false); }
  };

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Core System Settings</h2>
      
      <CollapsibleCard title="🌐 Network & Integration" id="sys_network" expandedSections={expandedSections} onToggle={toggleSection}>
        <div className="form-group"><label>Proxy URL/Port</label><input type="text" value={systemSettings?.scraper_proxy || ''} onChange={e => setSystemSettings(s => s ? { ...s, scraper_proxy: e.target.value } : null)} placeholder="http://proxy:port" /></div>
        <div className="form-group"><label>Remote Scraper URL</label><input type="text" value={systemSettings?.remote_scraper_url || ''} onChange={e => setSystemSettings(s => s ? { ...s, remote_scraper_url: e.target.value } : null)} placeholder="http://192.168.50.215:5100/scrape" /></div>
      </CollapsibleCard>

      <CollapsibleCard title="🔎 Product Discovery (SearXNG)" id="sys_discovery" expandedSections={expandedSections} onToggle={toggleSection}>
        <div className="form-group">
          <label>SearXNG API URL</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={systemSettings?.searxng_url || ''} 
              onChange={e => setSystemSettings(s => s ? { ...s, searxng_url: e.target.value } : null)} 
              placeholder="https://searxng.example.com" 
              style={{ flex: 1 }}
            />
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleTestSearXNG}
              disabled={isTestingSearXNG || !systemSettings?.searxng_url}
            >
              {isTestingSearXNG ? '...' : 'Test'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enable Product Search</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allow users to find products by name in the Add Product modal.</div>
          </div>
          <ToggleSwitch 
            active={systemSettings?.searxng_enabled === true || systemSettings?.searxng_enabled === 'true'} 
            onToggle={() => setSystemSettings(s => s ? { ...s, searxng_enabled: !(s.searxng_enabled === true || s.searxng_enabled === 'true') } : null)} 
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="🖥️ Browser Configuration" id="sys_browser" expandedSections={expandedSections} onToggle={toggleSection}>
        <div className="form-group"><label>Default User-Agent</label><input type="text" value={systemSettings?.default_user_agent || ''} onChange={e => setSystemSettings(s => s ? { ...s, default_user_agent: e.target.value } : null)} /></div>
        <div className="form-group"><label>Default Referrer</label><input type="text" value={systemSettings?.default_referrer || ''} onChange={e => setSystemSettings(s => s ? { ...s, default_referrer: e.target.value } : null)} placeholder="https://www.google.com/" /></div>
        <div className="form-grid">
          <div className="form-group"><label>Browser Timeout (ms)</label><input type="number" value={systemSettings?.browser_timeout || 60000} onChange={e => setSystemSettings(s => s ? { ...s, browser_timeout: parseInt(e.target.value) || 0 } : null)} /></div>
          <div className="form-group"><label>Browser Delay (ms)</label><input type="number" value={systemSettings?.browser_delay || 3000} onChange={e => setSystemSettings(s => s ? { ...s, browser_delay: parseInt(e.target.value) || 0 } : null)} /></div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="🧬 JSON-LD & Structured Data" id="sys_jsonld" expandedSections={expandedSections} onToggle={toggleSection}>
        <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Prefer JSON-LD for Images</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>If found, prioritize high-quality JSON-LD images over CSS selectors.</div>
          </div>
          <ToggleSwitch 
            active={systemSettings?.prefer_jsonld_image === true || systemSettings?.prefer_jsonld_image === 'true'} 
            onToggle={() => setSystemSettings(s => s ? { ...s, prefer_jsonld_image: !(s.prefer_jsonld_image === true || s.prefer_jsonld_image === 'true') } : null)} 
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="🔐 Security & Access" id="sys_security" expandedSections={expandedSections} onToggle={toggleSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Allow User Registration</span>
          <ToggleSwitch active={systemSettings?.registration_enabled === true || systemSettings?.registration_enabled === 'true'} onToggle={handleToggleRegistration} disabled={isSavingAdmin} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enable Public Debug Page (/debug)</span>
          <ToggleSwitch active={systemSettings?.debug_page_enabled === true || systemSettings?.debug_page_enabled === 'true'} onToggle={handleToggleDebugPage} disabled={isSavingAdmin} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Disable Global Scheduler (Price Checks)</span>
          <ToggleSwitch 
            active={systemSettings?.scheduler_disabled === true || systemSettings?.scheduler_disabled === 'true'} 
            onToggle={async () => {
              const res = await AdminSystemService.updateSystemSettings({ 
                scheduler_disabled: !(systemSettings?.scheduler_disabled === true || systemSettings?.scheduler_disabled === 'true') 
              });
              setSystemSettings(res.data);
            }} 
            disabled={isSavingAdmin} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Disable Auto Retailer Updates</span>
          <ToggleSwitch 
            active={systemSettings?.retailer_updates_disabled === true || systemSettings?.retailer_updates_disabled === 'true'} 
            onToggle={async () => {
              const res = await AdminSystemService.updateSystemSettings({ 
                retailer_updates_disabled: !(systemSettings?.retailer_updates_disabled === true || systemSettings?.retailer_updates_disabled === 'true') 
              });
              setSystemSettings(res.data);
            }} 
            disabled={isSavingAdmin} 
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="🛠️ Maintenance" id="sys_maintenance" isExpanded={expandedSections.sys_maintenance} onToggle={toggleSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Refresh Database Cache</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Force the backend to immediately reload all settings, selectors, and retailers from the database.</div>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={async () => {
              try {
                await AdminSystemService.executeCommand('clear-settings-cache');
                showToast('System cache refreshed successfully', 'success');
              } catch {
                showToast('Failed to refresh system cache', 'error');
              }
            }}
          >
            Refresh DB
          </button>
        </div>
      </CollapsibleCard>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={fetchSystemData}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveSettings} disabled={isSavingAdmin}>Save Changes</button>
      </div>
    </div>
  );
}
