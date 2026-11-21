import React, { useMemo } from 'react';
import { ItemWithListings } from '../../../../types/api';
import { formatPrice, formatDate } from '../../../../utils/format';
import MultiStorePriceChart from './MultiStorePriceChart';
import ItemPriceHistoryList from './ItemPriceHistoryList';

interface StoreSeries {
  productId: number;
  retailerName: string;
  url: string;
  currency: string;
  prices: any[];
}

interface ItemPriceHistorySectionProps {
  item: ItemWithListings;
  series: StoreSeries[];
  userLocale?: string | null;
  selectedRange: number | undefined;
  onRangeChange: (range: number | undefined) => void;
}

export const ItemPriceHistorySection: React.FC<ItemPriceHistorySectionProps> = ({
  item,
  series,
  userLocale,
  selectedRange,
  onRangeChange,
}) => {
  const currency = item.best_price_currency || 'USD';

  // Compute stats across all series
  const stats = useMemo<{
    lowest: { price: number; store: string; date: string } | null;
    highest: { price: number; store: string; date: string } | null;
    average: number | null;
  }>(() => {
    let lowest: { price: number; store: string; date: string } | null = null;
    let highest: { price: number; store: string; date: string } | null = null;
    let sum = 0;
    let count = 0;

    series.forEach(s => {
      s.prices.forEach(p => {
        const val = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
        if (!Number.isFinite(val)) return;

        sum += val;
        count++;

        if (!lowest || val < lowest.price) {
          lowest = { price: val, store: s.retailerName, date: p.recorded_at };
        }
        if (!highest || val > highest.price) {
          highest = { price: val, store: s.retailerName, date: p.recorded_at };
        }
      });
    });

    const average = count > 0 ? sum / count : null;

    return { lowest, highest, average };
  }, [series]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="item-chart-hero">
        <div className="item-chart-stat-card">
          <div className="item-chart-stat-label">All-Time Low</div>
          <div className="item-chart-stat-value" style={{ color: '#10b981' }}>
            {stats.lowest ? formatPrice(stats.lowest.price, currency, userLocale) : '—'}
          </div>
          {stats.lowest && (
            <div className="item-chart-stat-subtext">
              {stats.lowest.store} · {formatDate(stats.lowest.date, userLocale)}
            </div>
          )}
        </div>

        <div className="item-chart-stat-card">
          <div className="item-chart-stat-label">All-Time High</div>
          <div className="item-chart-stat-value" style={{ color: '#ef4444' }}>
            {stats.highest ? formatPrice(stats.highest.price, currency, userLocale) : '—'}
          </div>
          {stats.highest && (
            <div className="item-chart-stat-subtext">
              {stats.highest.store} · {formatDate(stats.highest.date, userLocale)}
            </div>
          )}
        </div>

        <div className="item-chart-stat-card">
          <div className="item-chart-stat-label">Average Price</div>
          <div className="item-chart-stat-value">
            {stats.average !== null ? formatPrice(stats.average, currency, userLocale) : '—'}
          </div>
          <div className="item-chart-stat-subtext">Across {series.length} tracked stores</div>
        </div>

        <div className="item-chart-stat-card">
          <div className="item-chart-stat-label">Current Spread</div>
          <div className="item-chart-stat-value">
            {item.price_spread !== null ? formatPrice(item.price_spread, currency, userLocale) : '—'}
          </div>
          <div className="item-chart-stat-subtext">Cheapest vs dearest store today</div>
        </div>
      </div>

      <MultiStorePriceChart
        series={series}
        currency={currency}
        targetPrice={item.target_price}
        userLocale={userLocale}
        selectedRange={selectedRange}
        onRangeChange={onRangeChange}
      />

      <ItemPriceHistoryList
        series={series}
        userLocale={userLocale}
      />
    </div>
  );
};

export default ItemPriceHistorySection;
