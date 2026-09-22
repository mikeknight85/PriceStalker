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
import { useLayoutMode, LayoutMode } from '../../../context/LayoutContext';

const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow your operating system' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

const LAYOUT_MODES: { value: LayoutMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Choose the layout from the window width' },
  { value: 'desktop', label: 'Desktop', hint: 'Always use the desktop layout, whatever the width' },
  { value: 'mobile', label: 'Mobile', hint: 'Always use the compact layout, whatever the width' },
];

export default function ProfileSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const { mode, setMode } = useTheme();
  const { mode: layoutMode, setMode: setLayoutMode } = useLayoutMode();
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

  const isDirty = profile ? profileName !== (profile.name || '') : false;

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
      <form onSubmit={(e) => { e.preventDefault(); void handleSaveProfile(); }}>
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
        <p className="settings-card-description">
          Choose a color theme, or let it follow your operating system. Applied
          immediately on this device.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {THEME_MODES.map(t => (
            <button
              key={t.value}
              type="button"
              className={`btn btn-sm ${mode === t.value ? 'btn-primary' : 'btn-secondary'}`}
              title={t.hint}
              onClick={() => setMode(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h2 className="settings-card-title" style={{ marginTop: '2rem' }}>Layout</h2>
        <p className="settings-card-description">
          Normally the layout follows the width of the window. Some tablets report
          a narrow width even with the browser set to request the desktop site,
          which leaves them on the compact layout; choose Desktop here to override
          that. A forced desktop layout scrolls sideways on a narrow screen.
          Applied immediately on this device.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {LAYOUT_MODES.map(l => (
            <button
              key={l.value}
              type="button"
              className={`btn btn-sm ${layoutMode === l.value ? 'btn-primary' : 'btn-secondary'}`}
              title={l.hint}
              aria-pressed={layoutMode === l.value}
              onClick={() => setLayoutMode(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="settings-actions" style={{ marginTop: '2rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setProfileName(profile.name || '')} disabled={!isDirty || updateProfile.isPending}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!isDirty || updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
