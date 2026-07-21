import React from 'react';

interface NotificationFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
}

const NotificationFilters: React.FC<NotificationFiltersProps> = ({ filter, setFilter }) => {
  return (
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
        {'\u{1F4C9}'} Drops
      </button>
      <button
        className={`filter-btn ${filter === 'target_price' ? 'active' : ''}`}
        onClick={() => setFilter('target_price')}
      >
        {'\u{1F3AF}'} Targets
      </button>
      <button
        className={`filter-btn ${filter === 'stock_alert' ? 'active' : ''}`}
        onClick={() => setFilter('stock_alert')}
      >
        {'\u{1F4E6}'} Stock
      </button>
    </div>
  );
};

export default NotificationFilters;
