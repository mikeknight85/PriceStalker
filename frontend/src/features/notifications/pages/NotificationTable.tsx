import React from 'react';
import { Link } from 'react-router-dom';
import { NotificationEntry } from '../../../types/api';
import { formatPrice } from '../../../utils/format';
import { formatDate, getNotificationIcon, getNotificationTypeLabel, getChannelIcon } from './utils';

interface NotificationTableProps {
  notifications: NotificationEntry[];
  loading: boolean;
  userLocale?: string;
}

const NotificationTable: React.FC<NotificationTableProps> = ({ notifications, loading, userLocale }) => {
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
          <div className="notifications-empty-icon">{'\u{1F514}'}</div>
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

        return (
          <div key={notification.id} className={`notification-row ${!notification.is_read ? 'unread' : ''}`}>
            <div className="notification-product">
              <span className={`notification-product-icon notification-icon-${notification.type}`}>
                {getNotificationIcon(notification.type)}
              </span>
              <div className="notification-product-info">
                <div className="notification-product-name">
                  {productId ? (
                    <Link to={`/?product=${productId}`}>
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
              ) : (
                <>
                  {targetPrice && (
                    <div className="notification-price-target">
                      Target: {formatPrice(targetPrice, currency, userLocale)}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="notification-channels">
              {channelsNotified.length > 0 ? (
                channelsNotified.map((channel: string) => (
                  <span key={channel} className="channel-badge" title={channel}>
                    {getChannelIcon(channel)}
                  </span>
                ))
              ) : (
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Internal Only</span>
              )}
            </div>

            <div className="notification-date">
              {formatDate(notification.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationTable;
