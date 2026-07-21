import React from 'react';
import { Product } from '../../../../types/api';

interface CategorySidebarProps {
  activeCategory: string | null;
  categories: string[];
  products: Product[];
  onCategorySelect: (category: string | null) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ 
  activeCategory, 
  categories, 
  products, 
  onCategorySelect,
  isCollapsed,
  onToggle
}) => {
  return (
    <aside className={`category-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <h3 className="sidebar-title">Categories</h3>}
        <button className="sidebar-toggle" onClick={onToggle} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          {isCollapsed ? '➡️' : '⬅️'}
        </button>
      </div>

      <div className="sidebar-content">
        {!isCollapsed && (
          <>
            <button 
              className={`category-item ${activeCategory === null ? 'active' : ''}`}
              onClick={() => onCategorySelect(null)}
              title="All Products"
            >
              <span className="category-icon">📦</span>
              <span className="category-name">All Products</span>
              <span className="category-count">{products.length}</span>
            </button>

            {categories.sort().map(cat => {
              const count = products.filter(p => 
                p.category && p.category.split(',').map(c => c.trim()).includes(cat)
              ).length;

              return (
                <button 
                  key={cat}
                  className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => onCategorySelect(cat)}
                  title={cat}
                >
                  <span className="category-icon">🏷️</span>
                  <span className="category-name" title={cat}>{cat}</span>
                  <span className="category-count">{count}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
};

export default CategorySidebar;
