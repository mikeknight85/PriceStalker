import React from 'react';
import { Link } from '@tanstack/react-router';
import { NotificationEntry } from '../../../types/api';
import { formatPrice, formatDate } from '../../../utils/format';
import { getNotificationIcon, getNotificationTypeLabel, getChannelIcon } from './utils';
import Icon from '../../../components/Icon';
import { buildDetailChips } from './detailChips';

interface NotificationTableProps {
  notifications: NotificationEntry[];
  loading: boolean;
  userLocale?: string;
  /** Set when the history query failed, so a failure is not shown as "none". */
  error?: unknown;
  onRetry?: () => void;
  /** Marks one row read. The API has always supported it; only the drawer used it. */
  onMarkRead?: (id: number) => void;
  markingId?: number | null;
}

/** Renders the structured fields the backend records alongside an alert. */
const DetailChips: React.FC<{ data: unknown }> = ({ data }) => {
  const chips = buildDetailChips(data);
  if (chips.length === 0) return null;

  return (
    <div className="notification-detail-chips">
      {chips.map(chip => (
        <span key={chip.label} className="notification-detail-chip">
          <span className="notification-detail-chip-label">{chip.label}</span>
          {chip.value}
        </span>
      ))}
    </div>
  );
};

const NotificationTable: React.FC<NotificationTableProps> = ({ notifications, loading, userLocale, error, onRetry, onMarkRead, markingId }) => {
  // Checked before the empty state: a failed request used to fall through to
  // "No notifications found", which reads as "you have none" rather than
  // "we could not ask".
  if (error) {
    return (
      <div className="notifications-table">
        <div className="notifications-empty">
          <div className="notifications-empty-icon"><Icon name="alertTriangle" /></div>
          <div>Notifications could not be loaded.</div>
          {onRetry && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="notifications-table">
        <div className="notifications-empty">Loading...</div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="notifications-table">
        <div className="notifications-empty">
          <div className="notifications-empty-icon"><Icon name="bell" /></div>
          <div>No notifications found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-table">
      <div className="notifications-table-header">
        <div>Event</div>
        <div>Details</div>
        <div>Price/Change</div>
        <div>Channels</div>
        <div>Date</div>
      </div>

      {notifications.map((notification) => {
        const productId = notification.data?.productId || notification.data?.product_id;
        const productName = notification.data?.productName || notification.data?.product_name || notification.title;
        const oldPrice = notification.data?.oldPrice || notification.data?.old_price;
        const newPrice = notification.data?.newPrice || notification.data?.new_price;
        const targetPrice = notification.data?.targetPrice || notification.data?.target_price;
        const currency = notification.data?.currency;
        const priceChangePercent = notification.data?.priceChangePercent || notification.data?.price_change_percent;
        const channelsNotified = notification.data?.channelsNotified || notification.data?.channels_notified || [];
        // A notification is now recorded whether or not it was delivered, so
        // "no channels" and "every channel failed" are different rows and must
        // not both read as "Internal Only" (issue #92).
        const channelsFailed = notification.data?.channelsFailed || notification.data?.channels_failed || [];

        return (
          <div key={notification.id} className={`notification-row ${!notification.is_read ? 'unread' : ''}`}>
            <div className="notification-product">
              <span className={`notification-product-icon notification-icon-${notification.type}`}>
                {getNotificationIcon(notification.type)}
              </span>
              <div className="notification-product-info">
                <div className="notification-product-name">
                  {productId ? (
                    <Link to="/products/$productId" params={{ productId: String(productId) }}>
                      {productName || notification.title}
                    </Link>
                  ) : (
                    notification.title
                  )}
                </div>
                <span className={`notification-type-badge ${notification.type}`}>
                  {getNotificationTypeLabel(notification.type)}
                </span>
              </div>
            </div>

            <div className="notification-details-cell">
              <div className="notification-message-text">{notification.message}</div>
              {notification.data?.details && (
                <div className="notification-technical-details">
                  {typeof notification.data.details === 'string' 
                    ? notification.data.details 
                    : JSON.stringify(notification.data.details)}
                </div>
              )}
              <DetailChips data={notification.data} />
            </div>

            <div className="notification-price">
              {newPrice ? (
                <>
                  {oldPrice && (
                    <div className="notification-price-old">
                      {formatPrice(oldPrice, currency, userLocale)}
                    </div>
                  )}
                  <div className="notification-price-new">
                    {formatPrice(newPrice, currency, userLocale)}
                  </div>
                  {priceChangePercent && (
                    <span className="notification-price-change">
                      -{Math.abs(parseFloat(String(priceChangePercent))).toFixed(1)}%
                    </span>
                  )}
                </>
              ) : targetPrice ? (
                <div className="notification-price-target">
                  Target: {formatPrice(targetPrice, currency, userLocale)}
                </div>
              ) : (
                // A blank cell left three possibilities open: the event had no
                // price, the price failed to load, or the row was incomplete.
                // A product can genuinely come back in stock before a price is
                // extracted, so say that rather than showing nothing.
                <span className="notification-price-absent">Not available</span>
              )}
            </div>

            <div className="notification-channels">
              {channelsNotified.map((channel: string) => (
                <span key={channel} className="channel-badge" title={channel}>
                  <Icon name={getChannelIcon(channel)} />
                </span>
              ))}
              {channelsFailed.map((channel: string) => (
                <span
                  key={`failed-${channel}`}
                  className="channel-badge channel-badge-failed"
                  title={`${channel} delivery failed`}
                >
                  <Icon name={getChannelIcon(channel)} />
                </span>
              ))}
              {channelsNotified.length === 0 && channelsFailed.length === 0 && (
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Internal Only</span>
              )}
            </div>

            <div className="notification-date">
              {formatDate(notification.created_at, userLocale, true)}
              {onMarkRead && !notification.is_read && (
                <button
                  className="notification-mark-read"
                  onClick={() => onMarkRead(notification.id)}
                  disabled={markingId === notification.id}
                  title="Mark this notification read"
                >
                  {markingId === notification.id ? 'Marking...' : 'Mark read'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationTable;
