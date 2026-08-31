import React from 'react';
import LoadingSpinner from '../../../../components/LoadingSpinner';

interface ProductActionsProps {
  handleRefresh: () => Promise<void>;
  handleRescan: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleResumeMonitoring: () => Promise<void>;
  isRefreshing: boolean;
  /** Monitoring is stopped, so the actions offered change. */
  isPaused: boolean;
}

const ProductActions: React.FC<ProductActionsProps> = ({
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
      <button className="btn btn-danger" onClick={handleDelete}>Stop Tracking</button>
    </div>
  );
};

export default ProductActions;
