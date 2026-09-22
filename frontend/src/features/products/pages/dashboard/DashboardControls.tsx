import React from 'react';
import { Link } from '@tanstack/react-router';
import { SortOption, SortOrder, PauseFilter, SORT_OPTIONS } from './utils';
import Icon from '../../../../components/Icon';

interface DashboardControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pauseFilter: PauseFilter;
  onPauseFilterChange: (filter: PauseFilter) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  sortOrder: SortOrder;
  onSortOrderToggle: () => void;
  filteredCount: number;
  activeTag: string | null;
  tags: string[];
  onTagSelect: (tag: string | null) => void;
}

const DashboardControls: React.FC<DashboardControlsProps> = ({
  searchQuery,
  onSearchChange,
  pauseFilter,
  onPauseFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  filteredCount,
  activeTag,
  tags,
  onTagSelect,
}) => {
  return (
    <>
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
            <select
              className="filter-select"
              value={pauseFilter}
              onChange={(e) => onPauseFilterChange(e.target.value as PauseFilter)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
            <select
              className="sort-select"
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

      <div className="products-count" style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Showing {filteredCount} product{filteredCount !== 1 ? 's' : ''}
        {activeTag && ` tagged ${activeTag}`}
      </div>
    </>
  );
};

export default DashboardControls;
