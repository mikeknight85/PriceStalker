import React from 'react';
import { ItemWithListings, StockStatusStats } from '../../../../../types/api';
import { formatPrice } from '../../../../../utils/format';
import { isAvailableStatus, formatStatusLabel } from './stockTimelineUtils';

interface StockSeriesItem {
  productId: number;
  retailerName: string;
  url: string;
  stockStatus: string;
  stats?: StockStatusStats;
}

interface ItemStockMatrixProps {
  series: StockSeriesItem[];
  item?: ItemWithListings | null;
  userLocale?: string | null;
}

export const ItemStockMatrix: React.FC<ItemStockMatrixProps> = ({
  series,
  item,
  userLocale,
}) => {
  return (
    <div className="item-stock-matrix-card">
      <h3 className="item-stock-matrix-title">Current Store Stock Matrix</h3>
      <div className="item-stock-matrix-table-wrapper">
        <table className="item-stock-matrix-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Status</th>
              <th>Price</th>
              <th>30-Day Availability</th>
              <th>Current Status Duration</th>
              <th style={{ textAlign: 'right' }}>Store Link</th>
            </tr>
          </thead>
          <tbody>
            {series.map(store => {
              const isStoreIn = isAvailableStatus(store.stockStatus);
              const listing = item?.listings.find(l => l.id === store.productId);
              const isLowest = listing && item?.best_price_listing_ids.includes(listing.id);
              const price = listing?.converted_price ?? listing?.current_price;
              const currency = item?.best_price_currency ?? listing?.currency ?? 'USD';

              return (
                <tr key={store.productId}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ color: 'var(--text)' }}>{store.retailerName}</span>
                  </td>
                  <td>
                    <span className={`item-store-status-pill ${isStoreIn ? 'in' : 'out'}`}>
                      {formatStatusLabel(store.stockStatus)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: isLowest ? '#10b981' : 'var(--text)' }}>
                      {price !== null && price !== undefined ? formatPrice(price, currency, userLocale) : '—'}
                    </span>
                    {isLowest && (
                      <span className="item-store-best-pill" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                        Lowest
                      </span>
                    )}
                  </td>
                  <td>
                    {store.stats?.availability_percent !== undefined && store.stats.availability_percent !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontWeight: 600,
                          color: store.stats.availability_percent >= 80 ? '#10b981' : store.stats.availability_percent >= 50 ? '#f59e0b' : '#ef4444'
                        }}>
                          {Math.round(store.stats.availability_percent)}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {store.stats?.days_in_current_status !== undefined && store.stats.days_in_current_status !== null
                      ? `${store.stats.days_in_current_status} ${store.stats.days_in_current_status === 1 ? 'day' : 'days'}`
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    >
                      Visit Store ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
