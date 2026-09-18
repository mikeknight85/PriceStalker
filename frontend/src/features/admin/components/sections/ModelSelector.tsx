import { useState, useEffect } from 'react';
import { AIModel } from '../../../../types/api';
import Icon from '../../../../components/Icon';

interface ModelSelectorProps {
  providerName: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  models: AIModel[];
  onSync: () => void | Promise<void>;
  isSyncing: boolean;
  canSync: boolean;
  syncDisabledTooltip?: string;
  customPlaceholder?: string;
}

export default function ModelSelector({
  providerName,
  label = 'Primary Model',
  value,
  onChange,
  models,
  onSync,
  isSyncing,
  canSync,
  syncDisabledTooltip = 'Enter credentials before syncing',
  customPlaceholder = 'Enter custom model identifier...',
}: ModelSelectorProps) {
  // Determine if the current value is not among the discovered models
  const isValueKnown = models.some(m => m.id === value);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isValueKnown && Boolean(value));

  // Keep custom mode in sync if value or models change externally
  useEffect(() => {
    if (value && !models.some(m => m.id === value)) {
      setIsCustomMode(true);
    }
  }, [value, models]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const selectValue = isCustomMode ? '__custom__' : (isValueKnown ? value : '');

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <label style={{ margin: 0 }}>{label}</label>
        {models.length > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {models.length} {models.length === 1 ? 'model' : 'models'} available
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          className="form-control"
          style={{ flex: 1 }}
          value={selectValue}
          onChange={handleSelectChange}
        >
          <option value="" disabled>Select a model...</option>
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
          <option value="__custom__">Custom / Other...</option>
        </select>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onSync}
          disabled={isSyncing || !canSync}
          title={!canSync ? syncDisabledTooltip : `Sync ${providerName} models from API`}
        >
          {isSyncing ? '...' : '↻ Sync'}
        </button>
      </div>

      {isCustomMode && (
        <div style={{ marginTop: '0.5rem' }}>
          <input
            type="text"
            className="form-control"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={customPlaceholder}
            autoFocus={!value}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
            Enter the exact model identifier accepted by {providerName}.
          </span>
        </div>
      )}

      {models.length === 0 && !isSyncing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.375rem',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          marginTop: '0.5rem'
        }}>
          <Icon name="alertTriangle" />
          <span>No cached models found. Enter credentials and click <strong>↻ Sync</strong> to fetch available models.</span>
        </div>
      )}
    </div>
  );
}
