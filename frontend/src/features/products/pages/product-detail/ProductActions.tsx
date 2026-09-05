import React from 'react';
import LoadingSpinner from '../../../../components/LoadingSpinner';

interface ProductActionsProps {
  /** Opens the picker for linking this store to another product (issue #143). */
  onLinkToProduct: () => void;
  /**
   * Set when this store shares a product with others, so it can be separated
   * again. Undefined when it is the only store, where there is nothing to
   * separate from.
   */
  onSeparate?: () => void;
  handleRefresh: () => Promise<void>;
  handleRescan: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleResumeMonitoring: () => Promise<void>;
  isRefreshing: boolean;
  /** Monitoring is stopped, so the actions offered change. */
  isPaused: boolean;
}

const ProductActions: React.FC<ProductActionsProps> = ({
  onLinkToProduct,
  onSeparate,
  handleRefresh,
  handleRescan,
  handleDelete,
  handleResumeMonitoring,
  isRefreshing,
  isPaused,
}) => {
  return (
    <div className="product-detail-actions">
      {/* A manual refresh works on a paused product, which is what makes this
          the "retry now" action once monitoring has stopped. */}
      <button
        className="btn btn-primary"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title={isPaused ? 'Check this product once, without resuming monitoring' : 'Update current price'}
      >
        {isRefreshing ? <LoadingSpinner size="1rem" /> : isPaused ? 'Retry Now' : 'Refresh Price Now'}
      </button>
      {isPaused && (
        <button
          className="btn btn-secondary"
          onClick={handleResumeMonitoring}
          disabled={isRefreshing}
          title="Start checking this product again on its normal schedule"
        >
          Resume Monitoring
        </button>
      )}
      <button className="btn btn-rescan" onClick={handleRescan} disabled={isRefreshing} title="Troubleshoot extraction issues by forcing a re-scan and selection modal">
        {isRefreshing ? <LoadingSpinner size="1rem" /> : 'Troubleshoot Price'}
      </button>
      {/*
        Grouping actions sit next to the destructive one but before it, because
        "this is the same as that" is a far more common intent than deleting,
        and separating is the undo for having linked the wrong pair.
      */}
      {onSeparate ? (
        <button
          className="btn btn-secondary"
          onClick={onSeparate}
          title="Track this store on its own again, instead of alongside the other stores for this product"
        >
          Separate From Product
        </button>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={onLinkToProduct}
          title="Mark this store as selling a product you already track, so their prices are compared together"
        >
          Same As Another Product
        </button>
      )}
      <button className="btn btn-danger" onClick={handleDelete}>Stop Tracking</button>
    </div>
  );
};

export default ProductActions;
