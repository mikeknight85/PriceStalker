import { useState, useMemo } from 'react';
import { UserAdminService } from '../../services/UserAdminService';
import { UserProfile, GlobalCurrency } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import { apiErrorMessage } from '../../../../api/error';
import { useAuth } from '../../../auth';
import { useQuery } from '@tanstack/react-query';
import { adminUsersQuery, queryKeys } from '../../../../api/queries';
import { queryClient } from '../../../../api/queryClient';
import PasswordInput from '../../../../components/PasswordInput';
import SearchableSelect from '../../../../components/SearchableSelect';
import { ToggleSwitch } from '../../components';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { AUTOMATIC_CURRENCY_OPTION, AUTOMATIC_LOCALE_OPTION, LOCALE_OPTIONS } from '../../../settings/regionalOptions';
import { formatDate, formatRelativeDate } from '../../../../utils/format';

interface UsersSectionProps {
  globalCurrencies: GlobalCurrency[];
}

export default function UsersSection({ globalCurrencies }: UsersSectionProps) {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  // Polled rather than loaded once: SSO provisions accounts on first sign-in,
  // so the panel used to miss users created since it was opened.
  const usersResult = useQuery(adminUsersQuery());
  const users: UserProfile[] = usersResult.data ?? [];
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserProfile> | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Add User states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCurrency, setNewUserCurrency] = useState('');
  const [newUserLocale, setNewUserLocale] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

  // Edit User states
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserConfirmPassword, setEditUserConfirmPassword] = useState('');

  // Filtering is local state, so a background refresh of the list leaves the
  // search box and its results alone.
  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(term) ||
      (u.name || '').toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  const isSsoUser = (u: Partial<UserProfile> | null) => u?.auth_provider === 'oidc';

  const fetchUsers = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) { showToast('Email and password required', 'error'); return; }
    try {
      await UserAdminService.createUser(newUserEmail, newUserPassword, newUserIsAdmin, newUserCurrency || undefined, newUserLocale || undefined);
      showToast('User created', 'success');
      setIsAddingUser(false);
      setNewUserEmail(''); setNewUserPassword('');
      fetchUsers();
    } catch (err) { showToast(apiErrorMessage(err, 'Failed to create user')); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser?.id) return;
    if (editUserPassword && editUserPassword !== editUserConfirmPassword) { showToast('Passwords do not match', 'error'); return; }
    try {
      await UserAdminService.updateUser(editingUser.id, { 
        name: editingUser.name, email: editingUser.email, currency: editingUser.currency || null, locale: editingUser.locale || null,
        is_admin: editingUser.is_admin, disabled: editingUser.disabled, password: editUserPassword || undefined 
      });
      showToast('User updated', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch { showToast('Update failed', 'error'); }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await UserAdminService.deleteUser(id);
      showToast('User deleted', 'success');
      fetchUsers();
    } catch { showToast('Delete failed', 'error'); }
  };

  return (
    <div className="admin-section-wrapper">
      <ConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => userToDelete && handleDeleteUser(userToDelete.id)}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.email}? This action cannot be undone.`}
        confirmText="Delete User"
        isDanger={true}
      />
      {!editingUser && !isAddingUser && (
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="settings-card-title" style={{ margin: 0 }}>User Management</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="search"
                className="form-control"
                style={{ width: 'auto', minWidth: '200px' }}
                placeholder="Search name or email"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                aria-label="Search users"
              />
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddingUser(true)}>+ Add User</button>
            </div>
          </div>

          <div className="mobile-scroll-hint">Swipe left to see more →</div>
          <div style={{ overflowX: 'auto', margin: '0 -1rem', padding: '0 1rem' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>User Account</th>
                  <th className="mobile-hide">Privileges</th>
                  <th className="mobile-hide">Last Active</th>
                  <th className="mobile-hide">Joined</th>
                  <th className="mobile-hide">Tracked</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                       <div style={{ fontWeight: 600 }}>{u.name || 'Unnamed User'}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                       {isSsoUser(u) && (
                         <span style={{
                           fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)',
                           marginTop: '0.25rem', display: 'inline-block'
                         }}>
                           SSO
                         </span>
                       )}
                       {u.disabled && (
                         <span style={{ 
                           fontSize: '0.6rem', fontWeight: 800, color: 'var(--danger)', 
                           marginTop: '0.25rem', display: 'inline-block' 
                         }}>
                           DISABLED
                         </span>
                       )}
                    </td>
                    <td className="mobile-hide">
                      <span style={{ 
                        fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '1rem',
                        background: u.is_admin ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--background)',
                        color: u.is_admin ? 'var(--primary)' : 'var(--text-muted)',
                        border: `1px solid ${u.is_admin ? 'var(--primary)' : 'var(--border)'}`
                      }}>
                        {u.is_admin ? 'ADMIN' : 'USER'}
                      </span>
                    </td>
                    <td className="mobile-hide" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.last_login_at ? formatRelativeDate(u.last_login_at, currentUser?.locale) : 'Never'}
                    </td>
                    <td className="mobile-hide" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(u.created_at, currentUser?.locale)}
                    </td>
                    <td className="mobile-hide" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.product_count ?? 0}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingUser(u); setEditUserPassword(''); setEditUserConfirmPassword(''); }} style={{ marginRight: '0.5rem' }}>Edit</button>
                      {u.id !== currentUser?.id && <button className="btn btn-danger btn-sm" onClick={() => setUserToDelete(u)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddingUser && (
        <div className="settings-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <h3 className="settings-card-title">Create New User</h3>
          <div className="form-group"><label>Email Address</label><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@example.com" autoComplete="off" /></div>
          <div className="form-group"><label>Account Password</label><PasswordInput secret value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} autoComplete="new-password" /></div>
          
          <div className="form-grid">
            <div className="form-group">
              <SearchableSelect
                label="Default Currency"
                options={[AUTOMATIC_CURRENCY_OPTION, ...globalCurrencies.map(gc => ({
                  label: `${gc.iso} (${gc.symbol})`,
                  value: gc.iso,
                  subLabel: gc.currency_name
                }))]}
                value={newUserCurrency}
                placeholder="Choose a currency"
                onChange={(val) => {
                  setNewUserCurrency(val);
                  const match = globalCurrencies.find(gc => gc.iso === val);
                  if (match) setNewUserLocale(match.locale);
                }}
              />
            </div>
            <div className="form-group">
              <SearchableSelect
                label="Default Locale"
                options={[AUTOMATIC_LOCALE_OPTION, ...LOCALE_OPTIONS]}
                value={newUserLocale}
                placeholder="Choose a locale"
                onChange={setNewUserLocale}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginTop: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Grant Administrator Privileges</span>
            <ToggleSwitch active={newUserIsAdmin} onToggle={() => setNewUserIsAdmin(!newUserIsAdmin)} />
          </div>

          <div className="settings-actions">
            <button className="btn btn-secondary" onClick={() => setIsAddingUser(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddUser}>Create Account</button>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="settings-card" style={{ border: '2px solid var(--primary)' }}>
          <h3 className="settings-card-title">Edit User: {editingUser.email}</h3>
          {isSsoUser(editingUser) && (
            <div className="alert" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              This account signs in through SSO. Its email address and password are
              managed by the identity provider and cannot be changed here.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="edit-user-email">Email Address</label>
            <input
              id="edit-user-email"
              type="email"
              value={editingUser.email || ''}
              disabled={isSsoUser(editingUser)}
              onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
            />
          </div>
          <div className="form-group"><label>Display Name</label><input type="text" value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} /></div>
          <div className="form-grid">
            <div className="form-group">
              <SearchableSelect
                label="Currency"
                options={[AUTOMATIC_CURRENCY_OPTION, ...globalCurrencies.map(gc => ({
                  label: `${gc.iso} (${gc.symbol})`,
                  value: gc.iso,
                  subLabel: gc.currency_name
                }))]}
                value={editingUser.currency || ''}
                onChange={(val) => {
                  setEditingUser(prev => prev ? { ...prev, currency: val } : null);
                  const match = globalCurrencies.find(gc => gc.iso === val);
                  if (match) setEditingUser(prev => prev ? { ...prev, currency: val, locale: match.locale } : null);
                }}
              />
            </div>
            <div className="form-group">
              <SearchableSelect
                label="Locale Format"
                options={[AUTOMATIC_LOCALE_OPTION, ...LOCALE_OPTIONS]}
                value={editingUser.locale || ''}
                onChange={(val) => setEditingUser(prev => prev ? { ...prev, locale: val } : null)}
              />
            </div>
          </div>
          {!isSsoUser(editingUser) && (
            <div className="form-grid" style={{ marginTop: '1rem' }}>
              <div className="form-group"><label>New Password (Optional)</label><PasswordInput secret value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} autoComplete="new-password" /></div>
              <div className="form-group"><label>Confirm New Password</label><PasswordInput secret value={editUserConfirmPassword} onChange={e => setEditUserConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Administrator Access</span>
            <ToggleSwitch active={!!editingUser.is_admin} onToggle={() => setEditingUser(prev => prev ? { ...prev, is_admin: !prev.is_admin } : null)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: editingUser.disabled ? 'var(--danger)' : 'inherit' }}>
              Disable Account
            </span>
            <ToggleSwitch 
              active={editingUser.disabled || false} 
              onToggle={() => setEditingUser(prev => prev ? { ...prev, disabled: !prev.disabled } : null)} 
            />
          </div>

          <div className="settings-actions">
            <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateUser}>Update User Account</button>
          </div>
        </div>
      )}
    </div>
  );
}
