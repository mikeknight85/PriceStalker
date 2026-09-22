import React from 'react';
import { Product } from '../../../../types/api';
import Icon from '../../../../components/Icon';

interface TagSidebarProps {
  activeTag: string | null;
  tags: string[];
  products: Product[];
  onTagSelect: (tag: string | null) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const TagSidebar: React.FC<TagSidebarProps> = ({
  activeTag,
  tags,
  products,
  onTagSelect,
  isCollapsed,
  onToggle
}) => {
  return (
    <aside className={`tag-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <h3 className="sidebar-title">Tags</h3>}
        <button className="sidebar-toggle" onClick={onToggle} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          {isCollapsed ? <Icon name="chevronRight" /> : <Icon name="chevronLeft" />}
        </button>
      </div>

      <div className="sidebar-content">
        {!isCollapsed && (
          <>
            <button
              className={`tag-item ${activeTag === null ? 'active' : ''}`}
              onClick={() => onTagSelect(null)}
              title="All Products"
            >
              <span className="tag-icon"><Icon name="package" /></span>
              <span className="tag-name">All Products</span>
              <span className="tag-count">{products.length}</span>
            </button>

            {tags.sort().map(tag => {
              // `p.category` is the wire field for what the UI calls a tag (#147).
              const count = products.filter(p =>
                p.category && p.category.split(',').map(c => c.trim()).includes(tag)
              ).length;

              return (
                <button
                  key={tag}
                  className={`tag-item ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => onTagSelect(tag)}
                  title={tag}
                >
                  <span className="tag-icon"><Icon name="tag" /></span>
                  <span className="tag-name" title={tag}>{tag}</span>
                  <span className="tag-count">{count}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
};

export default TagSidebar;
