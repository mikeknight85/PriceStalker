import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/ProfileService';
import { UserProfile, GlobalCurrency } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import SearchableSelect from '../../../components/SearchableSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { queryClient } from '../../../api/queryClient';
import { currenciesQuery, profileQuery, queryKeys } from '../../../api/queries';

export default function RegionalSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const [profileCurrency, setProfileCurrency] = useState('AUD');
  const [profileLocale, setProfileLocale] = useState('en-AU');
  const profileResult = useQuery(profileQuery());
  const currenciesResult = useQuery(currenciesQuery());
  const profile = profileResult.data ?? null;
  const globalCurrencies: GlobalCurrency[] = currenciesResult.data ?? [];
  const updateProfile = useMutation({
    mutationFn: ProfileService.updateProfile,
    onSuccess: (profile) => queryClient.setQueryData<UserProfile>(queryKeys.profile, profile),
  });

  useEffect(() => {
    if (!profile) return;
    setProfileCurrency(profile.currency || 'AUD');
    setProfileLocale(profile.locale || 'en-AU');
  }, [profile]);

  const handleSaveRegional = async () => {
    try {
      const res = await updateProfile.mutateAsync({ 
        name: profile?.name || '', 
        currency: profileCurrency, 
        locale: profileLocale, 
        preferred_currency: profileCurrency 
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
            options={globalCurrencies.map(gc => ({
              label: `${gc.iso} (${gc.symbol})`,
              value: gc.iso,
              subLabel: gc.currency_name
            }))}
            value={profileCurrency}
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
            options={globalCurrencies.map(gc => ({
              label: gc.locale,
              value: gc.locale,
              subLabel: `${gc.country_territory} (${gc.iso})`
            }))}
            value={profileLocale}
            onChange={setProfileLocale}
          />
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={() => { setProfileCurrency(profile.currency || 'AUD'); setProfileLocale(profile.locale || 'en-AU'); }}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveRegional} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving...' : 'Save Regional Settings'}
        </button>
      </div>
    </section>
  );
}
