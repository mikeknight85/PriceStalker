import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  SortOption,
  SortOrder,
  StockFilter,
  TrackingFilter,
  SORT_OPTIONS,
  STOCK_FILTER_OPTIONS,
  TRACKING_FILTER_OPTIONS,
} from './utils';
import Icon from '../../../../components/Icon';

interface DashboardControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Whether we are still checking the page -- nothing to do with stock (#246). */
  trackingFilter: TrackingFilter;
  onTrackingFilterChange: (filter: TrackingFilter) => void;
  /** Whether the retailer has it -- nothing to do with our schedule (#246). */
  stockFilter: StockFilter;
  onStockFilterChange: (filter: StockFilter) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  sortOrder: SortOrder;
  onSortOrderToggle: () => void;
  activeTag: string | null;
  tags: string[];
  onTagSelect: (tag: string | null) => void;
}

const DashboardControls: React.FC<DashboardControlsProps> = ({
  searchQuery,
  onSearchChange,
  trackingFilter,
  onTrackingFilterChange,
  stockFilter,
  onStockFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  activeTag,
  tags,
  onTagSelect,
}) => {
  return (
    <div className="dashboard-controls-wrapper">
      <div className="dashboard-controls">
        <div className="search-container" style={{ position: 'relative' }}>
          <span className="search-icon"><Icon name="search" /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingRight: searchQuery ? '2.5rem' : '1rem' }}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0 4px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="sort-controls">
          {/*
            Two dropdowns, not one, and each says which question it answers.
            The single "All Status" control filtered on whether we were still
            checking the page, which users read as stock (issue #246).
          */}
          <select
            className="filter-select"
            aria-label="Filter by tracking status"
            title="Whether PriceStalker is still checking the page"
            value={trackingFilter}
            onChange={(e) => onTrackingFilterChange(e.target.value as TrackingFilter)}
          >
            {TRACKING_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            aria-label="Filter by stock status"
            title="Whether the retailer has it in stock"
            value={stockFilter}
            onChange={(e) => onStockFilterChange(e.target.value as StockFilter)}
          >
            {STOCK_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="sort-select"
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className={`sort-order-btn ${sortOrder}`}
            onClick={onSortOrderToggle}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <Link className="add-product-link" to="/products/new">
          <Icon name="shoppingBag" />
          Add Product
        </Link>
      </div>

      <div className="tag-row-container">
        <div className="tag-row" role="group" aria-label="Filter by tag">
          <button
            className={`tag-filter-pill ${activeTag === null ? 'active' : ''}`}
            aria-pressed={activeTag === null}
            onClick={() => onTagSelect(null)}
          >
            All
          </button>
          {tags.sort().map((tag) => (
            <button
              key={tag}
              className={`tag-filter-pill ${activeTag === tag ? 'active' : ''}`}
              aria-pressed={activeTag === tag}
              onClick={() => onTagSelect(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardControls;
