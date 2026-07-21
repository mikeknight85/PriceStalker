import { useState, useEffect } from 'react';
import {
  AuthConfigService,
  AuthConfigAdminView,
  AuthPolicy,
  AuthConfigUpdate,
  DiscoveryResult,
} from '../../services/AuthConfigService';
import { useToast } from '../../../../context/ToastContext';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import PasswordInput from '../../../../components/PasswordInput';
import { CollapsibleCard, ToggleSwitch } from '../../components';
import Icon from '../../../../components/Icon';

const toggleRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.25rem',
  background: 'var(--background)',
  padding: '0.75rem',
  borderRadius: '0.5rem',
};

/**
 * Instance-wide authentication policy and OIDC provider configuration.
 *
 * The client secret is write-only: the API returns has_client_secret rather than
 * the value, so the field starts empty and submitting it empty means "keep what
 * is stored". Clearing it is therefore an explicit action, not an empty box.
 */
export default function AuthSection() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<AuthConfigAdminView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);

  const [policy, setPolicy] = useState<AuthPolicy>('local');
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clearSecret, setClearSecret] = useState(false);
  const [scopes, setScopes] = useState('openid profile email');
  const [jitEnabled, setJitEnabled] = useState(true);
  const [requireEmailVerified, setRequireEmailVerified] = useState(true);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    auth_policy: true,
    auth_provider: true,
    auth_behaviour: false,
  });
  const toggleSection = (id: string) =>
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data } = await AuthConfigService.get();
      applyConfig(data);
    } catch {
      showToast('Failed to load authentication settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const applyConfig = (data: AuthConfigAdminView) => {
    setConfig(data);
    setPolicy(data.policy);
    setOidcEnabled(data.oidc_enabled);
    setProviderName(data.oidc_provider_name || '');
    setIssuerUrl(data.oidc_issuer_url || '');
    setClientId(data.oidc_client_id || '');
    setScopes(data.oidc_scopes);
    setJitEnabled(data.oidc_jit_enabled);
    setRequireEmailVerified(data.oidc_require_email_verified);
    setClientSecret('');
    setClearSecret(false);
  };

  const handleTestDiscovery = async () => {
    if (!issuerUrl) {
      showToast('Enter an issuer URL first', 'error');
      return;
    }
    setIsTesting(true);
    setDiscovery(null);
    try {
      const { data } = await AuthConfigService.testDiscovery(issuerUrl);
      setDiscovery(data);
      showToast('Discovery succeeded', 'success');
    } catch (err) {
      const e = err as { response?: { data?: DiscoveryResult } };
      const result = e.response?.data ?? { ok: false, error: 'Discovery request failed' };
      setDiscovery(result);
      showToast(result.error || 'Discovery failed', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: AuthConfigUpdate = {
        policy,
        oidc_enabled: oidcEnabled,
        oidc_provider_name: providerName || null,
        oidc_issuer_url: issuerUrl || null,
        oidc_client_id: clientId || null,
        // undefined keeps the stored secret; null clears it; a string replaces it
        oidc_client_secret: clearSecret ? null : clientSecret ? clientSecret : undefined,
        oidc_scopes: scopes,
        oidc_jit_enabled: jitEnabled,
        oidc_require_email_verified: requireEmailVerified,
      };
      const { data } = await AuthConfigService.update(payload);
      applyConfig(data);
      showToast('Authentication settings saved', 'success');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      showToast(e.response?.data?.error || 'Failed to save authentication settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullPage size="2rem" />;

  const policyHint =
    policy === 'oidc'
      ? 'SSO only. The password form is hidden, but /login?local=1 still reaches it so a broken provider cannot lock admins out.'
      : policy === 'both'
      ? 'The login page shows both the SSO button and the local password form.'
      : 'SSO is hidden from the login page. The OIDC settings below are saved but unused until this is set to Both or SSO only.';

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Authentication</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Instance-wide sign-in policy. Requires <code>ENABLE_SSO=true</code> in the backend
        environment — without it the OIDC routes stay disabled regardless of what is saved here.
      </p>

      <CollapsibleCard
        title="Sign-in Policy" leadingIcon={<Icon name="key" />}
        id="auth_policy"
        expandedSections={expandedSections}
        onToggle={toggleSection}
      >
        <div className="form-group">
          <label>Policy</label>
          <select value={policy} onChange={e => setPolicy(e.target.value as AuthPolicy)}>
            <option value="local">Local only</option>
            <option value="both">Both</option>
            <option value="oidc">SSO only</option>
          </select>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            {policyHint}
          </div>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>OIDC Enabled</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Cannot be enabled without both an issuer URL and a client ID — the server rejects
              that rather than leaving the login page half-configured.
            </div>
          </div>
          <ToggleSwitch active={oidcEnabled} onToggle={() => setOidcEnabled(!oidcEnabled)} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Provider" leadingIcon={<Icon name="globe" />}
        id="auth_provider"
        expandedSections={expandedSections}
        onToggle={toggleSection}
      >
        <div className="form-group">
          <label>Display Name</label>
          <input
            type="text"
            value={providerName}
            onChange={e => setProviderName(e.target.value)}
            placeholder="Authentik"
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Shown on the login button: “Sign in with …”.
          </div>
        </div>

        <div className="form-group">
          <label>Issuer URL</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              style={{ flex: 1 }}
              value={issuerUrl}
              onChange={e => setIssuerUrl(e.target.value)}
              placeholder="https://auth.example.com/application/o/pricestalker/"
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestDiscovery}
              disabled={isTesting}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isTesting ? 'Testing...' : 'Test'}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            Test fetches <code>/.well-known/openid-configuration</code>. Worth doing before
            saving: a wrong URL otherwise only surfaces at the first real login attempt.
          </div>
          {discovery && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.625rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                background: 'var(--background)',
                color: discovery.ok ? 'var(--text)' : 'var(--danger)',
              }}
            >
              {discovery.ok ? (
                <>
                  <strong>Discovery OK</strong>
                  <div>issuer: {discovery.issuer}</div>
                  <div>authorize: {discovery.authorization_endpoint}</div>
                  <div>token: {discovery.token_endpoint}</div>
                </>
              ) : (
                discovery.error
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="pricestalker"
          />
        </div>

        <div className="form-group">
          <label>Client Secret {config?.has_client_secret ? '(set)' : ''}</label>
          {clearSecret ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <em style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Will be cleared on save.
              </em>
              <button className="btn btn-secondary" onClick={() => setClearSecret(false)}>
                Undo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <PasswordInput
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder={
                    config?.has_client_secret ? '••••••• (leave empty to keep existing)' : ''
                  }
                />
              </div>
              {config?.has_client_secret && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setClientSecret('');
                    setClearSecret(true);
                  }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            Never returned by the API. Leave empty to keep the existing value.
          </div>
        </div>

        <div className="form-group">
          <label>Scopes</label>
          <input type="text" value={scopes} onChange={e => setScopes(e.target.value)} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Space-separated. <code>openid</code> is required; <code>email</code> is required for
            JIT provisioning and for linking to existing accounts by email.
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Account Behaviour" leadingIcon={<Icon name="user" />}
        id="auth_behaviour"
        expandedSections={expandedSections}
        onToggle={toggleSection}
      >
        <div style={toggleRow}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Just-in-Time Provisioning</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Create an account automatically on first SSO sign-in. With this off, a user with no
              existing account is refused and told to ask an admin.
            </div>
          </div>
          <ToggleSwitch active={jitEnabled} onToggle={() => setJitEnabled(!jitEnabled)} />
        </div>

        <div style={toggleRow}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Require Verified Email</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Rejects sign-in unless the provider asserts <code>email_verified</code>. Turn off
              only if your provider omits that claim — Authentik's default scope mapping and
              Keycloak without an explicit mapper both do.
            </div>
          </div>
          <ToggleSwitch
            active={requireEmailVerified}
            onToggle={() => setRequireEmailVerified(!requireEmailVerified)}
          />
        </div>
      </CollapsibleCard>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Authentication Settings'}
        </button>
        {config && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last updated {new Date(config.updated_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
