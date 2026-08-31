import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../../auth';
import { useToast } from '../../../context/ToastContext';
import { formatPrice, formatRelativeDate } from '../../../utils/format';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './NotificationDrawer.css';
import { getNotificationIcon } from '../pages/utils';
import Icon from '../../../components/Icon';
import { queryClient } from '../../../api/queryClient';
import { recentNotificationsQuery } from '../../../api/queries';

/** Events where a product legitimately has no price yet. */
const STOCK_EVENTS = ['back_in_stock', 'not_available', 'product_restored', 'stock_alert', 'system_alert'];

const NotificationDrawer: React.FC = () => {
  const { user } = useAuth();
  const { isDrawerOpen, setDrawerOpen, activityLog, clearActivityLog } = useToast();
  const [activeTab, setActiveTab] = useState<'activity' | 'alerts'>('activity');
  const drawerRef = useRef<HTMLDivElement>(null);
  const recentQuery = useQuery({ ...recentNotificationsQuery(40), enabled: isDrawerOpen });
  const notifications = recentQuery.data?.notifications?.filter(n => !['session_activity', 'system_info'].includes(n.type)) ?? [];
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markAllRead = useMutation({ mutationFn: NotificationService.markAllAsRead, onSuccess: invalidateNotifications });
  const markRead = useMutation({ mutationFn: NotificationService.markAsRead, onSuccess: invalidateNotifications });

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

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch { /* the drawer remains usable; the next open can retry */ }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markRead.mutateAsync(id);
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
    } catch { /* the notification remains unread until a successful retry */ }
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
                        <span>{formatRelativeDate(item.timestamp.toISOString(), user?.locale)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            recentQuery.isError ? (
              // Checked before the empty state: a failed request used to render
              // "No alerts yet", which reads as "nothing happened" rather than
              // "we could not ask" (issue #93).
              <div className="drawer-empty">
                <div className="drawer-empty-icon"><Icon name="alertTriangle" /></div>
                <div style={{ fontWeight: 600 }}>Alerts could not be loaded</div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => recentQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : recentQuery.isLoading && notifications.length === 0 ? (
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
                        {newPrice ? (
                          <span className="drawer-item-price">{formatPrice(newPrice, currency, user?.locale)}</span>
                        ) : STOCK_EVENTS.includes(n.type) ? (
                          // A product can come back in stock before a price is
                          // extracted. Blank left it ambiguous whether the price
                          // was absent or had failed to load.
                          <span className="drawer-item-price drawer-item-price-absent">No price yet</span>
                        ) : null}
                        <span>{formatRelativeDate(n.created_at, user?.locale)}</span>
                      </div>
                    </div>
                  </div>
                );

                return productId ? (
                  <Link key={n.id} to="/products/$productId" params={{ productId: String(productId) }} className={`drawer-item ${!n.is_read ? 'unread' : ''}`} onClick={() => { handleMarkRead(n.id); setDrawerOpen(false); }}>
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
