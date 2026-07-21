import { useState, useEffect } from 'react';
import { ProfileService } from '../services/ProfileService';
import { UserProfile } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function ProfileSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await ProfileService.getProfile();
      setProfile(res.data);
      setProfileName(res.data.name || '');
    } catch {
      showToast('Failed to load profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await ProfileService.updateProfile({
        name: profileName,
        currency: profile?.currency || 'AUD',
        locale: profile?.locale || 'en-AU',
        preferred_currency: profile?.currency || 'AUD'
      });
      setProfile(res.data);
      updateUser({ name: res.data.name, currency: res.data.currency, locale: res.data.locale });
      showToast('Profile updated', 'success');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) return <LoadingSpinner centered />;

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">User Profile</h2>
      <div className="form-group">
        <label>Email Address</label>
        <input type="email" className="form-control" value={profile?.email || ''} disabled autoComplete="username" />
      </div>
      <div className="form-group">
        <label>Full Name</label>
        <input type="text" className="form-control" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Enter your name" />
      </div>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={fetchProfile}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </section>
  );
}
