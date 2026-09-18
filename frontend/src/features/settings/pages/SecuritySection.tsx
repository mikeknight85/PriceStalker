import { useState } from 'react';
import { ProfileService } from '../services/ProfileService';
import { useToast } from '../../../context/ToastContext';
import { apiErrorMessage } from '../../../api/error';
import PasswordInput from '../../../components/PasswordInput';

export default function SecuritySection() {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = Boolean(currentPassword || newPassword || confirmPassword);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { showToast('Current and new password are required', 'error'); return; }
    if (newPassword.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    
    setIsSaving(true);
    try { 
      await ProfileService.changePassword(currentPassword, newPassword); 
      showToast('Password updated', 'success'); 
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); 
    }
    catch (err) { showToast(apiErrorMessage(err, 'Failed to update password')); }
    finally { setIsSaving(false); }
  };

  return (
    <section className="settings-card">
      <form onSubmit={(e) => { e.preventDefault(); void handleChangePassword(); }}>
        <h2 className="settings-card-title">Security & Password</h2>
        <p className="settings-card-description">
          Update your account password. We recommend using a unique, strong password.
        </p>
        <div className="form-group">
          <label>Current Password</label>
          <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>New Password</label>
            <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <div className="settings-actions">
          <button type="button" className="btn btn-secondary" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} disabled={!isDirty || isSaving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!isDirty || isSaving}>
            {isSaving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </section>
  );
}
