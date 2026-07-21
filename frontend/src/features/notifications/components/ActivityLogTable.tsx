import { formatDate, getNotificationIcon } from '../pages/utils';
import Icon from '../../../components/Icon';

interface ActivityLogItem {
  id: number;
  type: 'info' | 'success' | 'error';
  message: string;
  details?: any;
  timestamp: Date;
}

interface ActivityLogTableProps {
  activityLog: ActivityLogItem[];
}

export default function ActivityLogTable({ activityLog }: ActivityLogTableProps) {
  if (activityLog.length === 0) {
    return (
      <div className="notifications-empty">
        <div className="notifications-empty-icon"><Icon name="fileText" /></div>
        <div>No activity recorded in this session</div>
      </div>
    );
  }

  return (
    <div className="notifications-table">
      <div className="notifications-table-header">
        <div>Action</div>
        <div>Technical Details</div>
        <div>Status</div>
        <div></div>
        <div>Time</div>
      </div>
      
      {activityLog.map(item => (
        <div key={item.id} className="notification-row">
          <div className="notification-product">
            <span className={`notification-product-icon notification-icon-${item.type === 'info' ? 'session_activity' : (item.type === 'success' ? 'success' : 'system_error')}`}>
              {getNotificationIcon(item.type === 'info' ? 'session_activity' : (item.type === 'success' ? 'success' : 'system_error'))}
            </span>
            <div className="notification-product-info">
              <div className="notification-product-name">
                {item.type === 'error' ? 'System Error' : 'Manual Action'}
              </div>
              <span className={`notification-type-badge ${item.type === 'error' ? 'system_error' : 'session_activity'}`}>
                {item.type === 'info' ? 'Activity' : (item.type === 'error' ? 'Error' : 'Info')}
              </span>
            </div>
          </div>

          <div className="notification-details-cell">
            <div className="notification-message-text">{item.message}</div>
            {item.details && (
              <div className="notification-technical-details">
                {typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
              </div>
            )}
          </div>

          <div className="notification-price">
            <span className={`notification-type-badge ${item.type === 'error' ? 'system_error' : 'price_drop'}`}>
              {item.type === 'error' ? 'Failed' : 'Success'}
            </span>
          </div>

          <div className="notification-channels">
            {/* Empty column for alignment with alerts tab */}
          </div>

          <div className="notification-date">
            {formatDate(item.timestamp.toISOString())}
          </div>
        </div>
      ))}
    </div>
  );
}
