import React, { useState } from 'react';
import { ItemWithListings } from '../../../../../types/api';
import { formatPrice } from '../../../../../utils/format';
import Icon from '../../../../../components/Icon';

interface ItemOverviewSidebarProps {
  item: ItemWithListings;
  userLocale?: string | null;
  currency: string;
  inStockCount: number;
  onSaveImage: (imageUrl: string | null) => Promise<void>;
  onSaveTags: (tags: string[]) => Promise<void>;
}

export const ItemOverviewSidebar: React.FC<ItemOverviewSidebarProps> = ({
  item,
  userLocale,
  currency,
  inStockCount,
  onSaveImage,
  onSaveTags,
}) => {
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState(item.image_url || '');
  const [isSavingImage, setIsSavingImage] = useState(false);

  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(
    item.category ? item.category.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [isSavingTags, setIsSavingTags] = useState(false);

  const handleImageSave = async () => {
    setIsSavingImage(true);
    try {
      await onSaveImage(imageUrlInput.trim() || null);
      setIsEditingImage(false);
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleTagAdd = () => {
    const val = tagInput.trim();
    if (!val) return;
    if (!tags.includes(val)) {
      setTags([...tags, val]);
    }
    setTagInput('');
  };

  const handleTagRemove = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagsSave = async () => {
    setIsSavingTags(true);
    try {
      await onSaveTags(tags);
      setIsEditingTags(false);
    } finally {
      setIsSavingTags(false);
    }
  };

  return (
    <div className="item-overview-sidebar">
      {/* Product Image Panel */}
      <div className="item-card-panel">
        <div className="item-image-preview-container">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="item-image-preview" />
          ) : (
            <div className="item-image-empty-state">
              <Icon name="package" size="3.5rem" />
            </div>
          )}

          {isEditingImage ? (
            <div style={{ width: '100%', marginTop: '0.5rem' }}>
              <input
                type="url"
                className="form-control"
                placeholder="https://example.com/image.jpg"
                value={imageUrlInput}
                onChange={e => setImageUrlInput(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingImage(false)}
                  disabled={isSavingImage}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleImageSave}
                  disabled={isSavingImage}
                >
                  {isSavingImage ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setImageUrlInput(item.image_url || '');
                setIsEditingImage(true);
              }}
              style={{ fontSize: '0.8rem' }}
            >
              <Icon name="image" /> Edit Image
            </button>
          )}
        </div>
      </div>

      {/* Price Aggregates Panel */}
      <div className="item-card-panel">
        <div className="item-aggregates-title">Price Summary</div>

        <div className="item-aggregate-hero">
          <div className="item-aggregate-hero-label">Current Lowest Price</div>
          <div className="item-aggregate-hero-value">
            {item.best_price !== null ? formatPrice(item.best_price, currency, userLocale) : '—'}
          </div>
        </div>

        <div className="item-aggregate-stats-list">
          <div className="item-aggregate-row">
            <span className="item-aggregate-row-label">Tracked Stores:</span>
            <span className="item-aggregate-row-value">{item.store_count}</span>
          </div>

          <div className="item-aggregate-row">
            <span className="item-aggregate-row-label">In Stock:</span>
            <span className="item-aggregate-row-value">
              {inStockCount} of {item.store_count}
            </span>
          </div>

          {item.price_spread !== null && item.price_spread > 0 && (
            <div className="item-aggregate-row">
              <span className="item-aggregate-row-label">Price Spread:</span>
              <span className="item-aggregate-row-value">
                {formatPrice(item.price_spread, currency, userLocale)}
              </span>
            </div>
          )}
        </div>

        {item.price_spread !== null && item.price_spread > 0 && (
          <div className="item-savings-callout">
            <Icon name="trendingDown" />
            Save up to {formatPrice(item.price_spread, currency, userLocale)} by choosing the cheapest store
          </div>
        )}

        {item.target_price !== null && item.target_price !== undefined && (
          <div className={`item-target-callout ${item.best_price !== null && item.best_price <= item.target_price ? 'hit' : 'waiting'}`}>
            <Icon name="target" />
            {item.best_price !== null && item.best_price <= item.target_price
              ? `Target matched! Under target of ${formatPrice(item.target_price, currency, userLocale)}`
              : `Target: ${formatPrice(item.target_price, currency, userLocale)}`}
          </div>
        )}

        {item.excluded_count > 0 && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Icon name="alertTriangle" size="0.9rem" /> {item.excluded_count} store could not be currency-converted.
          </div>
        )}
      </div>

      {/* Tags / Category Panel */}
      <div className="item-card-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span className="item-aggregates-title" style={{ margin: 0 }}>Tags</span>
          {!isEditingTags && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditingTags(true)}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
            >
              <Icon name="edit" /> Edit
            </button>
          )}
        </div>

        {isEditingTags ? (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Add tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTagAdd();
                  }
                }}
                style={{ fontSize: '0.85rem' }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleTagAdd}>
                Add
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
              {tags.map(t => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '9999px',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.8rem',
                  }}
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditingTags(false)}
                disabled={isSavingTags}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleTagsSave}
                disabled={isSavingTags}
              >
                {isSavingTags ? 'Saving...' : 'Save Tags'}
              </button>
            </div>
          </div>
        ) : tags.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tags added yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {tags.map(t => (
              <span
                key={t}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '9999px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.8rem',
                  color: 'var(--text)',
                }}
              >
                <Icon name="tag" size="0.75rem" /> {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
