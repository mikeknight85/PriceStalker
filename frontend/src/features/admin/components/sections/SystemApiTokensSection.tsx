import { useState, useEffect } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { SystemApiToken } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import ConfirmationModal from '../../../../components/ConfirmationModal';

export default function SystemApiTokensSection() {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<SystemApiToken[]>([]);
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenDescription, setNewTokenDescription] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<SystemApiToken | null>(null);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await AdminSystemService.getSystemApiTokens();
      setTokens(res.data);
    } catch {
      showToast('Failed to load system API tokens', 'error');
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenLabel) {
      showToast('Label is required', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const res = await AdminSystemService.createSystemApiToken({
        label: newTokenLabel,
        description: newTokenDescription
      });
      setGeneratedToken(res.data.token);
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
              <h2 className="settings-card-title" style={{ margin: 0 }}>System API Tokens</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Manage long-lived API tokens for system integrations and external tools.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddingToken(true)}>+ Generate Token</button>
          </div>

          <div style={{ overflowX: 'auto', margin: '0 -1rem', padding: '0 1rem' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Token Info</th>
                  <th className="mobile-hide">Status</th>
                  <th>Last Used</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No system API tokens found.
                    </td>
                  </tr>
                ) : (
                  tokens.map(token => (
                    <tr key={token.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{token.label}</div>
                        {token.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{token.description}</div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Created: {new Date(token.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="mobile-hide">
                        <span style={{ 
                          fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '1rem',
                          background: 'rgba(0, 200, 83, 0.1)',
                          color: '#00c853',
                          border: '1px solid #00c853'
                        }}>
                          ACTIVE
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>
                          {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never'}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddingToken && (
        <div className="settings-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <h3 className="settings-card-title">
            {generatedToken ? 'API Token Generated' : 'Generate System API Token'}
          </h3>
          
          {!generatedToken ? (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Provide a label to identify this token. It will be generated and shown exactly once.
              </p>
              <div className="form-group">
                <label>Label</label>
                <input 
                  type="text" 
                  value={newTokenLabel} 
                  onChange={e => setNewTokenLabel(e.target.value)} 
                  placeholder="e.g. PriceStalker CLI, Integration Server" 
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea 
                  value={newTokenDescription} 
                  onChange={e => setNewTokenDescription(e.target.value)} 
                  placeholder="Briefly describe what this token is for..."
                  style={{ minHeight: '80px' }}
                />
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
              </div>
              
              <div style={{ 
                background: 'rgba(255, 171, 0, 0.1)', 
                border: '1px solid #ffab00', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{ color: '#ffab00', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                  ⚠️ Warning: You won't be able to see this token again. Store it securely.
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
