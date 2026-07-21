import { useState } from 'react';
import { ProfileService } from '../services/ProfileService';
import { useToast } from '../../../context/ToastContext';
import PasswordInput from '../../../components/PasswordInput';

export default function SecuritySection() {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    catch (err: any) { showToast(err.response?.data?.error || 'Failed to update password'); }
    finally { setIsSaving(false); }
  };

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Security & Password</h2>
      <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
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
        <button className="btn btn-secondary" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>Reset</button>
        <button className="btn btn-primary" onClick={handleChangePassword} disabled={isSaving}>Update Password</button>
      </div>
    </section>
  );
}
