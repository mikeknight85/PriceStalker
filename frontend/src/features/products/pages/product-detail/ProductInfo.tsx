import React from 'react';
import ProductBadges from '../../components/ProductBadges';
import { formatPrice } from '../../../../utils/format';

interface ProductImageProps {
  product: any;
  editImageUrl: string;
  setEditImageUrl: (url: string) => void;
  isEditingImage: boolean;
  setIsEditingImage: (isEditing: boolean) => void;
  handleSaveImage: () => Promise<void>;
  isSaving: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  product,
  editImageUrl,
  setEditImageUrl,
  isEditingImage,
  setIsEditingImage,
  handleSaveImage,
  isSaving,
}) => {
  return (
    <div className="product-detail-image-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ position: 'relative' }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name || 'Product'} className="product-detail-image" />
        ) : (
          <div className="product-detail-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        )}
        <button 
          className="edit-title-btn" 
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.8)', padding: '0.4rem', borderRadius: '50%' }}
          onClick={() => setIsEditingImage(!isEditingImage)}
          title="Edit image URL"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>

      {isEditingImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            className="product-detail-meta-select"
            style={{ width: '100%' }}
            placeholder="Image URL..."
            value={editImageUrl}
            onChange={(e) => setEditImageUrl(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSaveImage} disabled={isSaving}>Submit</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingImage(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProductPriceStatusProps {
  product: any;
  user: any;
}

export const ProductPriceStatus: React.FC<ProductPriceStatusProps> = ({
  product,
  user,
}) => {
  const isOutOfStock = product.stock_status === 'out_of_stock' || product.stock_status === 'not_available';
  const isPreOrder = product.stock_status === 'pre_order';
  const fallbackLabel = isPreOrder ? 'TBD' : 'Price unavailable';

  return (
    <div className="product-detail-info-right">
      <ProductBadges 
        product={product} 
        showAiStatus={product.stock_status !== 'out_of_stock' && product.stock_status !== 'pre_order' && product.stock_status !== 'not_available'} 
        showInStock={true} 
      />

      <div className="product-detail-price" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {isOutOfStock ? (
          product.current_price ? (
            <>
              <span className="price-inactive" style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                {formatPrice(product.current_price, product.currency, user?.locale)}
              </span>
              <span className="price-subtext" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                (Last tracked price)
              </span>
            </>
          ) : (
            <span>Price unavailable</span>
          )
        ) : (
          <span>{formatPrice(product.current_price, product.currency, user?.locale, fallbackLabel)}</span>
        )}
        {product.converted_price && product.converted_currency !== product.currency && (
          <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            (~{formatPrice(product.converted_price, product.converted_currency, user?.locale)})
          </span>
        )}
      </div>

      {/* Price change percentage removed temporarily due to inconsistent history data */}
    </div>
  );
};
