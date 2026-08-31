import React from 'react';
import Icon, { type IconName } from '../../../components/Icon';

interface NotificationFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  /** Total matching the active filter, from the server. */
  resultCount?: number;
}

/**
 * Filters for the notification history.
 *
 * Grouped by what a person is looking for rather than one button per event
 * type. Someone chasing an availability problem wants unavailable, restored and
 * back-in-stock together, and should not have to know which internal code
 * produced which row.
 *
 * These are applied by the server, not against the page already loaded. The
 * previous filters searched the most recent 50 notifications only, so an empty
 * result read as "you have none" when it meant "none in the last 50".
 */
const FILTERS: { value: string; label: string; icon?: IconName }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread', icon: 'bell' },
  { value: 'price', label: 'Price', icon: 'trendingDown' },
  { value: 'availability', label: 'Availability', icon: 'package' },
];

const NotificationFilters: React.FC<NotificationFiltersProps> = ({ filter, setFilter, resultCount }) => {
  return (
    <div className="notifications-filters" role="group" aria-label="Filter notifications">
      {FILTERS.map(f => (
        <button
          key={f.value}
          className={`filter-btn ${filter === f.value ? 'active' : ''}`}
          onClick={() => setFilter(f.value)}
          aria-pressed={filter === f.value}
        >
          {f.icon && <Icon name={f.icon} />} {f.label}
        </button>
      ))}
      {resultCount !== undefined && (
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {resultCount} {resultCount === 1 ? 'notification' : 'notifications'}
        </span>
      )}
    </div>
  );
};

export default NotificationFilters;
