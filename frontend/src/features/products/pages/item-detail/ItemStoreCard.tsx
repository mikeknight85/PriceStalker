import React, { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { ItemWithListings, Product } from '../../../../types/api';
import { formatPrice } from '../../../../utils/format';
import Icon from '../../../../components/Icon';
import Sparkline from '../../components/Sparkline';
import ProductBadges from '../../components/ProductBadges';
import { ProductService } from '../../services/ProductService';
import '../../components/ProductCard/ProductCard.css';
import './ItemDetail.css';

interface ItemStoreCardProps {
  listing: Product;
  item: ItemWithListings;
  userLocale?: string | null;
  onRefresh: (productId: number) => Promise<void>;
  onDetach?: (productId: number) => Promise<void>;
  onDelete: (productId: number) => void;
  onUpdate?: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const ItemStoreCard: React.FC<ItemStoreCardProps> = ({
  listing,
  item,
  userLocale,
  onRefresh,
  onDetach,
  onDelete,
  onUpdate,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isDetaching, setIsDetaching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const isLowest = item.best_price_listing_ids.includes(listing.id);
  const storeName = listing.retailer_name || hostOf(listing.url);

  // Listing price in comparison currency (or native if no converted price)
  const displayPrice = listing.converted_price !== null && listing.converted_price !== undefined
    ? listing.converted_price
    : listing.current_price;
  const displayCurrency = item.best_price_currency ?? listing.currency ?? 'USD';

  const isOutOfStock = listing.stock_status === 'out_of_stock';
  const isPreOrder = listing.stock_status === 'pre_order';
  const isMemberOnly = listing.stock_status === 'member_only';
  const isNotAvailable = listing.stock_status === 'not_available';
  const isPaused = listing.checking_paused;

  useEffect(() => {
    const calculateProgress = () => {
      if (!listing.next_check_at || !listing.last_checked) {
        setProgress(100);
        setTimeRemaining('Soon');
        return;
      }

      const lastChecked = new Date(listing.last_checked).getTime();
      const nextCheck = new Date(listing.next_check_at).getTime();
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
  }, [listing.last_checked, listing.next_check_at, isComplete]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await onRefresh(listing.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPausing(true);
    try {
      await ProductService.update(listing.id, { checking_paused: !listing.checking_paused });
      if (onUpdate) onUpdate();
    } finally {
      setIsPausing(false);
    }
  };

  const handleDetach = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDetach) return;
    setIsDetaching(true);
    try {
      await onDetach(listing.id);
    } finally {
      setIsDetaching(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(listing.id);
  };

  const sparklineData = (listing as any).sparkline_data || listing.sparkline || [
    { price: listing.current_price || 0, recorded_at: new Date().toISOString() }
  ];

  return (
    <div
      className={`pb-card item-store-card ${isLowest ? 'is-lowest' : ''} ${isPaused ? 'paused' : ''} ${isOutOfStock ? 'out-of-stock' : ''} ${isPreOrder ? 'pre-order' : ''} ${isMemberOnly ? 'member-only' : ''} ${isNotAvailable ? 'not-available' : ''}`}
    >
      <div className="pb-card-main">
        <Link
          to="/products/$productId"
          params={{ productId: String(listing.id) }}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
        >
          <div className="pb-card-content">
            <div className="pb-card-image-wrapper">
              {listing.image_url || item.image_url ? (
                <img
                  src={listing.image_url || item.image_url || ''}
                  alt=""
                  className="pb-card-image"
                  loading="lazy"
                />
              ) : (
                <Icon name="package" size="1.5rem" />
              )}
            </div>

            <div className="pb-card-info">
              <h3 className="pb-card-title" title={listing.name || item.name}>
                {listing.name || item.name}
              </h3>

              <div className="pb-card-price-row">
                {isOutOfStock || isNotAvailable ? (
                  displayPrice ? (
                    <>
                      <span className="pb-card-price" style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                        {formatPrice(displayPrice, displayCurrency, userLocale)}
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
                    {displayPrice !== null
                      ? formatPrice(displayPrice, displayCurrency, userLocale, isPreOrder ? 'TBD' : 'N/A')
                      : 'No price'}
                  </span>
                )}

                <span className="pb-card-meta">
                  @{storeName}
                </span>

                {isLowest && (
                  <span className="item-store-best-pill" style={{ marginLeft: '0.25rem' }}>
                    Lowest price
                  </span>
                )}
              </div>

              <div className="pb-card-badges">
                <ProductBadges product={listing} showPriceTypes={false} />
              </div>
            </div>

            <div className="pb-card-chart">
              <Sparkline
                data={sparklineData}
                width={100}
                height={40}
                showTrend={false}
              />
            </div>
          </div>
        </Link>

        {!isPaused && (
          <div
            className={`pb-progress-bar ${isComplete ? 'pb-complete' : ''}`}
            style={{ width: `${progress}%` }}
          />
        )}
        {!isPaused && (
          <span className="pb-time-remaining">{timeRemaining}</span>
        )}
      </div>

      <div className="pb-card-actions">
        <button
          type="button"
          className={`pb-action-btn ${isRefreshing ? 'pb-refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing || isPaused}
          title={isPaused ? 'Cannot refresh paused store' : 'Refresh Price Now'}
          style={isPaused ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
        >
          <Icon name="refresh" />
        </button>

        <button
          type="button"
          className={`pb-action-btn ${isPausing ? 'pb-refreshing' : ''}`}
          onClick={handleTogglePause}
          disabled={isPausing}
          title={isPaused ? 'Resume Tracking' : 'Pause Tracking'}
        >
          {isPaused ? <Icon name="play" /> : <Icon name="pause" />}
        </button>

        <Link
          to="/products/$productId"
          params={{ productId: String(listing.id) }}
          className="pb-action-btn"
          title="View Store Listing Details & Scraper Diagnostics"
        >
          <Icon name="eye" />
        </Link>

        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pb-action-btn"
          title="Open Store Page ↗"
        >
          <Icon name="link" />
        </a>

        {onDetach && item.store_count > 1 && (
          <button
            type="button"
            className="pb-action-btn"
            onClick={handleDetach}
            disabled={isDetaching}
            title="Separate this store into its own standalone product"
          >
            <Icon name="ban" />
          </button>
        )}

        <button
          type="button"
          className="pb-action-btn danger"
          onClick={handleDelete}
          title="Delete Store Listing"
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
};

export default ItemStoreCard;
