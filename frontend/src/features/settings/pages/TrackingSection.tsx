import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/ProfileService';
import { UserProfile } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { queryClient } from '../../../api/queryClient';
import { productDefaultsQuery, profileQuery, queryKeys } from '../../../api/queries';
import {
  REFRESH_INTERVALS,
  describeRefreshInterval,
  type RefreshIntervalOption,
} from '../../../utils/refreshInterval';

/** The empty option: no preference, follow whatever the instance default is. */
const FOLLOW_INSTANCE_DEFAULT = '';

/**
 * This user's default check interval for new products (issue #239).
 *
 * The Add Product form opened on 12 hours and the field had to be changed on
 * every product, which is friction worth removing precisely when somebody is
 * adding a list of them after setup. This is the preference the form starts
 * from; the per-product interval on each store page still overrides it, and
 * nothing here touches a product that already exists.
 *
 * Left unset, new products follow the instance default an administrator set
 * under Admin -> System. The option says which interval that currently is,
 * because "follow the instance default" on its own tells a user nothing.
 */
export default function TrackingSection() {
  const { showToast } = useToast();
  const [preference, setPreference] = useState<string>(FOLLOW_INSTANCE_DEFAULT);
  const initializedProfileId = useRef<number | null>(null);
  const profileResult = useQuery(profileQuery());
  const defaultsResult = useQuery(productDefaultsQuery());
  const profile = profileResult.data ?? null;

  const updateProfile = useMutation({
    mutationFn: ProfileService.updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData<UserProfile>(queryKeys.profile, updated);
      // The Add Product form reads the resolved default, not the profile, so it
      // has to be told the answer changed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.productDefaults });
    },
  });

  const stored = profile?.default_refresh_interval ?? null;
  const savedValue = typeof stored === 'number' ? String(stored) : FOLLOW_INSTANCE_DEFAULT;

  useEffect(() => {
    if (!profile || initializedProfileId.current === profile.id) return;
    initializedProfileId.current = profile.id;
    setPreference(typeof profile.default_refresh_interval === 'number'
      ? String(profile.default_refresh_interval)
      : FOLLOW_INSTANCE_DEFAULT);
  }, [profile]);

  const isDirty = preference !== savedValue;

  // A value set through the API need not be one of the seven offered here, and
  // a select whose value matches no option renders blank. Show it as its own
  // option rather than silently losing it.
  const options: RefreshIntervalOption[] = typeof stored === 'number'
    && !REFRESH_INTERVALS.some(option => option.value === stored)
    ? [...REFRESH_INTERVALS, { value: stored, label: describeRefreshInterval(stored) }]
        .sort((a, b) => a.value - b.value)
    : REFRESH_INTERVALS;

  const instanceDefault = describeRefreshInterval(defaultsResult.data?.instance_refresh_interval);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        default_refresh_interval: preference === FOLLOW_INSTANCE_DEFAULT ? null : Number(preference),
      });
      showToast('Default check interval updated', 'success');
    } catch {
      showToast('Failed to update the default check interval', 'error');
    }
  };

  if (profileResult.isLoading) return <LoadingSpinner centered />;
  if (profileResult.isError || !profile) {
    return (
      <div className="alert alert-error">
        Failed to load tracking settings.{' '}
        <button className="btn btn-secondary btn-sm" onClick={() => { void profileResult.refetch(); }}>Retry</button>
      </div>
    );
  }

  return (
    <section className="settings-card">
      <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
        <h2 className="settings-card-title">Default Check Interval</h2>
        <p className="settings-card-description">
          How often a product you add is checked, before you change it. Each
          store keeps its own interval, so this only decides what the Add
          Product form starts at -- products you are already tracking are not
          affected.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="default-refresh-interval">Check Every</label>
            <select
              id="default-refresh-interval"
              className="form-control"
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
            >
              <option value={FOLLOW_INSTANCE_DEFAULT}>
                Follow the instance default ({instanceDefault})
              </option>
              {options.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPreference(savedValue)}
            disabled={!isDirty || updateProfile.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!isDirty || updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </section>
  );
}
