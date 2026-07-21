import { useState, useEffect, useRef } from 'react';
import { NotificationService } from '../services/NotificationService';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';
import './NotificationBell.css';

export default function NotificationBell() {
  const { setDrawerOpen, showToast } = useToast();
  const [recentCount, setRecentCount] = useState(0);
  const lastCountRef = useRef(0);

  useEffect(() => {
    fetchStatus();

    const handleUpdate = () => fetchStatus();
    window.addEventListener('notifications-cleared', handleUpdate);
    window.addEventListener('notification-read', handleUpdate);

    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-cleared', handleUpdate);
      window.removeEventListener('notification-read', handleUpdate);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await NotificationService.getRecent(1);
      const data = response.data;
      const newCount = data.unreadCount || 0;
      
      // If we have new unread high-priority alerts, show a toast
      if (newCount > lastCountRef.current && lastCountRef.current !== 0) {
        showToast('New notification detected!', 'info', null, {
          label: 'VIEW',
          onClick: () => setDrawerOpen(true)
        });
      }
      
      setRecentCount(newCount);
      lastCountRef.current = newCount;
    } catch (error) {
      logger.error('Failed to fetch notification status', 'Bell', error);
    }
  };

  return (
    <div className="notification-bell-wrapper">
      <button 
        className="notification-bell-button" 
        onClick={() => setDrawerOpen(true)}
        title="Notifications & Activity"
      >
        {'\u{1F514}'}
        {recentCount > 0 && (
          <span className="notification-badge">
            {recentCount > 99 ? '99+' : recentCount}
          </span>
        )}
      </button>
    </div>
  );
}
