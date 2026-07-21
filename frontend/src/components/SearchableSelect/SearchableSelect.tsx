import React, { useState, useRef, useEffect } from 'react';

interface Option {
  label: string;
  value: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  label,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</label>}
      <div
        className={`searchable-select-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '0.625rem 0.875rem',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          background: 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '2.5rem',
          color: 'var(--text)'
        }}
      >
        <span style={{ color: selectedOption ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.5rem' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div
          className="searchable-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            maxHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <input
              type="text"
              autoFocus
              placeholder="Filter list..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem'
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`searchable-select-option ${opt.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '0.625rem 0.75rem',
                    cursor: 'pointer',
                    background: opt.value === value ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                    borderRadius: '0.25rem',
                    marginBottom: '2px',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent'}
                >
                  <div style={{ fontWeight: opt.value === value ? 600 : 500, color: opt.value === value ? 'var(--primary)' : 'var(--text)', fontSize: '0.9375rem' }}>{opt.label}</div>
                  {opt.subLabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.subLabel}</div>}
                </div>
              ))
            ) : (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
