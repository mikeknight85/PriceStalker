import { useState } from 'react';
import { AdminSystemService } from '../services/AdminSystemService';
import { useToast } from '../../../context/ToastContext';
import Icon from '../../../components/Icon';

/**
 * Explains that a saved extraction change is not live yet, and offers to make it
 * live.
 *
 * The backend caches system settings and retailer configs for 30 minutes. An
 * administrator who edits a selector, re-scrapes and sees no change has no way
 * to tell whether the selector is wrong or simply not loaded yet -- so they
 * assume it is wrong and keep editing.
 *
 * The command behind the button already existed and was wired into System
 * settings and the debug page, but not into either screen where selectors are
 * actually edited.
 */
export default function SettingsCacheNotice({ compact = false }: { compact?: boolean }) {
  const { showToast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleApply = async () => {
    setIsClearing(true);
    try {
      await AdminSystemService.executeCommand('clear-settings-cache');
      setCleared(true);
      showToast('Extraction rules are now live', 'success');
    } catch {
      showToast('Could not refresh the settings cache', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        marginBottom: compact ? '1rem' : '1.5rem',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icon name="clock" size="1rem" />
        {cleared
          ? 'Caches cleared. The next scrape uses these rules.'
          : 'Saved changes reach a running scraper within 30 minutes.'}
      </span>
      {!cleared && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void handleApply()}
          disabled={isClearing}
        >
          {isClearing ? 'Applying...' : 'Apply now'}
        </button>
      )}
    </div>
  );
}
