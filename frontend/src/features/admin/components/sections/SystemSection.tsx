import { useState, useEffect } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { SystemSettings, TelemetryStatusResponse } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import { apiErrorMessage } from '../../../../api/error';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import CollapsibleCard from '../../../../components/CollapsibleCard';
import ToggleSwitch from '../../../../components/ToggleSwitch';
import Icon from '../../../../components/Icon';
import { queryClient } from '../../../../api/queryClient';
import { adminSystemSettingsQuery, queryKeys } from '../../../../api/queries';
import { useExpandedSections } from '../../../../hooks';
import { REFRESH_INTERVALS, snapToOfferedInterval } from '../../../../utils/refreshInterval';

export default function SystemSection() {
  const { showToast } = useToast();
  const [savedSettings, setSavedSettings] = useState<SystemSettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryStatusResponse | null>(null);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);
  const [isSendingTestPing, setIsSendingTestPing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [isTestingSearXNG, setIsTestingSearXNG] = useState(false);

  const { expandedSections, toggleSection } = useExpandedSections({
    sys_network: false,
    sys_tracking: false,
    sys_discovery: false,
    sys_browser: false,
    sys_security: false,
    sys_telemetry: false,
    sys_maintenance: false
  });

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const [res, tel] = await Promise.all([
        queryClient.fetchQuery(adminSystemSettingsQuery()),
        AdminSystemService.getTelemetryStatus().catch(() => null)
      ]);
      setSavedSettings(res);
      setSystemSettings(res);
      setTelemetryStatus(tel);
    } catch {
      showToast('Failed to load system settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = Boolean(
    savedSettings &&
    systemSettings &&
    JSON.stringify(savedSettings) !== JSON.stringify(systemSettings)
  );

  const handleTestSearXNG = async () => {
    if (!systemSettings?.searxng_url) return;
    setIsTestingSearXNG(true);
    try {
      const res = await AdminSystemService.testSearXNG(systemSettings.searxng_url);
      if (res?.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res?.error || 'Test failed', 'error');
      }
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to connect to SearXNG'), 'error');
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
      setSavedSettings(res);
      setSystemSettings(res);
      queryClient.setQueryData(queryKeys.adminSystemSettings, res);
      showToast('Admin settings saved', 'success');
    } catch { showToast('Save failed', 'error'); } finally { setIsSavingAdmin(false); }
  };

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <form onSubmit={(e) => { e.preventDefault(); void handleSaveSettings(); }}>
        <h2 className="settings-card-title">Core System Settings</h2>
      
      <CollapsibleCard title="Network & Integration" leadingIcon={<Icon name="globe" />} id="sys_network" isExpanded={expandedSections.sys_network} onToggle={toggleSection}>
        <div className="form-group"><label>Proxy URL/Port</label><input type="text" className="form-control" value={systemSettings?.scraper_proxy || ''} onChange={e => setSystemSettings(s => s ? { ...s, scraper_proxy: e.target.value } : null)} placeholder="http://proxy:port" /></div>
        <div className="form-group">
          <label>Browser Scraper URL</label>
          <input type="text" className="form-control" value={systemSettings?.remote_scraper_url || ''} onChange={e => setSystemSettings(s => s ? { ...s, remote_scraper_url: e.target.value } : null)} placeholder="http://scraper:5100/scrape" />
          <small style={{ color: 'var(--text-muted)' }}>
            Where the browser scraper service is running. Retailers with
            &ldquo;Use Browser Scraper&rdquo; enabled are fetched through it.
          </small>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Product Tracking" leadingIcon={<Icon name="clock" />} id="sys_tracking" isExpanded={expandedSections.sys_tracking} onToggle={toggleSection}>
        <div className="form-group">
          <label htmlFor="instance-default-refresh-interval">Default Check Interval</label>
          <select
            id="instance-default-refresh-interval"
            className="form-control"
            value={snapToOfferedInterval(Number(systemSettings?.default_refresh_interval))}
            onChange={e => setSystemSettings(s => s ? { ...s, default_refresh_interval: parseInt(e.target.value, 10) } : null)}
          >
            {REFRESH_INTERVALS.map(interval => (
              <option key={interval.value} value={interval.value}>{interval.label}</option>
            ))}
          </select>
          <small style={{ color: 'var(--text-muted)' }}>
            What a newly added product is checked every, for every account that
            has not set its own default under Settings -&gt; Tracking. Products
            already being tracked keep the interval they have. Shorter intervals
            mean more requests to each retailer; one hour is the shortest
            allowed.
          </small>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Product Discovery (SearXNG)" leadingIcon={<Icon name="search" />} id="sys_discovery" isExpanded={expandedSections.sys_discovery} onToggle={toggleSection}>
        <div className="form-group">
          <label>SearXNG API URL</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="form-control"
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

      <CollapsibleCard title="Browser Configuration" leadingIcon={<Icon name="monitor" />} id="sys_browser" isExpanded={expandedSections.sys_browser} onToggle={toggleSection}>
        <div className="form-group"><label>Default User-Agent</label><input type="text" className="form-control" value={systemSettings?.default_user_agent || ''} onChange={e => setSystemSettings(s => s ? { ...s, default_user_agent: e.target.value } : null)} /></div>
        <div className="form-group"><label>Default Referrer</label><input type="text" className="form-control" value={systemSettings?.default_referrer || ''} onChange={e => setSystemSettings(s => s ? { ...s, default_referrer: e.target.value } : null)} placeholder="https://www.google.com/" /></div>
        <div className="form-grid">
          <div className="form-group"><label>Browser Timeout (ms)</label><input type="number" className="form-control" value={systemSettings?.browser_timeout || 60000} onChange={e => setSystemSettings(s => s ? { ...s, browser_timeout: parseInt(e.target.value) || 0 } : null)} /></div>
          <div className="form-group"><label>Browser Delay (ms)</label><input type="number" className="form-control" value={systemSettings?.browser_delay || 3000} onChange={e => setSystemSettings(s => s ? { ...s, browser_delay: parseInt(e.target.value) || 0 } : null)} /></div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Security & Access" leadingIcon={<Icon name="shield" />} id="sys_security" isExpanded={expandedSections.sys_security} onToggle={toggleSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Allow User Registration</span>
          <ToggleSwitch
            active={systemSettings?.registration_enabled === true || systemSettings?.registration_enabled === 'true'}
            onToggle={() => setSystemSettings(s => s ? { ...s, registration_enabled: !(s.registration_enabled === true || s.registration_enabled === 'true') } : null)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Allow Password Reset via Email</span>
          <ToggleSwitch
            active={systemSettings?.password_reset_enabled === undefined || systemSettings?.password_reset_enabled === true || systemSettings?.password_reset_enabled === 'true'}
            onToggle={() => setSystemSettings(s => s ? { ...s, password_reset_enabled: !(s.password_reset_enabled === undefined || s.password_reset_enabled === true || s.password_reset_enabled === 'true') } : null)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enable Admin Debug Page</span>
          <ToggleSwitch
            active={systemSettings?.debug_page_enabled === true || systemSettings?.debug_page_enabled === 'true'}
            onToggle={() => setSystemSettings(s => s ? { ...s, debug_page_enabled: !(s.debug_page_enabled === true || s.debug_page_enabled === 'true') } : null)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Disable Global Scheduler (Price Checks)</span>
          <ToggleSwitch
            active={systemSettings?.scheduler_disabled === true || systemSettings?.scheduler_disabled === 'true'}
            onToggle={() => setSystemSettings(s => s ? { ...s, scheduler_disabled: !(s.scheduler_disabled === true || s.scheduler_disabled === 'true') } : null)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Disable Auto Retailer Updates</span>
          <ToggleSwitch
            active={systemSettings?.retailer_updates_disabled === true || systemSettings?.retailer_updates_disabled === 'true'}
            onToggle={() => setSystemSettings(s => s ? { ...s, retailer_updates_disabled: !(s.retailer_updates_disabled === true || s.retailer_updates_disabled === 'true') } : null)}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Anonymous Telemetry" leadingIcon={<Icon name="radio" />} id="sys_telemetry" isExpanded={expandedSections.sys_telemetry} onToggle={toggleSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Share Anonymous Usage Statistics</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Sends a daily heartbeat with minimal technical metrics (app version, OS/architecture, coarse usage bucket).
            </div>
          </div>
          <ToggleSwitch
            disabled={telemetryStatus?.envDisabled}
            active={!telemetryStatus?.envDisabled && (systemSettings?.telemetry_enabled === undefined || systemSettings?.telemetry_enabled === true || systemSettings?.telemetry_enabled === 'true')}
            onToggle={() => setSystemSettings(s => s ? { ...s, telemetry_enabled: !(s.telemetry_enabled === undefined || s.telemetry_enabled === true || s.telemetry_enabled === 'true') } : null)}
          />
        </div>

        {telemetryStatus?.envDisabled && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: '0.375rem', marginBottom: '1rem' }}>
            Telemetry is explicitly disabled via the <code>DISABLE_TELEMETRY</code> or <code>DO_NOT_TRACK</code> environment variable.
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                const tel = await AdminSystemService.getTelemetryStatus();
                setTelemetryStatus(tel);
                setShowPayloadPreview(prev => !prev);
              } catch {
                showToast('Failed to load telemetry preview', 'error');
              }
            }}
          >
            {showPayloadPreview ? 'Hide Payload Preview' : 'View Payload Preview'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isSendingTestPing || telemetryStatus?.envDisabled}
            onClick={async () => {
              setIsSendingTestPing(true);
              try {
                const res = await AdminSystemService.sendTelemetryPing();
                if (res.success) {
                  showToast('Telemetry test ping sent successfully', 'success');
                  const tel = await AdminSystemService.getTelemetryStatus();
                  setTelemetryStatus(tel);
                } else {
                  showToast(res.error || 'Test ping failed', 'error');
                }
              } catch {
                showToast('Failed to send test ping', 'error');
              } finally {
                setIsSendingTestPing(false);
              }
            }}
          >
            {isSendingTestPing ? 'Sending...' : 'Send Test Ping'}
          </button>
        </div>

        {showPayloadPreview && telemetryStatus?.preview && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TRANSMITTED PAYLOAD PREVIEW</span>
              {telemetryStatus.lastPingAt && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Last ping: {telemetryStatus.lastPingAt}
                </span>
              )}
            </div>
            <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
              {JSON.stringify(telemetryStatus.preview, null, 2)}
            </pre>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Maintenance" leadingIcon={<Icon name="wrench" />} id="sys_maintenance" isExpanded={expandedSections.sys_maintenance} onToggle={toggleSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Refresh Database Cache</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Force the backend to immediately reload all settings, selectors, and retailers from the database.</div>
          </div>
          <button 
            type="button"
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
        <button type="button" className="btn btn-secondary" onClick={() => savedSettings && setSystemSettings(savedSettings)} disabled={!isDirty || isSavingAdmin}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!isDirty || isSavingAdmin}>
          {isSavingAdmin ? 'Saving...' : 'Save'}
        </button>
      </div>
      </form>
    </div>
  );
}
