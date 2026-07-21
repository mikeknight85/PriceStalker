import React, { useState } from 'react';
import Icon from '../../../components/Icon';

/**
 * Normalizes a selector string into the standardized format.
 * Converts legacy "selector|attribute" into "selector::attr(attribute)".
 */
export function normalizeSelector(selector: string): string {
  if (!selector) return selector;
  const trimmed = selector.trim();
  if (trimmed.startsWith('~') && trimmed.endsWith('~')) return trimmed; // regex
  if (trimmed.startsWith('!')) return trimmed; // html

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    const attr = parts.pop();
    const base = parts.join('|');
    return `${base}::attr(${attr})`;
  }
  return trimmed;
}

interface UnifiedSelectorManagerProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}

const UnifiedSelectorManager: React.FC<UnifiedSelectorManagerProps> = ({ 
  label, 
  items, 
  onChange, 
  placeholder 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [type, setType] = useState<'css' | 'regex' | 'attr' | 'html'>('css');
  const [attrName, setAttrName] = useState('');
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    let finalValue = inputValue.trim();
    if (!finalValue) return;
    
    if (type === 'regex') {
      finalValue = `~${finalValue}~`;
    } else if (type === 'attr' && attrName.trim()) {
      finalValue = `${finalValue}::attr(${attrName.trim()})`;
    } else if (type === 'html') {
      finalValue = `!${finalValue}`;
    }
    
    finalValue = normalizeSelector(finalValue);
    
    if (finalValue && !items.includes(finalValue)) {
      onChange([...items, finalValue]);
      setInputValue('');
      setAttrName('');
    }
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  const startEditing = (index: number, value: string) => {
    setEditingIndex(index);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const finalValue = normalizeSelector(editValue.trim());
    if (finalValue) {
      const newItems = [...items];
      newItems[editingIndex] = finalValue;
      onChange(newItems);
    }
    setEditingIndex(null);
  };

  const getItemDisplay = (item: string) => {
    const stockModifierMatch = item.match(/^(.+?)(::attr\((.+?)\))?::(equals|contains)\(([\s\S]+?)\)->(.+)$/);
    if (stockModifierMatch) {
      const base = stockModifierMatch[1];
      const hasAttr = !!stockModifierMatch[2];
      const attr = stockModifierMatch[3] || '';
      const type = stockModifierMatch[4];
      const val = stockModifierMatch[5];
      const status = stockModifierMatch[6];
      
      const symbol = type === 'equals' ? '==' : '∋';
      const displayVal = hasAttr ? `${base} [${attr}] ${symbol} "${val}" → ${status}` : `${base} ${symbol} "${val}" → ${status}`;
      return { type: 'Stock', val: displayVal, color: '#10b981' };
    }

    if (item.startsWith('~') && item.endsWith('~')) return { type: 'Regex', val: item.slice(1, -1), color: '#ec4899' };
    if (item.startsWith('!')) return { type: 'HTML', val: item.slice(1), color: '#8b5cf6' };
    
    const scrapyAttrMatch = item.match(/^(.+?)::attr\((.+?)\)$/);
    if (scrapyAttrMatch) {
      return { type: 'Attr', val: `${scrapyAttrMatch[1]} [${scrapyAttrMatch[2]}]`, color: '#f59e0b' };
    }

    if (item.includes('|')) {
      const parts = item.split('|');
      const attr = parts.pop();
      return { type: 'Attr', val: `${parts.join('|')} [${attr}]`, color: '#f59e0b' };
    }
    return { type: 'CSS', val: item, color: 'var(--primary)' };
  };

  return (
    <div className="settings-form-group">
      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
        {label}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{items.length} items</span>
      </label>
      <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
          {items.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No selectors defined</span>
            </div>
          )}
          {items.map((item, idx) => {
            const d = getItemDisplay(item);
            const isEditing = editingIndex === idx;

            return (
              <div key={idx} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                background: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: '0.5rem', 
                padding: '0.5rem',
                transition: 'border-color 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button type="button" disabled={idx === 0} onClick={() => moveItem(idx, 'up')} className="mini-arrow-btn">▲</button>
                    <button type="button" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 'down')} className="mini-arrow-btn">▼</button>
                  </div>
                  
                  <span style={{ 
                    fontWeight: 700, 
                    color: d.color, 
                    fontSize: '0.6rem', 
                    textTransform: 'uppercase',
                    background: `${d.color}15`,
                    padding: '0.1rem 0.3rem',
                    borderRadius: '0.25rem',
                    minWidth: '45px',
                    textAlign: 'center'
                  }}>{d.type}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="form-control"
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        style={{ width: '100%', height: '28px', fontSize: '0.75rem', padding: '0 0.4rem' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingIndex(null); }}
                      />
                    ) : (
                      <div 
                        style={{ 
                          fontSize: '0.75rem', 
                          wordBreak: 'break-all', 
                          cursor: 'pointer',
                          fontFamily: 'monospace'
                        }}
                        onClick={() => startEditing(idx, item)}
                        title="Click to edit"
                      >
                        {d.val}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {isEditing ? (
                      <>
                        <button type="button" onClick={saveEdit} className="mini-action-btn success"><Icon name="check" /></button>
                        <button type="button" onClick={() => setEditingIndex(null)} className="mini-action-btn"><Icon name="x" /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEditing(idx, item)} className="mini-action-btn"><Icon name="edit" /></button>
                        <button type="button" onClick={() => handleRemove(idx)} className="mini-action-btn danger">×</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="selector-add-box" style={{ 
          background: 'var(--surface)', 
          padding: '0.75rem', 
          borderRadius: '0.5rem', 
          border: '1px solid var(--border)',
          marginTop: '0.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <select 
              className="form-control"
              value={type} 
              onChange={e => setType(e.target.value as any)} 
              style={{ height: '32px', fontSize: '0.7rem', padding: '0 0.5rem', flex: '1 1 120px' }}
            >
              <option value="css">CSS Selector</option>
              <option value="attr">Attribute</option>
              <option value="regex">Regex (~)</option>
              <option value="html">Raw HTML (!)</option>
            </select>
            <div style={{ flex: '1 1 200px', display: 'flex', gap: '0.25rem', minWidth: 0 }}>
              <input 
                type="text" 
                className="form-control"
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                placeholder={type === 'regex' ? 'Price: ([0-9.]+)' : placeholder} 
                style={{ flex: 1, height: '32px', fontSize: '0.75rem', minWidth: 0 }} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              />
              {type === 'attr' && (
                <input 
                  type="text" 
                  className="form-control"
                  value={attrName} 
                  onChange={e => setAttrName(e.target.value)} 
                  placeholder="attribute" 
                  style={{ width: '80px', height: '32px', fontSize: '0.75rem' }} 
                />
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleAdd} type="button" style={{ height: '32px', padding: '0 1rem', flex: '1 1 auto' }}>Add</button>
          </div>
        </div>
      </div>

      <style>{`
        .mini-arrow-btn { 
          padding: 0; border: none; background: none; color: var(--text-muted); 
          font-size: 0.6rem; cursor: pointer; height: 12px; line-height: 1; 
        }
        .mini-arrow-btn:hover:not(:disabled) { color: var(--primary); }
        .mini-arrow-btn:disabled { opacity: 0.2; cursor: default; }
        
        .mini-action-btn {
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); background: var(--background); border-radius: 4px;
          font-size: 0.8rem; cursor: pointer; color: var(--text-muted); transition: all 0.2s;
        }
        .mini-action-btn:hover { background: var(--border); color: var(--text); }
        .mini-action-btn.danger:hover { background: var(--danger); color: white; border-color: var(--danger); }
        .mini-action-btn.success { color: var(--success); }
        .mini-action-btn.success:hover { background: var(--success); color: white; border-color: var(--success); }
      `}</style>
    </div>
  );
};

export default UnifiedSelectorManager;
