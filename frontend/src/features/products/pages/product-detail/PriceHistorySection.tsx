import React from 'react';
import PriceChart from '../../components/PriceChart';
import PriceHistoryList from '../../components/PriceHistoryList';

interface PriceHistorySectionProps {
  product: any;
  prices: any[];
  handleRangeChange: (days: number | undefined) => void;
  /** The range `prices` holds, so the picker survives leaving the tab. */
  rangeDays: number;
  user?: any;
}

const PriceHistorySection: React.FC<PriceHistorySectionProps> = ({
  product,
  prices,
  handleRangeChange,
  rangeDays,
  user
}) => {
  return (
    <div className="price-history-section">
      <PriceChart
        prices={prices}
        currency={product.currency || 'USD'}
        targetPrice={product.target_price}
        onRangeChange={handleRangeChange}
        rangeDays={rangeDays}
      />
      
      <PriceHistoryList 
        history={prices} 
        currency={product.currency || 'USD'} 
        locale={user?.locale}
      />
    </div>
  );
};

export default PriceHistorySection;
