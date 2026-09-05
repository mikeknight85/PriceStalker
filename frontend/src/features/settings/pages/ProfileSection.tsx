import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/ProfileService';
import { UserProfile } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { queryClient } from '../../../api/queryClient';
import { profileQuery, queryKeys } from '../../../api/queries';
import { useTheme, ThemeMode } from '../../../context/ThemeContext';

const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow your operating system' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

export default function ProfileSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const { mode, setMode } = useTheme();
  const [profileName, setProfileName] = useState('');
  const initializedProfileId = useRef<number | null>(null);
  const profileResult = useQuery(profileQuery());
  const profile = profileResult.data ?? null;
  const updateProfile = useMutation({
    mutationFn: ProfileService.updateProfile,
    onSuccess: (profile) => queryClient.setQueryData<UserProfile>(queryKeys.profile, profile),
  });

  useEffect(() => {
    if (!profile || initializedProfileId.current === profile.id) return;
    initializedProfileId.current = profile.id;
    setProfileName(profile.name || '');
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      const res = await updateProfile.mutateAsync({
        name: profileName,
        currency: profile?.currency ?? null,
        locale: profile?.locale ?? null,
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

      <h2 className="settings-card-title" style={{ marginTop: '2rem' }}>Appearance</h2>
      <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
        Choose a color theme, or let it follow your operating system. Applied
        immediately on this device.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {THEME_MODES.map(t => (
          <button
            key={t.value}
            className={`btn btn-sm ${mode === t.value ? 'btn-primary' : 'btn-secondary'}`}
            title={t.hint}
            onClick={() => setMode(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-actions" style={{ marginTop: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => setProfileName(profile.name || '')}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </section>
  );
}
