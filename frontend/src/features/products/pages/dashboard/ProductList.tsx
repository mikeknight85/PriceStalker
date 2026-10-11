import React from 'react';
import ProductCard from '../../components/ProductCard';
import { Product } from '../../../../types/api';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import ResultCount from './ResultCount';

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  /** Named in the count line, the way the grouped view names it (#248). */
  activeTag: string | null;
  onDelete: (id: number, name?: string | null) => void;
  onRefresh: (id: number, name?: string | null) => Promise<any>;
  onTogglePause: (id: number, paused: boolean, name?: string | null) => Promise<any>;
  onAddClick: () => void;
  hasAnyProducts: boolean;
  onSelect?: (id: number) => void;
}

/**
 * The flat "All stores" view: one card per retailer listing.
 *
 * It renders its own count, because the cards here are *stores* -- one
 * retailer's listing of a product -- and the shared control row above had no
 * way to know which view's cards it was counting (issue #248).
 */
const ProductList: React.FC<ProductListProps> = ({
  products,
  isLoading,
  activeTag,
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
      <>
        <ResultCount count={products.length} noun="store" activeTag={activeTag} />
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
      </>
    );
  }

  if (hasAnyProducts) {
    return (
      <>
        <ResultCount count={0} noun="store" activeTag={activeTag} />
        <div className="no-results">
          <div className="no-results-icon"><Icon name="search" size="2.5rem" /></div>
          <h3 className="no-results-title">No stores found</h3>
          <p className="no-results-text">
            Try adjusting your search query, tracking or stock filter, or tag.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name="shoppingBag" size="2.5rem" /></div>
      <h3 className="empty-state-title">No tracked products yet</h3>
      <p className="empty-state-text" style={{ marginBottom: '1.5rem' }}>
        Start monitoring prices and stock status by adding your first product.
      </p>
      <button className="btn btn-primary" onClick={onAddClick}>＋ Track New Product</button>
    </div>
  );
};

export default ProductList;
