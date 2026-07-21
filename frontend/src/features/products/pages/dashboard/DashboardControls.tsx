import React from 'react';
import { SortOption, SortOrder, PauseFilter, SORT_OPTIONS } from './utils';

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
  activeCategory: string | null;
  categories: string[];
  onCategorySelect: (category: string | null) => void;
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
  activeCategory,
  categories,
  onCategorySelect,
}) => {
  return (
    <>
      <div className="dashboard-controls-wrapper">
        <div className="dashboard-controls">
          <div className="search-container" style={{ position: 'relative' }}>
            <span className="search-icon">🔍</span>
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
        </div>

        <div className="category-row-container">
          <div className="category-row">
            <button
              className={`category-pill ${activeCategory === null ? 'active' : ''}`}
              onClick={() => onCategorySelect(null)}
            >
              All
            </button>
            {categories.sort().map((cat) => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => onCategorySelect(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="products-count" style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Showing {filteredCount} product{filteredCount !== 1 ? 's' : ''}
        {activeCategory && ` in ${activeCategory}`}
      </div>
    </>
  );
};

export default DashboardControls;
