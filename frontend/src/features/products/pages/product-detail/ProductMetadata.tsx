import React from 'react';

interface ProductMetadataProps {
  product: any;
  isEditingCategory: boolean;
  setIsEditingCategory: (isEditing: boolean) => void;
  editCategories: string[];
  setEditCategories: (categories: string[]) => void;
  newCategoryInput: string;
  setNewCategoryInput: (input: string) => void;
  handleAddCategoryTag: (e?: React.KeyboardEvent | React.FocusEvent) => void;
  handleRemoveCategoryTag: (tag: string) => void;
  handleSaveCategory: () => Promise<void>;
  handleRefreshIntervalChange: (newInterval: number) => Promise<void>;
  availableCategories: string[];
  isSaving: boolean;
  REFRESH_INTERVALS: { value: number, label: string }[];
}

const ProductMetadata: React.FC<ProductMetadataProps> = ({
  product,
  isEditingCategory,
  setIsEditingCategory,
  editCategories,
  newCategoryInput,
  setNewCategoryInput,
  handleAddCategoryTag,
  handleRemoveCategoryTag,
  handleSaveCategory,
  handleRefreshIntervalChange,
  availableCategories,
  isSaving,
  REFRESH_INTERVALS,
}) => {
  return (
    <div className="product-detail-meta">
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Category</span>
        {isEditingCategory ? (
          <div className="category-tag-input-wrapper">
            <div className="category-tag-container">
              {editCategories.map(cat => (
                <span key={cat} className="category-tag-pill">
                  {cat}
                  <button 
                    className="remove-tag-btn" 
                    onClick={() => handleRemoveCategoryTag(cat)}
                    title={`Remove ${cat}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </span>
              ))}
              <input
                className="tag-input-field"
                list="existing-categories"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={handleAddCategoryTag}
                onBlur={() => handleAddCategoryTag()}
                placeholder={editCategories.length === 0 ? "e.g. Home, Tech" : "Add more..."}
                autoFocus
              />
            </div>
            <datalist id="existing-categories">
              {availableCategories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <span className="tag-input-hint">Press Enter or comma to add.</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveCategory} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingCategory(false)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="product-detail-meta-value">
              {product.category ? (
                product.category.split(',').map((cat: string, i: number) => (
                  <span key={i} className="category-badge">{cat.trim()}</span>
                ))
              ) : (
                'None'
              )}
            </div>
            <button className="edit-title-btn" onClick={() => setIsEditingCategory(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Last Checked</span>
        <span className="product-detail-meta-value">{product.last_checked ? new Date(product.last_checked).toLocaleString() : 'Never'}</span>
      </div>
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Check Interval</span>
        <select
          className="product-detail-meta-select"
          value={product.refresh_interval}
          onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value, 10))}
          disabled={isSaving}
        >
          {REFRESH_INTERVALS.map((interval) => (
            <option key={interval.value} value={interval.value}>{interval.label}</option>
          ))}
        </select>
      </div>
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Tracking Since</span>
        <span className="product-detail-meta-value">{new Date(product.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default ProductMetadata;
