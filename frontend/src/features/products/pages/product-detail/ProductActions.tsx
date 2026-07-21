import React from 'react';
import LoadingSpinner from '../../../../components/LoadingSpinner';

interface ProductActionsProps {
  handleRefresh: () => Promise<void>;
  handleRescan: () => Promise<void>;
  handleDelete: () => Promise<void>;
  isRefreshing: boolean;
}

const ProductActions: React.FC<ProductActionsProps> = ({
  handleRefresh,
  handleRescan,
  handleDelete,
  isRefreshing,
}) => {
  return (
    <div className="product-detail-actions">
      <button className="btn btn-primary" onClick={handleRefresh} disabled={isRefreshing} title="Update current price">
        {isRefreshing ? <LoadingSpinner size="1rem" /> : 'Refresh Price Now'}
      </button>
      <button className="btn btn-rescan" onClick={handleRescan} disabled={isRefreshing} title="Troubleshoot extraction issues by forcing a re-scan and selection modal">
        {isRefreshing ? <LoadingSpinner size="1rem" /> : 'Troubleshoot Price'}
      </button>
      <button className="btn btn-danger" onClick={handleDelete}>Stop Tracking</button>
    </div>
  );
};

export default ProductActions;
