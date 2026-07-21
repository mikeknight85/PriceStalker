import { useState, useEffect } from 'react';
import { UserAdminService } from '../../services/UserAdminService';
import { UserProfile, GlobalCurrency } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import { useAuth } from '../../../auth';
import PasswordInput from '../../../../components/PasswordInput';
import SearchableSelect from '../../../../components/SearchableSelect';
import { ToggleSwitch } from '../../components';
import ConfirmationModal from '../../../../components/ConfirmationModal';

interface UsersSectionProps {
  globalCurrencies: GlobalCurrency[];
}

export default function UsersSection({ globalCurrencies }: UsersSectionProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserProfile> | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Add User states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCurrency, setNewUserCurrency] = useState('AUD');
  const [newUserLocale, setNewUserLocale] = useState('en-AU');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

  // Edit User states
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserConfirmPassword, setEditUserConfirmPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await UserAdminService.getUsers();
      setUsers(res.data);
    } catch {
      showToast('Failed to load users', 'error');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) { showToast('Email and password required', 'error'); return; }
    try {
      await UserAdminService.createUser(newUserEmail, newUserPassword, newUserIsAdmin, newUserCurrency, newUserLocale);
      showToast('User created', 'success');
      setIsAddingUser(false);
      setNewUserEmail(''); setNewUserPassword('');
      fetchUsers();
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed to create user'); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser?.id) return;
    if (editUserPassword && editUserPassword !== editUserConfirmPassword) { showToast('Passwords do not match', 'error'); return; }
    try {
      await UserAdminService.updateUser(editingUser.id, { 
        name: editingUser.name, email: editingUser.email, currency: editingUser.currency, locale: editingUser.locale, 
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
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddingUser(true)}>+ Add User</button>
          </div>

          <div className="mobile-scroll-hint">Swipe left to see more →</div>
          <div style={{ overflowX: 'auto', margin: '0 -1rem', padding: '0 1rem' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>User Account</th>
                  <th className="mobile-hide">Privileges</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                       <div style={{ fontWeight: 600 }}>{u.name || 'Unnamed User'}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
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
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingUser(u); setEditUserPassword(''); setEditUserConfirmPassword(''); }} style={{ marginRight: '0.5rem' }}>Edit</button>
                      {u.id !== user?.id && <button className="btn btn-danger btn-sm" onClick={() => setUserToDelete(u)}>Delete</button>}
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
          <div className="form-group"><label>Account Password</label><PasswordInput value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} autoComplete="new-password" /></div>
          
          <div className="form-grid">
            <div className="form-group">
              <SearchableSelect
                label="Default Currency"
                options={globalCurrencies.map(gc => ({
                  label: `${gc.iso} (${gc.symbol})`,
                  value: gc.iso,
                  subLabel: gc.currency_name
                }))}
                value={newUserCurrency}
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
                options={globalCurrencies.map(gc => ({
                  label: gc.locale,
                  value: gc.locale,
                  subLabel: `${gc.country_territory} (${gc.iso})`
                }))}
                value={newUserLocale}
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
          <div className="form-group"><label>Display Name</label><input type="text" value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} /></div>
          <div className="form-grid">
            <div className="form-group">
              <SearchableSelect
                label="Currency"
                options={globalCurrencies.map(gc => ({
                  label: `${gc.iso} (${gc.symbol})`,
                  value: gc.iso,
                  subLabel: gc.currency_name
                }))}
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
                options={globalCurrencies.map(gc => ({
                  label: gc.locale,
                  value: gc.locale,
                  subLabel: `${gc.country_territory} (${gc.iso})`
                }))}
                value={editingUser.locale || ''}
                onChange={(val) => setEditingUser(prev => prev ? { ...prev, locale: val } : null)}
              />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <div className="form-group"><label>New Password (Optional)</label><PasswordInput value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} autoComplete="new-password" /></div>
            <div className="form-group"><label>Confirm New Password</label><PasswordInput value={editUserConfirmPassword} onChange={e => setEditUserConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
          </div>
          
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
