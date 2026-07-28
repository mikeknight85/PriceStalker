import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../../context/ToastContext';
import './NotificationBell.css';
import Icon from '../../../components/Icon';
import { queryClient } from '../../../api/queryClient';
import { queryKeys, recentNotificationsQuery } from '../../../api/queries';

export default function NotificationBell() {
  const { setDrawerOpen, showToast } = useToast();
  const lastCountRef = useRef(0);
  const recentQuery = useQuery(recentNotificationsQuery(1));
  const recentCount = recentQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    const refreshNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.recent(1) });
    };
    window.addEventListener('notifications-cleared', refreshNotifications);
    window.addEventListener('notification-read', refreshNotifications);

    return () => {
      window.removeEventListener('notifications-cleared', refreshNotifications);
      window.removeEventListener('notification-read', refreshNotifications);
    };
  }, []);

  useEffect(() => {
    if (recentCount > lastCountRef.current && lastCountRef.current !== 0) {
      showToast('New notification detected!', 'info', null, {
        label: 'VIEW',
        onClick: () => setDrawerOpen(true),
      });
    }
    lastCountRef.current = recentCount;
  }, [recentCount, setDrawerOpen, showToast]);

  return (
    <div className="notification-bell-wrapper">
      <button 
        className="notification-bell-button" 
        onClick={() => setDrawerOpen(true)}
        title="Notifications & Activity"
      >
        <Icon name="bell" />
        {recentCount > 0 && (
          <span className="notification-badge">
            {recentCount > 99 ? '99+' : recentCount}
          </span>
        )}
      </button>
    </div>
  );
}
