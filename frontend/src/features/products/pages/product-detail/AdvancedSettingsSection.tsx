import React from 'react';
import Icon from '../../../../components/Icon';

interface AdvancedSettingsSectionProps {
  isAdvancedCollapsed: boolean;
  setIsAdvancedCollapsed: (collapsed: boolean) => void;
  checkingPaused: boolean;
  setCheckingPaused: (val: boolean) => void;
  aiExtractionDisabled: boolean;
  setAiExtractionDisabled: (val: boolean) => void;
  aiVerificationDisabled: boolean;
  setAiVerificationDisabled: (val: boolean) => void;
  handleSaveNotifications: () => Promise<void>;
  isSavingNotifications: boolean;
}

const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  isAdvancedCollapsed,
  setIsAdvancedCollapsed,
  checkingPaused,
  setCheckingPaused,
  aiExtractionDisabled,
  setAiExtractionDisabled,
  aiVerificationDisabled,
  setAiVerificationDisabled,
  handleSaveNotifications,
  isSavingNotifications,
}) => {
  return (
    <div className="advanced-settings-card">
      <div className="advanced-settings-header" onClick={() => setIsAdvancedCollapsed(!isAdvancedCollapsed)}>
        <span className="advanced-settings-icon"><Icon name="settings" /></span>
        <h2 className="advanced-settings-title">Advanced Settings</h2>
        <svg 
          className={`collapse-icon ${!isAdvancedCollapsed ? 'open' : ''}`} 
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      <div className={`advanced-settings-content ${isAdvancedCollapsed ? 'collapsed' : 'expanded'}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="advanced-checkbox-group">
            <input type="checkbox" checked={checkingPaused} onChange={(e) => setCheckingPaused(e.target.checked)} />
            <span>Pause Tracking (Disable scheduled checks)</span>
          </label>
          <label className="advanced-checkbox-group">
            <input type="checkbox" checked={aiExtractionDisabled} onChange={(e) => setAiExtractionDisabled(e.target.checked)} />
            <span>Disable AI Extraction</span>
          </label>
          <label className="advanced-checkbox-group">
            <input type="checkbox" checked={aiVerificationDisabled} onChange={(e) => setAiVerificationDisabled(e.target.checked)} />
            <span>Disable AI Verification</span>
          </label>
        </div>
        <div className="advanced-settings-actions" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={handleSaveNotifications} disabled={isSavingNotifications}>Save Settings</button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsSection;
