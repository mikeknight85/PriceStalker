import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/ProfileService';
import { UserProfile } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { queryClient } from '../../../api/queryClient';
import { profileQuery, queryKeys } from '../../../api/queries';

export default function ProfileSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const [profileName, setProfileName] = useState('');
  const profileResult = useQuery(profileQuery());
  const profile = profileResult.data ?? null;
  const updateProfile = useMutation({
    mutationFn: ProfileService.updateProfile,
    onSuccess: (profile) => queryClient.setQueryData<UserProfile>(queryKeys.profile, profile),
  });

  useEffect(() => {
    if (profile) setProfileName(profile.name || '');
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      const res = await updateProfile.mutateAsync({
        name: profileName,
        currency: profile?.currency || 'AUD',
        locale: profile?.locale || 'en-AU',
        preferred_currency: profile?.currency || 'AUD'
      });
      updateUser({ name: res.name, currency: res.currency, locale: res.locale });
      showToast('Profile updated', 'success');
    } catch {
      showToast('Failed to update profile', 'error');
    }
  };
  if (profileResult.isLoading) return <LoadingSpinner centered />;
  if (profileResult.isError || !profile) return <div className="alert alert-error">Failed to load profile. <button className="btn btn-secondary btn-sm" onClick={() => void profileResult.refetch()}>Retry</button></div>;

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
        <button className="btn btn-secondary" onClick={() => setProfileName(profile.name || '')}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </section>
  );
}
