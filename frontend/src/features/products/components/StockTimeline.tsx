import React from 'react';
import { StockStatusHistoryEntry, StockStatusStats } from '../../../types/api';
import './PriceChart/Charts.css';
import Icon from '../../../components/Icon';

interface StockTimelineProps {
  history: StockStatusHistoryEntry[];
  stats: StockStatusStats;
  days?: number;
}

const StockTimeline: React.FC<StockTimelineProps> = ({ history, stats, days = 30 }) => {
  if (!stats || !history || history.length === 0) {
    return null;
  }

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const totalMs = now.getTime() - periodStart.getTime();

  const segments: { status: string; startPercent: number; widthPercent: number }[] = [];

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const entryTime = new Date(entry.recorded_at || entry.changed_at || now);
    const nextEntry = history[i + 1];
    const nextTime = nextEntry ? new Date(nextEntry.recorded_at || nextEntry.changed_at || now) : now;

    const segmentStart = entryTime < periodStart ? periodStart : entryTime;
    const segmentEnd = nextTime;

    if (segmentEnd <= periodStart) continue;

    const startPercent = ((segmentStart.getTime() - periodStart.getTime()) / totalMs) * 100;
    const widthPercent = ((segmentEnd.getTime() - segmentStart.getTime()) / totalMs) * 100;

    segments.push({
      status: entry.stock_status || entry.status || 'unknown',
      startPercent: Math.max(0, startPercent),
      widthPercent: Math.min(100 - startPercent, widthPercent),
    });
  }

  // Post-process segments from right to left to enforce a minimum width for visibility near the end
  const MIN_SEG_WIDTH = 1.5; // 1.5% minimum width
  let rightBoundary = 100;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const originalWidth = seg.widthPercent;
    const isNearEnd = rightBoundary > 85;
    const targetWidth = isNearEnd ? Math.max(MIN_SEG_WIDTH, originalWidth) : originalWidth;
    seg.widthPercent = targetWidth;
    seg.startPercent = Math.max(0, rightBoundary - targetWidth);
    rightBoundary = seg.startPercent;
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'In Stock';
      case 'out_of_stock': return 'Out of Stock';
      case 'pre_order': return 'Pre-Order';
      case 'member_only': return 'Member Only';
      case 'not_available': return 'Not Available';
      default: return 'Unknown';
    }
  };

  return (
    <div className="stock-timeline-card">
      <div className="stock-timeline-header">
        <span className="stock-timeline-icon"><Icon name="barChart" /></span>
        <h2 className="stock-timeline-title">Stock Availability</h2>
        <span className="stock-timeline-period">Last {days} days</span>
      </div>

      <div className="stock-timeline-bar-container">
        <div className="stock-timeline-bar">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`stock-timeline-segment ${segment.status}`}
              style={{
                left: `${segment.startPercent}%`,
                width: `${segment.widthPercent}%`,
              }}
              title={getStatusLabel(segment.status)}
            />
          ))}
        </div>
        <div className="stock-timeline-legend">
          <div className="stock-timeline-legend-item">
            <div className="stock-timeline-legend-dot in_stock" />
            <span>In Stock</span>
          </div>
          <div className="stock-timeline-legend-item">
            <div className="stock-timeline-legend-dot member_only" />
            <span>Member Only</span>
          </div>
          <div className="stock-timeline-legend-item">
            <div className="stock-timeline-legend-dot pre_order" />
            <span>Pre-Order</span>
          </div>
          <div className="stock-timeline-legend-item">
            <div className="stock-timeline-legend-dot out_of_stock" />
            <span>Out of Stock</span>
          </div>
          <div className="stock-timeline-legend-item">
            <div className="stock-timeline-legend-dot not_available" />
            <span>Not Available</span>
          </div>
        </div>
      </div>

      <div className="stock-timeline-stats">
        <div className="stock-timeline-stat">
          <div className={`stock-timeline-stat-value ${(stats.availability_percent ?? 0) >= 80 ? 'good' : (stats.availability_percent ?? 0) >= 50 ? 'neutral' : 'bad'}`}>
            {stats.availability_percent ?? 0}%
          </div>
          <div className="stock-timeline-stat-label">Availability</div>
        </div>

        <div className="stock-timeline-stat">
          <div className={`stock-timeline-stat-value ${(stats.outage_count ?? 0) === 0 ? 'good' : (stats.outage_count ?? 0) <= 2 ? 'neutral' : 'bad'}`}>
            {stats.outage_count ?? 0}
          </div>
          <div className="stock-timeline-stat-label">Times Out of Stock</div>
        </div>

        {stats.avg_outage_days !== null && stats.avg_outage_days !== undefined && (
          <div className="stock-timeline-stat">
            <div className="stock-timeline-stat-value neutral">
              {stats.avg_outage_days}d
            </div>
            <div className="stock-timeline-stat-label">Avg Outage</div>
          </div>
        )}

        {stats.longest_outage_days !== null && stats.longest_outage_days !== undefined && (
          <div className="stock-timeline-stat">
            <div className="stock-timeline-stat-value neutral">
              {stats.longest_outage_days}d
            </div>
            <div className="stock-timeline-stat-label">Longest Outage</div>
          </div>
        )}

        <div className="stock-timeline-stat">
          <div className={`stock-timeline-stat-value ${stats.current_status === 'in_stock' || stats.current_status === 'member_only' ? 'good' : stats.current_status === 'pre_order' ? 'neutral' : 'bad'}`}>
            {stats.days_in_current_status ?? 0}d
          </div>
          <div className="stock-timeline-stat-label">
            {getStatusLabel(stats.current_status || 'unknown')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockTimeline;
