import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import {
  PRESET_ENGINES,
  DEFAULT_RECOMMENDED_ENGINES,
  parseSearXNGEngines,
  addSearXNGEngine,
  removeSearXNGEngine
} from './searxngEngines';

interface SearXNGEngineSelectorProps {
  value?: string;
  onChange: (value: string) => void;
}

export const SearXNGEngineSelector: React.FC<SearXNGEngineSelectorProps> = ({ value, onChange }) => {
  const [customInput, setCustomInput] = useState('');

  const engines = parseSearXNGEngines(value);
  const [mode, setMode] = useState<'system' | 'custom'>(() => (value && value.trim().length > 0 ? 'custom' : 'system'));

  useEffect(() => {
    if (value && value.trim().length > 0) {
      setMode('custom');
    }
  }, [value]);

  const isDefaultMode = mode === 'system';

  // Available suggestions: popular engines that have not been added yet
  const availableSuggestions = PRESET_ENGINES.filter(preset => !engines.includes(preset));

  const handleSelectDefaultMode = () => {
    setMode('system');
    onChange('');
  };

  const handleSelectCustomMode = () => {
    setMode('custom');
    if (engines.length === 0) {
      onChange(DEFAULT_RECOMMENDED_ENGINES);
    }
  };

  const handleAddEngine = (engine: string) => {
    onChange(addSearXNGEngine(value, engine));
  };

  const handleRemoveEngine = (engine: string) => {
    onChange(removeSearXNGEngine(value, engine));
  };

  const handleAddCustom = () => {
    if (!customInput.trim()) return;
    handleAddEngine(customInput);
    setCustomInput('');
  };

  return (
    <div className="form-group" style={{ marginTop: '1rem' }}>
      <label style={{ marginBottom: '0.35rem' }}>SearXNG Search Engines</label>
      <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
        Configure which search engines SearXNG queries for product discovery.
      </small>

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`btn btn-sm ${isDefaultMode ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '0.375rem' }}
          onClick={handleSelectDefaultMode}
        >
          Use SearXNG System Settings
        </button>
        <button
          type="button"
          className={`btn btn-sm ${!isDefaultMode ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '0.375rem' }}
          onClick={handleSelectCustomMode}
        >
          Custom Engine List
        </button>
      </div>

      {isDefaultMode ? (
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--background)',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            border: '1px solid var(--border)'
          }}
        >
          Queries SearXNG without specifying an <code>engines</code> parameter. SearXNG will use its own configured active engines from <code>settings.yml</code>.
        </div>
      ) : (
        <div>
          {/* Active Engines Tag Field */}
          <div
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              minHeight: '44px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}
          >
            {engines.map(engine => (
              <span
                key={engine}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text)'
                }}
              >
                <span>{engine}</span>
                <button
                  type="button"
                  aria-label={`Remove engine ${engine}`}
                  onClick={() => handleRemoveEngine(engine)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--danger)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <Icon name="x" size="0.75em" />
                </button>
              </span>
            ))}

            {/* Inline Custom Input */}
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder={engines.length === 0 ? 'Type engine name and press Enter...' : 'Add another engine...'}
              style={{
                flex: 1,
                minWidth: '160px',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '0.75rem',
                padding: '0.2rem 0.25rem'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              onBlur={() => {
                if (customInput.trim()) {
                  handleAddCustom();
                }
              }}
            />
          </div>

          {/* Quick-Add Suggestions (Only unadded engines) */}
          {availableSuggestions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                Quick Add:
              </span>
              {availableSuggestions.map(preset => (
                <button
                  key={preset}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.55rem',
                    height: 'auto',
                    borderRadius: '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onClick={() => handleAddEngine(preset)}
                >
                  <span>+</span>
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
