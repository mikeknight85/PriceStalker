import React, { useState, useEffect } from 'react';
import { ProductService } from '../../services/ProductService';
import { StockStatusHistoryEntry, StockStatusStats } from '../../../../types/api';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import StockTimeline from '../../components/StockTimeline';
import StockHistoryList from '../../components/StockHistoryList';

interface StockAvailabilitySectionProps {
  productId: number;
}

const StockAvailabilitySection: React.FC<StockAvailabilitySectionProps> = ({ productId }) => {
  const [history, setHistory] = useState<StockStatusHistoryEntry[]>([]);
  const [stats, setStats] = useState<StockStatusStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await ProductService.getStockHistory(productId, 30);
        setHistory(response.data.history);
        setStats(response.data.stats);
        setError(null);
      } catch {
        setError('Failed to load stock history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [productId]);

  if (isLoading) {
    return (
      <div className="stock-timeline-loading" style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <LoadingSpinner centered />
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!stats || history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        No stock history recorded yet.
      </div>
    );
  }

  return (
    <div className="stock-availability-section">
      <StockTimeline history={history} stats={stats} days={30} />
      <StockHistoryList history={history} />
    </div>
  );
};

export default StockAvailabilitySection;
