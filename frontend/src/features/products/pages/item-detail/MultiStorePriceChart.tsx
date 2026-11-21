import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { PriceHistory } from '../../../../types/api';
import { formatPrice, formatDateWithOptions } from '../../../../utils/format';

interface StoreSeries {
  productId: number;
  retailerName: string;
  url: string;
  currency: string;
  prices: PriceHistory[];
}

interface MultiStorePriceChartProps {
  series: StoreSeries[];
  currency: string;
  targetPrice?: number | null;
  userLocale?: string | null;
  selectedRange?: number;
  onRangeChange: (range: number | undefined) => void;
}

const PALETTE = [
  '#0284c7', // Sky blue
  '#10b981', // Emerald green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export const MultiStorePriceChart: React.FC<MultiStorePriceChartProps> = ({
  series,
  currency,
  targetPrice,
  userLocale,
  selectedRange,
  onRangeChange,
}) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleStore = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Build a merged timeline for the chart
  const { chartData, storeKeys } = useMemo(() => {
    const timeMap = new Map<number, Record<string, any>>();
    const keys: Array<{ key: string; name: string; color: string }> = [];

    series.forEach((s, idx) => {
      const key = `store_${s.productId}`;
      const color = PALETTE[idx % PALETTE.length];
      keys.push({ key, name: s.retailerName, color });

      s.prices.forEach(p => {
        const time = new Date(p.recorded_at).getTime();
        // Snap to 10-minute bins to align close checks
        const snapped = Math.round(time / (10 * 60 * 1000)) * (10 * 60 * 1000);
        const val = typeof p.price === 'string' ? parseFloat(p.price) : p.price;

        if (!timeMap.has(snapped)) {
          timeMap.set(snapped, { timestamp: snapped });
        }
        timeMap.get(snapped)![key] = val;
      });
    });

    const sorted = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Forward fill missing points for smooth line rendering
    for (let i = 1; i < sorted.length; i++) {
      keys.forEach(k => {
        if (sorted[i][k.key] === undefined && sorted[i - 1][k.key] !== undefined) {
          sorted[i][k.key] = sorted[i - 1][k.key];
        }
      });
    }

    return { chartData: sorted, storeKeys: keys };
  }, [series]);

  return (
    <div className="item-chart-card">
      <div className="item-chart-controls">
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
          Price Movement by Store
        </h3>

        <div className="item-chart-range-pills">
          {[
            { label: '7 days', val: 7 },
            { label: '30 days', val: 30 },
            { label: '90 days', val: 90 },
            { label: 'All time', val: undefined },
          ].map(r => (
            <button
              key={r.label}
              type="button"
              className={`item-chart-range-pill ${selectedRange === r.val ? 'active' : ''}`}
              onClick={() => onRangeChange(r.val)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {storeKeys.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter stores:</span>
          {storeKeys.map(k => {
            const isHidden = hiddenKeys.has(k.key);
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => toggleStore(k.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '1rem',
                  fontSize: '0.785rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isHidden ? 'var(--border)' : k.color}`,
                  background: isHidden ? 'var(--background)' : `${k.color}18`,
                  color: isHidden ? 'var(--text-muted)' : 'var(--text)',
                  opacity: isHidden ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}
                title={isHidden ? `Click to show ${k.name}` : `Click to hide ${k.name}`}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isHidden ? 'var(--text-muted)' : k.color,
                  }}
                />
                <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>
                  {k.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {chartData.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No price history recorded for these stores in the selected period.
        </div>
      ) : (
        <div style={{ width: '100%', height: '380px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={ts => formatDateWithOptions(ts, userLocale, { month: 'short', day: 'numeric' })}
                stroke={isDark ? '#64748b' : '#94a3b8'}
                fontSize={12}
              />
              <YAxis
                stroke={isDark ? '#64748b' : '#94a3b8'}
                fontSize={12}
                tickFormatter={val => formatPrice(val, currency, userLocale)}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const visible = payload.filter((entry: any) => !hiddenKeys.has(entry.dataKey));
                  if (!visible.length) return null;
                  return (
                    <div
                      style={{
                        background: isDark ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
                        {formatDateWithOptions(Number(label) || 0, userLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {visible.map((entry: any) => (
                        <div
                          key={entry.dataKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            color: entry.color,
                            fontWeight: 600,
                            padding: '2px 0',
                          }}
                        >
                          <span>{entry.name}:</span>
                          <span>{formatPrice(entry.value, currency, userLocale)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                onClick={(e: any) => {
                  if (e?.dataKey) toggleStore(e.dataKey);
                }}
                wrapperStyle={{ cursor: 'pointer', userSelect: 'none', paddingTop: '12px' }}
                formatter={(value, entry: any) => {
                  const isHidden = hiddenKeys.has(entry.dataKey);
                  return (
                    <span
                      title="Click to toggle store on chart"
                      style={{
                        color: isHidden ? 'var(--text-muted)' : 'var(--text)',
                        textDecoration: isHidden ? 'line-through' : 'none',
                        opacity: isHidden ? 0.45 : 1,
                        fontWeight: isHidden ? 400 : 600,
                        marginRight: '0.75rem',
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {value}
                    </span>
                  );
                }}
              />

              {targetPrice && (
                <ReferenceLine
                  y={targetPrice}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: `Target: ${formatPrice(targetPrice, currency, userLocale)}`,
                    fill: '#10b981',
                    fontSize: 12,
                    position: 'top',
                  }}
                />
              )}

              {storeKeys.map(k => (
                <Line
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  name={k.name}
                  stroke={k.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  hide={hiddenKeys.has(k.key)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default MultiStorePriceChart;
