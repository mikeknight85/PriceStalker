import React from 'react';

interface ToggleSwitchProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  active, 
  onToggle, 
  disabled 
}) => (
  <button 
    type="button" 
    onClick={() => !disabled && onToggle()}
    className={`toggle-switch ${active ? 'active' : ''}`}
    style={{ 
      position: 'relative', width: '44px', height: '24px', background: active ? 'var(--primary)' : 'var(--border)', 
      borderRadius: '12px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: disabled ? 0.6 : 1 
    }}
  >
    <div style={{ 
      position: 'absolute', top: '2px', left: active ? '22px' : '2px', width: '20px', height: '20px', 
      background: 'white', borderRadius: '50%', transition: 'left 0.2s' 
    }} />
  </button>
);

export default ToggleSwitch;
