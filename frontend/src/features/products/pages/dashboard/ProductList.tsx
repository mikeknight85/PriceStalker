import React from 'react';
import ProductCard from '../../components/ProductCard';
import { Product } from '../../../../types/api';
import LoadingSpinner from '../../../../components/LoadingSpinner';

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  onDelete: (id: number) => void;
  onRefresh: (id: number) => Promise<void>;
  onTogglePause: (id: number, paused: boolean) => Promise<void>;
  onAddClick: () => void;
  hasAnyProducts: boolean;
  onSelect?: (id: number) => void;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  isLoading,
  onDelete,
  onRefresh,
  onTogglePause,
  onAddClick,
  hasAnyProducts,
  onSelect,
}) => {
  if (isLoading) {
    return <LoadingSpinner centered />;
  }

  if (products.length > 0) {
    return (
      <div className="products-list">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onDelete={onDelete}
            onRefresh={onRefresh}
            onTogglePause={onTogglePause}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  if (hasAnyProducts) {
    return (
      <div className="no-results">
        <div className="no-results-icon">🔍</div>
        <h3 className="no-results-title">No products found</h3>
        <p className="no-results-text">
          Try adjusting your search query, status filter or category.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">🛍️</div>
      <h3 className="empty-state-title">No tracked products yet</h3>
      <p className="empty-state-text" style={{ marginBottom: '1.5rem' }}>
        Start monitoring prices and stock status by adding your first product.
      </p>
      <button className="btn btn-primary" onClick={onAddClick}>＋ Track New Product</button>
    </div>
  );
};

export default ProductList;
