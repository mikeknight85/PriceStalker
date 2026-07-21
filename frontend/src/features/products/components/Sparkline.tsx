import React, { useMemo } from 'react';
import { SparklinePoint } from '../../../types/api';
import './PriceChart/Charts.css';

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
  showTrend?: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 40,
  color,
  showTrend = true,
}) => {
  const gradientId = useMemo(() => `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  // Handle empty or sparse data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length === 1) {
      // Synthesize a second point to create a horizontal line
      return [data[0], { ...data[0], recorded_at: new Date().toISOString() }];
    }
    return data;
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="sparkline-container">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <line 
            x1="4" y1={height / 2} 
            x2={width - 4} y2={height / 2} 
            stroke="var(--text-muted)" 
            strokeWidth="1" 
            strokeDasharray="4 2" 
            opacity="0.3"
          />
        </svg>
      </div>
    );
  }

  const prices = chartData.map((d) =>
    typeof d.price === 'string' ? parseFloat(d.price) : d.price
  );
  let minPrice = Math.min(...prices);
  let maxPrice = Math.max(...prices);
  
  if (minPrice === maxPrice) {
    minPrice = minPrice * 0.95; // 5% lower
    maxPrice = maxPrice * 1.05; // 5% higher
    if (minPrice === maxPrice) {
      // Handle exactly 0
      minPrice = -1;
      maxPrice = 1;
    }
  }
  
  const priceRange = maxPrice - minPrice;

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const trend = lastPrice < firstPrice ? 'down' : lastPrice > firstPrice ? 'up' : 'flat';

  const lineColor = color || (trend === 'down' ? '#10b981' : trend === 'up' ? '#ef4444' : '#6366f1');

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = prices.map((price, index) => {
    const x = padding + (index / (prices.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const fillD = `M ${points.join(' L ')} L ${padding + chartWidth},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`;

  return (
    <div className="sparkline-container">
      <svg
        className="sparkline-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d={fillD}
          fill={`url(#${gradientId})`}
        />
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={padding + chartWidth}
          cy={padding + chartHeight - ((lastPrice - minPrice) / priceRange) * chartHeight}
          r="3"
          fill={lineColor}
        />
      </svg>
      {showTrend && (
        <span className={`sparkline-trend ${trend}`}>
          {trend === 'down' && '↓'}
          {trend === 'up' && '↑'}
          {trend === 'flat' && '→'}
        </span>
      )}
    </div>
  );
};

export default Sparkline;
