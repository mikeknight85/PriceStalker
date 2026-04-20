import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi, NotificationHistoryEntry } from '../api/client';
import { formatPrice } from '../utils/formatPrice';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'price_drop':
      return '\u{1F4C9}'; // Chart decreasing
    case 'price_target':
      return '\u{1F3AF}'; // Target
    case 'stock_change':
      return '\u{1F4E6}'; // Package
    default:
      return '\u{1F514}'; // Bell
  }
}

function getNotificationTitle(notification: NotificationHistoryEntry): string {
  switch (notification.notification_type) {
    case 'price_drop':
      const percent = notification.price_change_percent
        ? `${Math.abs(notification.price_change_percent).toFixed(0)}%`
        : '';
      return `Price dropped ${percent}`;
    case 'price_target':
      return 'Target price reached';
    case 'stock_change':
      return 'Back in stock';
    default:
      return 'Notification';
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationHistoryEntry[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getRecent(5);
      setNotifications(response.data.notifications);
      setRecentCount(response.data.recentCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleOpen = async () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await notificationsApi.clear();
      setNotifications([]);
      setRecentCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <style>{`
        .notification-bell {
          position: relative;
        }

        .notification-bell-button {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.25rem;
          transition: all 0.2s;
          position: relative;
        }

        .notification-bell-button:hover {
          border-color: var(--primary);
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--danger);
          color: white;
          font-size: 0.625rem;
          font-weight: 600;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          width: 320px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          z-index: 1000;
        }

        .notification-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          font-weight: 600;
          font-size: 0.875rem;
        }

        .notification-dropdown-header svg {
          width: 18px;
          height: 18px;
        }

        .notification-clear-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          transition: all 0.2s;
        }

        .notification-clear-btn:hover {
          background: var(--background);
          color: var(--text);
        }

        .notification-list {
          max-height: 320px;
          overflow-y: auto;
        }

        .notification-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
          text-decoration: none;
          color: inherit;
        }

        .notification-item:last-child {
          border-bottom: none;
        }

        .notification-item:hover {
          background: var(--background);
          text-decoration: none;
        }

        .notification-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 2px;
        }

        .notification-product {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .notification-price {
          color: var(--success);
          font-weight: 500;
        }

        .notification-time {
          color: var(--text-muted);
        }

        .notification-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .notification-empty-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          opacity: 0.5;
        }

        .notification-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid var(--border);
          text-align: center;
        }

        .notification-footer a {
          color: var(--primary);
          font-size: 0.875rem;
          text-decoration: none;
          font-weight: 500;
        }

        .notification-footer a:hover {
          text-decoration: underline;
        }

        .notification-loading {
          padding: 1.5rem;
          text-align: center;
          color: var(--text-muted);
        }

        @media (max-width: 400px) {
          .notification-dropdown {
            width: calc(100vw - 2rem);
            right: -1rem;
          }
        }
      `}</style>

      <button
        className="notification-bell-button"
        onClick={handleOpen}
        title="Notifications"
      >
        {'\u{1F514}'}
        {recentCount > 0 && (
          <span className="notification-badge">
            {recentCount > 99 ? '99+' : recentCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notification-clear-btn" onClick={handleClear}>
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="notification-loading">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <div className="notification-empty-icon">{'\u{1F514}'}</div>
              <div>No notifications yet</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                You'll be notified when prices drop
              </div>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/product/${notification.product_id}`}
                  className="notification-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="notification-icon">
                    {getNotificationIcon(notification.notification_type)}
                  </span>
                  <div className="notification-content">
                    <div className="notification-title">
                      {getNotificationTitle(notification)}
                    </div>
                    <div className="notification-product">
                      {notification.product_name || 'Unknown Product'}
                    </div>
                    <div className="notification-meta">
                      {notification.new_price && (
                        <span className="notification-price">
                          {formatPrice(notification.new_price, notification.currency)}
                        </span>
                      )}
                      <span className="notification-time">
                        {formatTimeAgo(notification.triggered_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="notification-footer">
            <Link to="/notifications" onClick={() => setIsOpen(false)}>
              View All History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
