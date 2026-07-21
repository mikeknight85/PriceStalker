import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { PriceHistory } from '../../../../types/api';

const getThemeColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#64748b' : '#94a3b8',
    tooltip: isDark ? '#1e293b' : 'white',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
  };
};

interface PriceChartProps {
  prices: PriceHistory[];
  currency: string;
  targetPrice?: number | null;
  onRangeChange?: (days: number | undefined) => void;
}

const DATE_RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: undefined, label: 'All time' },
];

export default function PriceChart({
  prices,
  currency,
  targetPrice,
  onRangeChange,
}: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<number | undefined>(30);
  const [themeColors, setThemeColors] = useState(getThemeColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeColors(getThemeColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const handleRangeChange = (days: number | undefined) => {
    setSelectedRange(days);
    onRangeChange?.(days);
  };

  const formatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2
  });

  // Group price history by timestamp (within a 5-second window)
  const groupedData: {
    date: number;
    standard?: number;
    member?: number;
    original?: number;
  }[] = [];

  // Sort prices by recorded_at ascending
  const sortedPrices = [...prices].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  sortedPrices.forEach((p) => {
    const timestamp = new Date(p.recorded_at).getTime();
    const priceVal = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
    const type = p.price_type || 'standard';

    // Find if there is an existing group within 5 seconds
    let group = groupedData.find(
      (g) => Math.abs(g.date - timestamp) <= 5000
    );

    if (!group) {
      group = { date: timestamp };
      groupedData.push(group);
    }

    if (type === 'standard' || type === 'deal-price') {
      group.standard = priceVal;
    } else if (type === 'member-price') {
      group.member = priceVal;
    } else if (type === 'original-price') {
      group.original = priceVal;
    }
  });

  // Calculate statistics using standard price values only
  const standardPrices = prices
    .filter((p) => !p.price_type || p.price_type === 'standard' || p.price_type === 'deal-price')
    .map((p) => typeof p.price === 'string' ? parseFloat(p.price) : p.price)
    .filter((p) => !isNaN(p));

  const minPrice = standardPrices.length > 0 ? Math.min(...standardPrices) : 0;
  const maxPrice = standardPrices.length > 0 ? Math.max(...standardPrices) : 0;
  const avgPrice = standardPrices.length > 0
    ? standardPrices.reduce((sum, p) => sum + p, 0) / standardPrices.length
    : 0;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPrice = (value: number) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return formatter.format(value);
  };

  if (prices.length === 0) {
    return (
      <div className="price-chart-empty">
        <style>{`
          .price-chart-empty {
            background: var(--surface);
            border-radius: 0.75rem;
            padding: 3rem;
            text-align: center;
            color: var(--text-muted);
          }
        `}</style>
        <p>No price history available yet.</p>
      </div>
    );
  }

  return (
    <div className="price-chart">
      <style>{`
        .price-chart {
          background: var(--surface);
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: var(--shadow);
        }

        .price-chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .price-chart-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text);
        }

        .price-chart-range {
          display: flex;
          gap: 0.5rem;
        }

        .price-chart-range button {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .price-chart-range button:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .price-chart-range button.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .price-chart-container {
          height: 300px;
        }

        .price-chart-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .price-stat {
          text-align: center;
        }

        .price-stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .price-stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.25rem;
        }

        .price-stat-value.min {
          color: var(--secondary);
        }

        .price-stat-value.max {
          color: var(--danger);
        }

        .price-stat-value.avg {
          color: var(--primary);
        }

        @media (max-width: 640px) {
          .price-chart-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="price-chart-header">
        <h3 className="price-chart-title">Price History</h3>
        <div className="price-chart-range">
          {DATE_RANGES.map((range) => (
            <button
              key={range.label}
              className={selectedRange === range.value ? 'active' : ''}
              onClick={() => handleRangeChange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="price-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={groupedData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke={themeColors.text}
              fontSize={12}
            />
            <YAxis
              tickFormatter={formatPrice}
              stroke={themeColors.text}
              fontSize={12}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatPrice(value), name]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }
              contentStyle={{
                background: themeColors.tooltip,
                border: `1px solid ${themeColors.tooltipBorder}`,
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <ReferenceLine
              y={avgPrice}
              stroke="#6366f1"
              strokeDasharray="5 5"
              label={{ value: 'Average', fill: '#6366f1', position: 'top', fontSize: 10 }}
            />
            {targetPrice !== undefined && targetPrice !== null && (
              <ReferenceLine
                y={targetPrice}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: `Target: ${formatPrice(targetPrice)}`, fill: '#ef4444', position: 'top', fontSize: 10 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="standard"
              name="Standard Price"
              stroke="#6366f1"
              strokeWidth={2}
              connectNulls={true}
              dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: 'white' }}
            />
            <Line
              type="monotone"
              dataKey="member"
              name="Member Price"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              connectNulls={true}
              dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: 'white' }}
            />
            <Line
              type="monotone"
              dataKey="original"
              name="Original Price (RRP)"
              stroke="#f97316"
              strokeWidth={1.5}
              strokeDasharray="2 2"
              connectNulls={true}
              dot={{ fill: '#f97316', strokeWidth: 0, r: 2 }}
              activeDot={{ r: 4, stroke: '#f97316', strokeWidth: 1, fill: 'white' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="price-chart-stats">
        <div className="price-stat">
          <div className="price-stat-label">Lowest</div>
          <div className="price-stat-value min">{formatPrice(minPrice)}</div>
        </div>
        <div className="price-stat">
          <div className="price-stat-label">Average</div>
          <div className="price-stat-value avg">{formatPrice(avgPrice)}</div>
        </div>
        <div className="price-stat">
          <div className="price-stat-label">Highest</div>
          <div className="price-stat-value max">{formatPrice(maxPrice)}</div>
        </div>
      </div>
    </div>
  );
}
