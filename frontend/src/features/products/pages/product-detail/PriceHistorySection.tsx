import React from 'react';
import PriceChart from '../../components/PriceChart';
import PriceHistoryList from '../../components/PriceHistoryList';

interface PriceHistorySectionProps {
  product: any;
  prices: any[];
  handleRangeChange: (days: number | undefined) => void;
  user?: any;
}

const PriceHistorySection: React.FC<PriceHistorySectionProps> = ({ 
  product, 
  prices, 
  handleRangeChange,
  user
}) => {
  return (
    <div className="price-history-section">
      <PriceChart 
        prices={prices} 
        currency={product.currency || 'USD'} 
        targetPrice={product.target_price} 
        onRangeChange={handleRangeChange} 
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
