import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/ProfileService';
import { UserProfile, GlobalCurrency } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import SearchableSelect from '../../../components/SearchableSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { queryClient } from '../../../api/queryClient';
import { currenciesQuery, profileQuery, queryKeys } from '../../../api/queries';
import { AUTOMATIC_CURRENCY_OPTION, AUTOMATIC_LOCALE_OPTION, LOCALE_OPTIONS } from '../regionalOptions';
import { useTheme, ThemeMode } from '../../../context/ThemeContext';

const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow your operating system' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

export default function RegionalSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const { mode, setMode } = useTheme();
  const [profileCurrency, setProfileCurrency] = useState('');
  const [profileLocale, setProfileLocale] = useState('');
  const initializedProfileId = useRef<number | null>(null);
  const profileResult = useQuery(profileQuery());
  const currenciesResult = useQuery(currenciesQuery());
  const profile = profileResult.data ?? null;
  const globalCurrencies: GlobalCurrency[] = currenciesResult.data ?? [];
  const updateProfile = useMutation({
    mutationFn: ProfileService.updateProfile,
    onSuccess: (profile) => queryClient.setQueryData<UserProfile>(queryKeys.profile, profile),
  });

  useEffect(() => {
    if (!profile || initializedProfileId.current === profile.id) return;
    initializedProfileId.current = profile.id;
    setProfileCurrency(profile.currency || '');
    setProfileLocale(profile.locale || '');
  }, [profile]);

  const handleSaveRegional = async () => {
    try {
      const res = await updateProfile.mutateAsync({
        name: profile?.name || '', 
        currency: profileCurrency || null,
        locale: profileLocale || null,
      });
      updateUser({ name: res.name, currency: res.currency, locale: res.locale });
      showToast('Regional settings updated', 'success');
    } catch {
      showToast('Failed to update regional settings', 'error');
    }
  };

  if (profileResult.isLoading || currenciesResult.isLoading) return <LoadingSpinner centered />;
  if (profileResult.isError || currenciesResult.isError || !profile) return <div className="alert alert-error">Failed to load regional settings. <button className="btn btn-secondary btn-sm" onClick={() => { void profileResult.refetch(); void currenciesResult.refetch(); }}>Retry</button></div>;

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Regional Settings</h2>
      <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
        Configure your display currency and local date/number formats.
      </p>
      
      <div className="form-grid">
        <div className="form-group">
          <SearchableSelect
            label="Preferred Currency"
            options={[AUTOMATIC_CURRENCY_OPTION, ...globalCurrencies.map(gc => ({
              label: `${gc.iso} (${gc.symbol})`,
              value: gc.iso,
              subLabel: gc.currency_name
            }))]}
            value={profileCurrency}
            placeholder="Choose a currency"
            onChange={(val) => {
              setProfileCurrency(val);
              const match = globalCurrencies.find(gc => gc.iso === val);
              if (match) setProfileLocale(match.locale);
            }}
          />
        </div>
        <div className="form-group">
          <SearchableSelect
            label="Locale Format"
            options={[AUTOMATIC_LOCALE_OPTION, ...LOCALE_OPTIONS]}
            value={profileLocale}
            placeholder="Choose a locale"
            onChange={setProfileLocale}
          />
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={() => { setProfileCurrency(profile.currency || ''); setProfileLocale(profile.locale || ''); }}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveRegional} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving...' : 'Save Regional Settings'}
        </button>
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
    </section>
  );
}
