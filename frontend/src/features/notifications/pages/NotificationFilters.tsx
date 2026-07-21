import React from 'react';
import Icon from '../../../components/Icon';

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
        <Icon name="trendingDown" /> Drops
      </button>
      <button
        className={`filter-btn ${filter === 'target_price' ? 'active' : ''}`}
        onClick={() => setFilter('target_price')}
      >
        <Icon name="target" /> Targets
      </button>
      <button
        className={`filter-btn ${filter === 'stock_alert' ? 'active' : ''}`}
        onClick={() => setFilter('stock_alert')}
      >
        <Icon name="package" /> Stock
      </button>
    </div>
  );
};

export default NotificationFilters;
