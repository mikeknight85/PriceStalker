import React, { useState } from 'react';

interface ListManagerProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}

const ListManager: React.FC<ListManagerProps> = ({ 
  label, 
  items, 
  onChange, 
  placeholder 
}) => {
  const [inputValue, setInputValue] = useState('');
  
  const handleAdd = () => { 
    const val = inputValue.trim(); 
    if (val && !items.includes(val)) { 
      onChange([...items, val]); 
      setInputValue(''); 
    } 
  };

  const handleRemove = (index: number) => { 
    const newItems = [...items]; 
    newItems.splice(index, 1); 
    onChange(newItems); 
  };

  return (
    <div className="settings-form-group">
      <label>{label}</label>
      <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {items.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No items defined</span>}
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
              <span>{item}</span>
              <button 
                type="button"
                onClick={() => handleRemove(idx)} 
                style={{ marginLeft: '0.5rem', border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            className="form-control" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            placeholder={placeholder} 
            style={{ flex: 1, height: '32px', fontSize: '0.75rem' }} 
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} 
          />
          <button className="btn btn-secondary btn-sm" onClick={handleAdd} type="button" style={{ height: '32px' }}>Add</button>
        </div>
      </div>
    </div>
  );
};

export default ListManager;
