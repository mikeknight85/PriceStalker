import { useState, useEffect } from 'react';
import { ProfileService } from '../services/ProfileService';
import { SharedService } from '../../../services/SharedService';
import { UserProfile, GlobalCurrency } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../auth';
import SearchableSelect from '../../../components/SearchableSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function RegionalSection() {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileCurrency, setProfileCurrency] = useState('AUD');
  const [profileLocale, setProfileLocale] = useState('en-AU');
  const [globalCurrencies, setGlobalCurrencies] = useState<GlobalCurrency[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, currenciesRes] = await Promise.all([
        ProfileService.getProfile(),
        SharedService.getCurrencies(),
      ]);
      setProfile(profileRes.data);
      setProfileCurrency(profileRes.data.currency || 'AUD');
      setProfileLocale(profileRes.data.locale || 'en-AU');
      setGlobalCurrencies(currenciesRes.data || []);
    } catch {
      showToast('Failed to load regional settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRegional = async () => {
    setIsSaving(true);
    try {
      const res = await ProfileService.updateProfile({ 
        name: profile?.name || '', 
        currency: profileCurrency, 
        locale: profileLocale, 
        preferred_currency: profileCurrency 
      });
      setProfile(res.data);
      updateUser({ name: res.data.name, currency: res.data.currency, locale: res.data.locale });
      showToast('Regional settings updated', 'success');
    } catch {
      showToast('Failed to update regional settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner centered />;

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
        <button className="btn btn-secondary" onClick={fetchData}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveRegional} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Regional Settings'}
        </button>
      </div>
    </section>
  );
}
