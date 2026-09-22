import React from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '../../../auth';
import { formatDate } from '../../../../utils/format';
import { describeUnavailableReason, describeMonitoringState } from '../../../../utils/availability';

interface ProductMetadataProps {
  product: any;
  isEditingTags: boolean;
  setIsEditingTags: (isEditing: boolean) => void;
  editTags: string[];
  setEditTags: (tags: string[]) => void;
  newTagInput: string;
  setNewTagInput: (input: string) => void;
  handleAddTag: (e?: React.KeyboardEvent | React.FocusEvent) => void;
  handleRemoveTag: (tag: string) => void;
  handleSaveTags: () => Promise<void>;
  handleRefreshIntervalChange: (newInterval: number) => Promise<void>;
  availableTags: string[];
  isSaving: boolean;
  REFRESH_INTERVALS: { value: number, label: string }[];
}

const ProductMetadata: React.FC<ProductMetadataProps> = ({
  product,
  isEditingTags,
  setIsEditingTags,
  editTags,
  newTagInput,
  setNewTagInput,
  handleAddTag,
  handleRemoveTag,
  handleSaveTags,
  handleRefreshIntervalChange,
  availableTags,
  isSaving,
  REFRESH_INTERVALS,
}) => {
  const { user } = useAuth();

  // A stalled product used to give no explanation at all: a user could not tell
  // whether they had paused it, the system had given up, or the retailer was
  // simply unreachable (issue #73).
  const unavailableReason = describeUnavailableReason(product.unavailable_reason);

  return (
    <div className="product-detail-meta">
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Tags</span>
        {isEditingTags ? (
          <div className="tag-editor-wrapper">
            <div className="tag-editor-container">
              {editTags.map(tag => (
                <span key={tag} className="tag-editor-pill">
                  {tag}
                  <button 
                    className="remove-tag-btn" 
                    onClick={() => handleRemoveTag(tag)}
                    title={`Remove ${tag}`}
                    aria-label={`Remove tag ${tag}`}
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
                list="existing-tags"
                aria-label="Add a tag"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                onBlur={() => handleAddTag()}
                placeholder={editTags.length === 0 ? "e.g. xmas presents, living room" : "Add more..."}
                autoFocus
              />
            </div>
            <datalist id="existing-tags">
              {availableTags.map(tag => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <span className="tag-input-hint">Press Enter or comma to add.</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveTags} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingTags(false)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="product-detail-meta-value">
              {/*
                `product.category` is the wire field; the UI calls it a tag.
                Each badge links back to the dashboard filtered by that tag, so
                "what else did I file under this?" is one click rather than a
                trip through the filter bar.
              */}
              {product.category ? (
                product.category.split(',').map((tag: string, i: number) => {
                  const trimmed = tag.trim();
                  return (
                    <Link
                      key={i}
                      className="tag-badge"
                      to="/products"
                      search={{ tag: trimmed }}
                      title={`Show everything tagged ${trimmed}`}
                    >
                      {trimmed}
                    </Link>
                  );
                })
              ) : (
                'None'
              )}
            </div>
            <button className="edit-title-btn" onClick={() => setIsEditingTags(true)} aria-label="Edit tags">
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
        <span className="product-detail-meta-value">{product.last_checked ? formatDate(product.last_checked, user?.locale, true) : 'Never'}</span>
      </div>
      <div className="product-detail-meta-item">
        <span className="product-detail-meta-label">Monitoring</span>
        <span className="product-detail-meta-value">{describeMonitoringState(product)}</span>
      </div>
      {unavailableReason && (
        <div className="product-detail-meta-item">
          <span className="product-detail-meta-label">Reason</span>
          <span className="product-detail-meta-value" style={{ color: 'var(--text-muted)' }}>
            {unavailableReason}
          </span>
        </div>
      )}
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
        <span className="product-detail-meta-value">{formatDate(product.created_at, user?.locale)}</span>
      </div>
    </div>
  );
};

export default ProductMetadata;
