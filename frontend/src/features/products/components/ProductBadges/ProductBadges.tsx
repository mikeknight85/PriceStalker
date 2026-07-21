import React from 'react';
import { Product } from '../../../../types/api';
import AIStatusBadge from '../../../../components/AIStatusBadge';
import Badge from '../../../../components/Badge';
import './ProductBadges.css';

interface ProductBadgesProps {
  product: Product;
  showAiStatus?: boolean;
  showInStock?: boolean;
  showPriceTypes?: boolean;
}

const ProductBadges: React.FC<ProductBadgesProps> = ({ 
  product, 
  showAiStatus = false,
  showInStock = false,
  showPriceTypes = true
}) => {
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isPreOrder = product.stock_status === 'pre_order';
  const isInStock = product.stock_status === 'in_stock';
  const isMemberOnly = product.stock_status === 'member_only';
  const isNotAvailable = product.stock_status === 'not_available';
  
  const currentPrice = typeof product.current_price === 'string' 
    ? parseFloat(product.current_price) 
    : (product.current_price || 0);
  
  const showPriceBadges = product.stock_status !== 'out_of_stock' && product.stock_status !== 'not_available';
  const isHistoricalLow = showPriceBadges && currentPrice > 0 && product.min_price && currentPrice <= product.min_price;
  const isSale = showPriceBadges && product.original_price && product.original_price > currentPrice;

  return (
    <div className="pg-badges">
      {/* Paused Badge */}
      {product.checking_paused && (
        <Badge variant="warning" size="small" icon={<i>⏸️</i>}>
          Paused
        </Badge>
      )}
      
      {/* Sale Badge */}
      {isSale && (
        <Badge variant="deal" size="small">Sale</Badge>
      )}
      
      {/* Price Type Badges */}
      {showPriceTypes && showPriceBadges && product.price_type === 'member-price' && (
        <Badge variant="member" size="small">Member</Badge>
      )}
      {showPriceTypes && showPriceBadges && product.price_type === 'deal-price' && (
        <Badge variant="deal" size="small">Deal</Badge>
      )}
      
      {/* Historical Low Badge */}
      {isHistoricalLow && (
        <Badge variant="success" size="small">Low</Badge>
      )}

      {/* Stock Status Badges */}
      {isPreOrder && (
        <Badge variant="warning" size="small" icon={<i>🕒</i>}>
          Pre-Order
        </Badge>
      )}
      {isMemberOnly && (
        <Badge variant="member" size="small" icon={<i>👤</i>}>
          Member Only
        </Badge>
      )}
      {isOutOfStock && (
        <Badge variant="danger" size="small" icon={<i>⚠</i>}>
          Out of Stock
        </Badge>
      )}
      {isNotAvailable && (
        <Badge variant="outline" size="small" icon={<i>🚫</i>}>
          Unavailable
        </Badge>
      )}
      {showInStock && isInStock && (
        <Badge variant="success" size="small" icon={<i>✓</i>}>
          In Stock
        </Badge>
      )}

      {/* Optional AI Status */}
      {showAiStatus && (
        <AIStatusBadge status={product.ai_status} size="small" />
      )}
    </div>
  );
};

export default ProductBadges;
