import React from 'react';

interface ProductHeaderProps {
  product: any;
  editName: string;
  setEditName: (name: string) => void;
  isEditingName: boolean;
  setIsEditingName: (isEditing: boolean) => void;
  handleSaveName: () => Promise<void>;
  isSaving: boolean;
}

const ProductHeader: React.FC<ProductHeaderProps> = ({
  product,
  editName,
  setEditName,
  isEditingName,
  setIsEditingName,
  handleSaveName,
  isSaving,
}) => {
  const retailerName = product.retailer_name || (() => {
    try {
      const url = new URL(product.url);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Retailer';
    }
  })();

  return (
    <div className="product-detail-info-left">
      <div className="product-detail-name-container">
        {isEditingName ? (
          <div style={{ flex: 1 }}>
            <input
              className="product-name-edit-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <div className="edit-title-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={isSaving}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingName(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="product-detail-name">{product.name || 'Unknown Product'}</h1>
            <button className="edit-title-btn" onClick={() => setIsEditingName(true)} title="Edit name">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </>
        )}
      </div>
      
      <span className="product-detail-retailer">
        {retailerName}
      </span>

      <p className="product-detail-url">
        <a href={product.url} target="_blank" rel="noopener noreferrer">{product.url}</a>
      </p>
    </div>
  );
};

export default ProductHeader;
