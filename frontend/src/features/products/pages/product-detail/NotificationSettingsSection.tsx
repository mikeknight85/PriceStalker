import React from 'react';
import { NotificationSettings } from '../../../../types/api';
import Icon from '../../../../components/Icon';

interface NotificationSettingsSectionProps {
  notificationSettings: NotificationSettings | null;
  priceDropThreshold: string;
  setPriceDropThreshold: (val: string) => void;
  targetPrice: string;
  setTargetPrice: (val: string) => void;
  notifyBackInStock: boolean;
  setNotifyBackInStock: (val: boolean) => void;
  handleSaveNotifications: () => Promise<void>;
  isSavingNotifications: boolean;
}

const NotificationSettingsSection: React.FC<NotificationSettingsSectionProps> = ({
  notificationSettings,
  priceDropThreshold,
  setPriceDropThreshold,
  targetPrice,
  setTargetPrice,
  notifyBackInStock,
  setNotifyBackInStock,
  handleSaveNotifications,
  isSavingNotifications,
}) => {
  const isAnyNotificationChannelEnabled = (settings: NotificationSettings | null) => {
    if (!settings) return false;
    return (
      settings.telegram_enabled ||
      settings.discord_enabled ||
      settings.pushover_enabled ||
      settings.ntfy_enabled ||
      settings.gotify_enabled ||
      settings.email_enabled ||
      settings.webhook_enabled
    );
  };

  if (!isAnyNotificationChannelEnabled(notificationSettings)) return null;

  return (
    <div className="notification-settings-card">
      <div className="notification-settings-header">
        <span className="notification-settings-icon"><Icon name="bell" /></span>
        <h2 className="notification-settings-title">Notification Settings</h2>
      </div>
      <div className="notification-form-row">
        <div className="notification-form-group">
          <label>Price Drop Threshold</label>
          <input type="number" className="form-control" min="0" step="0.01" value={priceDropThreshold} onChange={(e) => setPriceDropThreshold(e.target.value)} placeholder="e.g. 5.00" />
        </div>
        <div className="notification-form-group">
          <label>Target Price</label>
          <input type="number" className="form-control" min="0" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="e.g. 49.99" />
        </div>
      </div>
      <div className="notification-form-row">
        <label className="notification-checkbox-group" style={{ gridColumn: 'span 2' }}>
          <input type="checkbox" checked={notifyBackInStock} onChange={(e) => setNotifyBackInStock(e.target.checked)} />
          <span>Enable back-in-stock notifications</span>
        </label>
      </div>
      <div className="notification-form-actions">
        <button className="btn btn-primary" onClick={handleSaveNotifications} disabled={isSavingNotifications}>Save Settings</button>
      </div>
    </div>
  );
};

export default NotificationSettingsSection;
