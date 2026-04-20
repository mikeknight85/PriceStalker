import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { notificationsApi, NotificationHistoryEntry, NotificationType } from '../api/client';
import { formatPrice } from '../utils/formatPrice';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'price_drop':
      return '\u{1F4C9}';
    case 'price_target':
      return '\u{1F3AF}';
    case 'stock_change':
      return '\u{1F4E6}';
    default:
      return '\u{1F514}';
  }
}

function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'price_drop':
      return 'Price Drop';
    case 'price_target':
      return 'Target Reached';
    case 'stock_change':
      return 'Back in Stock';
    default:
      return 'Notification';
  }
}

function getChannelIcon(channel: string): string {
  switch (channel) {
    case 'telegram':
      return '\u{1F4AC}';
    case 'discord':
      return '\u{1F4AC}';
    case 'pushover':
      return '\u{1F4F1}';
    case 'ntfy':
      return '\u{1F4E2}';
    default:
      return '\u{1F4E8}';
  }
}

export default function NotificationHistory() {
  const [notifications, setNotifications] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.getHistory(page, 20);
      setNotifications(response.data.notifications);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => n.notification_type === filter);

  return (
    <Layout>
      <style>{`
        .notifications-page {
          max-width: 900px;
          margin: 0 auto;
        }

        .notifications-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .notifications-title {
          font-size: 1.5rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .notifications-filters {
          display: flex;
          gap: 0.5rem;
        }

        .filter-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: var(--primary);
        }

        .filter-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .notifications-table {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .notifications-table-header {
          display: grid;
          grid-template-columns: 1fr 120px 120px 100px 140px;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--background);
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .notification-row {
          display: grid;
          grid-template-columns: 1fr 120px 120px 100px 140px;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          align-items: center;
          transition: background 0.2s;
        }

        .notification-row:last-child {
          border-bottom: none;
        }

        .notification-row:hover {
          background: var(--background);
        }

        .notification-product {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .notification-product-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .notification-product-info {
          min-width: 0;
        }

        .notification-product-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .notification-product-name a {
          color: var(--text);
          text-decoration: none;
        }

        .notification-product-name a:hover {
          color: var(--primary);
        }

        .notification-type-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          background: var(--background);
          color: var(--text-muted);
          display: inline-block;
          margin-top: 0.25rem;
        }

        .notification-type-badge.price_drop {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success);
        }

        .notification-type-badge.price_target {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .notification-type-badge.stock_change {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
        }

        .notification-price {
          font-size: 0.875rem;
        }

        .notification-price-old {
          color: var(--text-muted);
          text-decoration: line-through;
          font-size: 0.75rem;
        }

        .notification-price-new {
          color: var(--success);
          font-weight: 500;
        }

        .notification-price-change {
          font-size: 0.75rem;
          color: var(--success);
        }

        .notification-channels {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
        }

        .channel-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          background: var(--background);
          border-radius: 0.25rem;
          text-transform: capitalize;
        }

        .notification-date {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .notifications-empty {
          padding: 3rem 1rem;
          text-align: center;
          color: var(--text-muted);
        }

        .notifications-empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .pagination {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
        }

        .pagination-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          border-color: var(--primary);
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-info {
          display: flex;
          align-items: center;
          padding: 0 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .notifications-table-header {
            display: none;
          }

          .notification-row {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 1rem;
          }

          .notification-product {
            width: 100%;
          }

          .notification-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            font-size: 0.875rem;
          }
        }
      `}</style>

      <div className="notifications-page">
        <div className="notifications-header">
          <h1 className="notifications-title">
            {'\u{1F514}'} Notification History
          </h1>

          <div className="notifications-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'price_drop' ? 'active' : ''}`}
              onClick={() => setFilter('price_drop')}
            >
              {'\u{1F4C9}'} Price Drops
            </button>
            <button
              className={`filter-btn ${filter === 'price_target' ? 'active' : ''}`}
              onClick={() => setFilter('price_target')}
            >
              {'\u{1F3AF}'} Targets
            </button>
            <button
              className={`filter-btn ${filter === 'stock_change' ? 'active' : ''}`}
              onClick={() => setFilter('stock_change')}
            >
              {'\u{1F4E6}'} Stock
            </button>
          </div>
        </div>

        <div className="notifications-table">
          <div className="notifications-table-header">
            <div>Product</div>
            <div>Price</div>
            <div>Change</div>
            <div>Channels</div>
            <div>Date</div>
          </div>

          {loading ? (
            <div className="notifications-empty">Loading...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="notifications-empty-icon">{'\u{1F514}'}</div>
              <div>No notifications yet</div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Notifications will appear here when price drops, targets are reached, or items come back in stock.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div key={notification.id} className="notification-row">
                <div className="notification-product">
                  <span className="notification-product-icon">
                    {getNotificationIcon(notification.notification_type)}
                  </span>
                  <div className="notification-product-info">
                    <div className="notification-product-name">
                      <Link to={`/product/${notification.product_id}`}>
                        {notification.product_name || 'Unknown Product'}
                      </Link>
                    </div>
                    <span className={`notification-type-badge ${notification.notification_type}`}>
                      {getNotificationTypeLabel(notification.notification_type)}
                    </span>
                  </div>
                </div>

                <div className="notification-price">
                  {notification.old_price && (
                    <div className="notification-price-old">
                      {formatPrice(notification.old_price, notification.currency)}
                    </div>
                  )}
                  <div className="notification-price-new">
                    {formatPrice(notification.new_price, notification.currency)}
                  </div>
                </div>

                <div>
                  {notification.price_change_percent && (
                    <span className="notification-price-change">
                      -{Math.abs(parseFloat(String(notification.price_change_percent))).toFixed(1)}%
                    </span>
                  )}
                  {notification.target_price && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Target: {formatPrice(notification.target_price, notification.currency)}
                    </span>
                  )}
                  {notification.notification_type === 'stock_change' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                      Now available
                    </span>
                  )}
                </div>

                <div className="notification-channels">
                  {(notification.channels_notified || []).map((channel) => (
                    <span key={channel} className="channel-badge">
                      {getChannelIcon(channel)} {channel}
                    </span>
                  ))}
                </div>

                <div className="notification-date">
                  {formatDate(notification.triggered_at)}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
