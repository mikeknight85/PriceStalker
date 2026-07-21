import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { NotificationService } from '../services/NotificationService';
import { NotificationEntry } from '../../../types/api';
import { useAuth } from '../../auth';
import { useToast } from '../../../context/ToastContext';
import { formatPrice, formatRelativeDate } from '../../../utils/format';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { logger } from '../../../utils/logger';
import './NotificationDrawer.css';
import { getNotificationIcon } from '../pages/utils';
import Icon from '../../../components/Icon';

const NotificationDrawer: React.FC = () => {
  const { user } = useAuth();
  const { isDrawerOpen, setDrawerOpen, activityLog, clearActivityLog } = useToast();
  const [activeTab, setActiveTab] = useState<'activity' | 'alerts'>('activity');
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDrawerOpen) {
      fetchAlerts();
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    if (isDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen, setDrawerOpen]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await NotificationService.getRecent(40);
      // Alerts are only price/stock/system events
      setNotifications(response.data.notifications?.filter(n => !['session_activity', 'system_info'].includes(n.type)) || []);
    } catch (error) {
      logger.error('Failed to fetch alerts', 'Drawer', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch (error) {
      logger.error('Failed to clear alerts', 'Drawer', error);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await NotificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
    } catch (error) {
      logger.error('Failed to mark alert as read', 'Drawer', error);
    }
  };

  if (!isDrawerOpen) return null;

  return (
    <div className="drawer-overlay">
      <div className="drawer-content" ref={drawerRef}>
        <div className="drawer-header">
          <h2 className="drawer-title">Activity & Alerts</h2>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>&times;</button>
        </div>

        <div className="drawer-tabs">
          <button className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>
            Activity
          </button>
          <button className={`drawer-tab ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
            Alerts
          </button>
        </div>

        <div className="drawer-body">
          {activeTab === 'activity' ? (
            activityLog.length === 0 ? (
              <div className="drawer-empty">
                <div className="drawer-empty-icon"><Icon name="fileText" /></div>
                <div style={{ fontWeight: 600 }}>No activity this session</div>
              </div>
            ) : (
              activityLog.map(item => (
                <div key={item.id} className="drawer-item no-link activity">
                  <div className="drawer-item-inner">
                    <div className={`drawer-icon drawer-icon-${item.type === 'info' ? 'session_activity' : (item.type === 'success' ? 'success' : 'system_error')}`}>
                      {getNotificationIcon(
                        item.type === 'info'
                          ? 'session_activity'
                          : item.type === 'success'
                          ? 'success'
                          : 'system_error'
                      )}
                    </div>
                    <div className="drawer-item-content">
                      <div className="drawer-item-title">{item.message}</div>
                      <div className="drawer-item-meta">
                        <span>{formatRelativeDate(item.timestamp.toISOString())}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            loading && notifications.length === 0 ? (
              <div className="drawer-empty"><LoadingSpinner size="1.5rem" centered /></div>
            ) : notifications.length === 0 ? (
              <div className="drawer-empty">
                <div className="drawer-empty-icon"><Icon name="bell" /></div>
                <div style={{ fontWeight: 600 }}>No alerts yet</div>
              </div>
            ) : (
              notifications.map(n => {
                const productId = n.data?.productId || n.data?.product_id;
                const productName = n.data?.productName || n.data?.product_name || n.title;
                const newPrice = n.data?.newPrice || n.data?.new_price;
                const currency = n.data?.currency;
                
                const content = (
                  <div className="drawer-item-inner">
                    <div className={`drawer-icon drawer-icon-${n.type}`}>{getNotificationIcon(n.type)}</div>
                    <div className="drawer-item-content">
                      <div className="drawer-item-title">
                        {n.type === 'system_alert' ? n.title : productName}
                        {!n.is_read && <span className="unread-dot" />}
                      </div>
                      <div className="drawer-item-message">{n.message}</div>
                      <div className="drawer-item-meta">
                        {newPrice && <span className="drawer-item-price">{formatPrice(newPrice, currency, user?.locale)}</span>}
                        <span>{formatRelativeDate(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );

                return productId ? (
                  <Link key={n.id} to={`/?product=${productId}`} className={`drawer-item ${!n.is_read ? 'unread' : ''}`} onClick={() => { handleMarkRead(n.id); setDrawerOpen(false); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} className={`drawer-item no-link ${!n.is_read ? 'unread' : ''}`} onClick={() => handleMarkRead(n.id)}>
                    {content}
                  </div>
                );
              })
            )
          )}
        </div>

        <div className="drawer-footer">
          {activeTab === 'activity' ? (
            <button className="btn btn-secondary btn-sm" onClick={clearActivityLog}>Clear session</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>Mark all read</button>
          )}
          <Link to="/notifications" className="btn btn-primary btn-sm" onClick={() => setDrawerOpen(false)}>History</Link>
        </div>
      </div>
    </div>
  );
};

export default NotificationDrawer;
