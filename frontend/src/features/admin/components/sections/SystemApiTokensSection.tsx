import { useState, type CSSProperties } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { SystemApiToken, TokenScopeOption } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import Icon from '../../../../components/Icon';
import { useAuth } from '../../../auth';
import { formatDate } from '../../../../utils/format';
import { useQuery } from '@tanstack/react-query';
import { adminTokensQuery, queryKeys } from '../../../../api/queries';
import { queryClient } from '../../../../api/queryClient';

const FULL_ACCESS = '*';

/**
 * Used when the scope list cannot be read from the server.
 *
 * The vocabulary lives in the backend (`services/domain/token/scopes.ts`) and
 * is served by `GET /admin/system-tokens/scopes`; this is only so the creation
 * form still works if that call fails, rather than offering an empty list and
 * no way to issue a token.
 */
const FALLBACK_SCOPES: TokenScopeOption[] = [
  { scope: 'mcp:read', description: 'Read tracked items, price history and read-only diagnostics', deprecated: false },
  { scope: 'mcp:write', description: 'Add, rescan and untrack products', deprecated: false },
  { scope: 'mcp:extract', description: 'Run the URL extraction and debug endpoints', deprecated: false },
  { scope: 'admin:read', description: 'Read instance configuration and logs', deprecated: false },
  { scope: 'admin:write', description: 'Change instance configuration', deprecated: false },
  { scope: 'admin:system', description: 'Run operational commands and clear the system log', deprecated: false },
  { scope: FULL_ACCESS, description: 'Full access to every endpoint (legacy and emergency use)', deprecated: true },
];

const EXPIRY_CHOICES: { label: string; days: number | null }[] = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'Never expires', days: null },
];

const DEFAULT_EXPIRY_DAYS = 90;

/**
 * A token issued before scopes existed.
 *
 * The marker is the missing prefix, not the scopes: `['*']` is a legitimate
 * choice for a new token, but a null prefix can only mean the row predates
 * migration 022 -- the prefix could not be recovered from the bcrypt hash, so
 * such a token is unscoped, has full access, and still needs the slow
 * verification scan.
 */
const isLegacyToken = (token: SystemApiToken) => !token.token_prefix;

const isExpired = (token: SystemApiToken) =>
  !!token.expires_at && new Date(token.expires_at).getTime() < Date.now();

const expiresAtFromDays = (days: number | null): string | undefined => {
  if (days === null) return undefined;
  const when = new Date();
  when.setDate(when.getDate() + days);
  return when.toISOString();
};

export default function SystemApiTokensSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  // Polled rather than loaded once: tokens can be created or revoked by CLI
  // scripts and external integrations, and the panel used to show a stale list
  // until the whole page was reloaded.
  const tokensResult = useQuery(adminTokensQuery());
  // Never trust the shape: an unmocked endpoint answers `{}` in the e2e suite
  // and so does a misconfigured proxy, and `{}.map` takes the section down.
  const tokens: SystemApiToken[] = Array.isArray(tokensResult.data) ? tokensResult.data : [];

  const scopesResult = useQuery({
    queryKey: ['admin', 'system-tokens', 'scopes'],
    queryFn: () => AdminSystemService.getSystemApiTokenScopes(),
  });
  const availableScopes: TokenScopeOption[] = Array.isArray(scopesResult.data?.scopes)
    ? scopesResult.data.scopes
    : FALLBACK_SCOPES;

  const [isAddingToken, setIsAddingToken] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenDescription, setNewTokenDescription] = useState('');
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(['mcp:read']);
  const [newTokenExpiryDays, setNewTokenExpiryDays] = useState<number | null>(DEFAULT_EXPIRY_DAYS);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<SystemApiToken | null>(null);

  const legacyCount = tokens.filter(isLegacyToken).length;

  const fetchTokens = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminTokens });

  const toggleScope = (scope: string) => {
    setNewTokenScopes(current => {
      if (current.includes(scope)) {
        return current.filter(entry => entry !== scope);
      }
      // Full access is not a scope you combine with others -- it already
      // contains them, and showing both invites the reader to think the
      // narrower ones are limiting something.
      if (scope === FULL_ACCESS) return [FULL_ACCESS];
      return [...current.filter(entry => entry !== FULL_ACCESS), scope];
    });
  };

  const handleCreateToken = async () => {
    if (!newTokenLabel) {
      showToast('Label is required', 'error');
      return;
    }
    if (newTokenScopes.length === 0) {
      showToast('Select at least one scope', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const res = await AdminSystemService.createSystemApiToken({
        label: newTokenLabel,
        description: newTokenDescription,
        scopes: newTokenScopes,
        expires_at: expiresAtFromDays(newTokenExpiryDays)
      });
      setGeneratedToken(res.token);
      showToast('System API token created successfully', 'success');
      fetchTokens();
    } catch (err) {
      showToast('Failed to create system API token', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteToken = async (id: number) => {
    try {
      await AdminSystemService.deleteSystemApiToken(id);
      showToast('System API token deleted', 'success');
      fetchTokens();
    } catch {
      showToast('Failed to delete system API token', 'error');
    }
  };

  const closeCreationView = () => {
    setIsAddingToken(false);
    setGeneratedToken(null);
    setNewTokenLabel('');
    setNewTokenDescription('');
    setNewTokenScopes(['mcp:read']);
    setNewTokenExpiryDays(DEFAULT_EXPIRY_DAYS);
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
      showToast('Token copied to clipboard', 'success');
    } else {
      // Fallback for non-HTTPS or if clipboard API is missing
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Ensure the textarea is off-screen
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('Token copied to clipboard', 'success');
      } catch (err) {
        showToast('Failed to copy token', 'error');
      }
      document.body.removeChild(textArea);
    }
  };

  const badgeStyle = (colour: string): CSSProperties => ({
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.25rem 0.5rem',
    borderRadius: '1rem',
    background: `${colour}1a`,
    color: colour,
    border: `1px solid ${colour}`,
    whiteSpace: 'nowrap'
  });

  const scopeChipStyle: CSSProperties = {
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    padding: '0.15rem 0.4rem',
    borderRadius: '0.25rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)'
  };

  return (
    <div className="admin-section-wrapper">
      <ConfirmationModal
        isOpen={!!tokenToDelete}
        onClose={() => setTokenToDelete(null)}
        onConfirm={() => tokenToDelete && handleDeleteToken(tokenToDelete.id)}
        title="Delete API Token"
        message={`Are you sure you want to delete the token "${tokenToDelete?.label}"? Any systems using this token will lose access immediately.`}
        confirmText="Delete Token"
        isDanger={true}
      />
      {!isAddingToken && (
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className="settings-card-title">System API Tokens</h2>
              <p className="settings-card-description">
                Manage long-lived API tokens for system integrations and external tools.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddingToken(true)}>+ Generate Token</button>
          </div>

          {legacyCount > 0 && (
            <div style={{
              background: 'rgba(255, 171, 0, 0.1)',
              border: '1px solid #ffab00',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ color: '#ffab00', fontSize: '0.875rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="alertTriangle" />
                {legacyCount === 1
                  ? '1 token was issued before scopes existed.'
                  : `${legacyCount} tokens were issued before scopes existed.`}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                They have unrestricted access to every endpoint, cannot be narrowed, and still use the
                slower verification path. Generate a replacement with only the scopes it needs, point the
                integration at it, then delete the old one. Support for unscoped tokens will be removed in
                a future release.
              </p>
            </div>
          )}

          <div style={{ overflowX: 'auto', margin: '0 -1rem', padding: '0 1rem' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Token Info</th>
                  <th>Scopes</th>
                  <th className="mobile-hide">Status</th>
                  <th>Last Used</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No system API tokens found.
                    </td>
                  </tr>
                ) : (
                  tokens.map(token => {
                    const legacy = isLegacyToken(token);
                    const expired = isExpired(token);
                    const scopes = Array.isArray(token.scopes) ? token.scopes : [];
                    return (
                      <tr key={token.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{token.label}</div>
                          {token.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{token.description}</div>
                          )}
                          {token.token_prefix && (
                            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              {token.token_prefix}...
                            </div>
                          )}
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Created: {formatDate(token.created_at, user?.locale)}
                            {token.expires_at && ` / Expires: ${formatDate(token.expires_at, user?.locale)}`}
                          </div>
                        </td>
                        <td>
                          {legacy ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                              <span style={badgeStyle('#ffab00')}>DEPRECATED / UNSCOPED / FULL ACCESS</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Issued before scopes. Regenerate to restrict it.
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {scopes.length === 0 ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No scopes</span>
                              ) : (
                                scopes.map(scope => (
                                  <span
                                    key={scope}
                                    style={scope === FULL_ACCESS
                                      ? { ...scopeChipStyle, color: '#ffab00', borderColor: '#ffab00' }
                                      : scopeChipStyle}
                                    title={scope === FULL_ACCESS ? 'Full access to every endpoint' : undefined}
                                  >
                                    {scope === FULL_ACCESS ? 'full access' : scope}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                        <td className="mobile-hide">
                          <span style={expired ? badgeStyle('#ff5252') : badgeStyle('#00c853')}>
                            {expired ? 'EXPIRED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.875rem' }}>
                            {token.last_used_at ? formatDate(token.last_used_at, user?.locale, true) : 'Never'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setTokenToDelete(token)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddingToken && (
        <div className="settings-card settings-card--active">
          <h3 className="settings-panel-title">
            {generatedToken ? 'API Token Generated' : 'Generate System API Token'}
          </h3>

          {!generatedToken ? (
            <>
              <p className="settings-card-description" style={{ marginBottom: '1.5rem' }}>
                Provide a label to identify this token. It will be generated and shown exactly once.
              </p>
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  className="form-control"
                  value={newTokenLabel}
                  onChange={e => setNewTokenLabel(e.target.value)}
                  placeholder="e.g. PriceStalker CLI, Integration Server"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="form-control"
                  value={newTokenDescription}
                  onChange={e => setNewTokenDescription(e.target.value)}
                  placeholder="Briefly describe what this token is for..."
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="form-group">
                <label>Scopes</label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                  Grant only what this integration needs. A token can do nothing outside its scopes,
                  and it still has to belong to an administrator to reach the admin endpoints.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {availableScopes.map(option => (
                    <label
                      key={option.scope}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        fontWeight: 400,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newTokenScopes.includes(option.scope)}
                        onChange={() => toggleScope(option.scope)}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <span>
                        <code style={{ fontSize: '0.8rem' }}>{option.scope}</code>
                        {option.deprecated && (
                          <span style={{ ...badgeStyle('#ffab00'), marginLeft: '0.5rem' }}>DEPRECATED</span>
                        )}
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Expires</label>
                <select
                  className="form-control"
                  value={newTokenExpiryDays === null ? 'never' : String(newTokenExpiryDays)}
                  onChange={e => setNewTokenExpiryDays(e.target.value === 'never' ? null : Number(e.target.value))}
                >
                  {EXPIRY_CHOICES.map(choice => (
                    <option key={choice.label} value={choice.days === null ? 'never' : String(choice.days)}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                  An expired token is refused before its scopes are even considered. Existing tokens
                  without an expiry keep working.
                </p>
              </div>

              <div className="settings-actions">
                <button className="btn btn-secondary" onClick={() => setIsAddingToken(false)} disabled={isLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateToken} disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Generate Token'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: 'rgba(var(--primary-rgb), 0.05)',
                border: '1px solid var(--primary)',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Copy your new token:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <code style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--surface)',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    wordBreak: 'break-all'
                  }}>
                    {generatedToken}
                  </code>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(generatedToken)}
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>
                  Scopes: {newTokenScopes.join(', ')}
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 171, 0, 0.1)',
                border: '1px solid #ffab00',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{ color: '#ffab00', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                  <Icon name="alertTriangle" /> Warning: You won't be able to see this token again. Store it securely.
                </p>
              </div>

              <div className="settings-actions">
                <button className="btn btn-primary" onClick={closeCreationView}>I have saved the token</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
