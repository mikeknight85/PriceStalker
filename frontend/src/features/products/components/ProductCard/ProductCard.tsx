import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../../../types/api';
import { useAuth } from '../../../auth';
import { formatPrice, truncateUrl } from '../../../../utils/format';
import Sparkline from '../Sparkline';
import ProductBadges from '../ProductBadges';
import './ProductCard.css';
import Icon from '../../../../components/Icon';

interface ProductCardProps {
  product: Product;
  onDelete: (id: number) => void;
  onRefresh: (id: number) => Promise<void>;
  onTogglePause: (id: number, paused: boolean) => Promise<void>;
  onSelect?: (id: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onDelete, 
  onRefresh, 
  onTogglePause,
  onSelect
}) => {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(product.id);
    }
  };

  useEffect(() => {
    const calculateProgress = () => {
      if (!product.next_check_at || !product.last_checked) {
        setProgress(100);
        setTimeRemaining('Soon');
        return;
      }

      const lastChecked = new Date(product.last_checked).getTime();
      const nextCheck = new Date(product.next_check_at).getTime();
      const now = Date.now();
      const totalDuration = nextCheck - lastChecked;
      const elapsed = now - lastChecked;
      const remaining = nextCheck - now;

      const progressPercent = totalDuration > 0
        ? Math.min((elapsed / totalDuration) * 100, 100)
        : 100;
      setProgress(progressPercent);

      if (progressPercent >= 100 && !isComplete) {
        setIsComplete(true);
        setTimeout(() => setIsComplete(false), 1500);
      }

      if (remaining <= 0) {
        setTimeRemaining('Soon');
      } else {
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes % 60}m`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m`);
        } else {
          setTimeRemaining('< 1m');
        }
      }
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 1000);
    return () => clearInterval(interval);
  }, [product.last_checked, product.next_check_at, isComplete]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await onRefresh(product.id);
    } catch (err: any) {
      // Toast notifications are handled by useProductActions
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPausing(true);
    try {
      const newState = !product.checking_paused;
      await onTogglePause(product.id, newState);
    } catch (err: any) {
      // Toast notifications are handled by useProductActions
    } finally {
      setIsPausing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(product.id);
  };

  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isPreOrder = product.stock_status === 'pre_order';
  const isMemberOnly = product.stock_status === 'member_only';
  const isNotAvailable = product.stock_status === 'not_available';
  const isPaused = product.checking_paused;

  return (
    <div className={`pb-card ${isPaused ? 'paused' : ''} ${isOutOfStock ? 'out-of-stock' : ''} ${isPreOrder ? 'pre-order' : ''} ${isMemberOnly ? 'member-only' : ''} ${isNotAvailable ? 'not-available' : ''}`}>
      <div className="pb-card-main">
        <Link 
          to={`/?product=${product.id}`} 
          style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
          onClick={handleCardClick}
        >
          <div className="pb-card-content">
            <div className="pb-card-image-wrapper">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="pb-card-image" />
              ) : (
                <Icon name="package" size="1.5rem" />
              )}
            </div>
            
            <div className="pb-card-info">
              <h3 className="pb-card-title" title={product.name || ''}>
                {product.name || 'Unknown Product'}
              </h3>
              
              <div className="pb-card-price-row">
                {isOutOfStock || isNotAvailable ? (
                  product.current_price ? (
                    <>
                      <span className="pb-card-price" style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                        {formatPrice(product.current_price, product.currency, user?.locale)}
                      </span>
                      <span className="pb-card-price-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                        (OOS)
                      </span>
                    </>
                  ) : (
                    <span className="pb-card-price" style={{ opacity: 0.5 }}>
                      Unavailable
                    </span>
                  )
                ) : (
                  <span className="pb-card-price">
                    {formatPrice(product.current_price, product.currency, user?.locale, isPreOrder ? 'TBD' : 'N/A')}
                  </span>
                )}
                {product.original_price && product.original_price > (product.current_price || 0) && (
                  <span className="pb-card-price-original">
                    {formatPrice(product.original_price, product.currency, user?.locale)}
                  </span>
                )}
                {product.converted_price && product.converted_currency !== product.currency && (
                  <span className="pb-card-price-converted" title="Converted Price">
                    (~{formatPrice(product.converted_price, product.converted_currency, user?.locale)})
                  </span>
                )}
                <span className="pb-card-meta">
                  @{product.retailer_name || truncateUrl(product.url)}
                </span>
              </div>

              <div className="pb-card-badges">
                <ProductBadges product={product} showPriceTypes={false} />
              </div>
            </div>

            <div className="pb-card-chart">
              <Sparkline
                data={product.sparkline && product.sparkline.length > 0 
                  ? product.sparkline 
                  : [{ price: product.current_price || 0, recorded_at: new Date().toISOString() }]
                }
                width={100}
                height={40}
                showTrend={false}
              />
            </div>
          </div>
        </Link>

        {!isPaused && (
          <div className={`pb-progress-bar ${isComplete ? 'pb-complete' : ''}`} style={{ width: `${progress}%` }} />
        )}
        {!isPaused && (
          <span className="pb-time-remaining">{timeRemaining}</span>
        )}
      </div>

      <div className="pb-card-actions">
        <button 
          className={`pb-action-btn ${isRefreshing ? 'pb-refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing || isPaused}
          title={isPaused ? "Cannot refresh paused product" : "Refresh Price"}
          style={isPaused ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
        >
          <Icon name="refresh" />
        </button>
        <button 
          className={`pb-action-btn ${isPausing ? 'pb-refreshing' : ''}`}
          onClick={handleTogglePause}
          disabled={isPausing}
          title={isPaused ? "Resume Tracking" : "Pause Tracking"}
        >
          {isPaused ? <Icon name="play" /> : <Icon name="pause" />}
        </button>
        <Link 
          to={`/?product=${product.id}`} 
          className="pb-action-btn" 
          title="View Details"
          onClick={handleCardClick}
        >
          <Icon name="eye" />
        </Link>
        <a href={product.url} target="_blank" rel="noopener noreferrer" className="pb-action-btn" title="Open Store">
          <Icon name="link" />
        </a>
        <button className="pb-action-btn danger" onClick={handleDelete} title="Delete Product">
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
