import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemStockHistoryQuery } from '../../../../api/queries';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import CollapsibleCard from '../../../../components/CollapsibleCard';
import Pagination from '../../../../components/Pagination';
import Icon from '../../../../components/Icon';
import { formatDate, formatPrice } from '../../../../utils/format';
import '../product-detail/ProductDetail.css';
import '../../components/PriceChart/Charts.css';
import './ItemDetail.css';

interface ItemStockSectionProps {
  itemId: number;
  userLocale?: string | null;
}

interface TimelineSegment {
  status: string;
  startPercent: number;
  widthPercent: number;
}

interface FlatStockEvent {
  id: string | number;
  productId: number;
  storeName: string;
  storeUrl: string;
  status: string;
  recordedAt: string;
}

export const ItemStockSection: React.FC<ItemStockSectionProps> = ({ itemId, userLocale }) => {
  const stockQuery = useQuery(itemStockHistoryQuery(itemId, 30));
  const [historyPage, setHistoryPage] = useState(1);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const itemsPerPage = 10;

  const series = stockQuery.data?.series ?? [];
  const item = stockQuery.data?.item;

  // Flatten stock change events across all stores
  const flattenedEvents = useMemo<FlatStockEvent[]>(() => {
    const events: FlatStockEvent[] = [];
    series.forEach(store => {
      if (store.history && store.history.length > 0) {
        store.history.forEach((h: any, idx: number) => {
          events.push({
            id: h.id || `${store.productId}_${idx}_${h.changed_at || h.recorded_at}`,
            productId: store.productId,
            storeName: store.retailerName,
            storeUrl: store.url,
            status: h.status || h.stock_status || store.stockStatus || 'unknown',
            recordedAt: h.changed_at || h.recorded_at || store.stats?.days_in_current_status
              ? new Date().toISOString()
              : new Date().toISOString(),
          });
        });
      }
    });

    return events.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [series]);

  // Compute store timeline segments and synchronized combined timeline
  const { storeTimelines, combinedSegments, overallAvailabilityPercent } = useMemo(() => {
    const timelines: Array<{
      productId: number;
      retailerName: string;
      url: string;
      currentStatus: string;
      segments: TimelineSegment[];
    }> = [];

    series.forEach(store => {
      const segs = computeStoreSegments(store.history, 30, store.stockStatus);
      timelines.push({
        productId: store.productId,
        retailerName: store.retailerName,
        url: store.url,
        currentStatus: store.stockStatus,
        segments: segs,
      });
    });

    // Compute unified combined segments
    const combined = computeCombinedSegments(timelines);
    const inStockTotalWidth = combined
      .filter(s => isAvailableStatus(s.status))
      .reduce((acc, s) => acc + s.widthPercent, 0);

    const percent = Math.round(Math.min(100, Math.max(0, inStockTotalWidth)));

    return {
      storeTimelines: timelines,
      combinedSegments: combined,
      overallAvailabilityPercent: percent,
    };
  }, [series]);

  if (stockQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <LoadingSpinner centered />
      </div>
    );
  }

  if (stockQuery.isError) {
    return (
      <div className="alert alert-error">
        <span>Failed to load combined stock history.</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void stockQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="item-card-panel" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
          <Icon name="package" />
        </div>
        <p style={{ margin: 0 }}>No stores connected to this product yet.</p>
      </div>
    );
  }

  const inStockStores = series.filter(s => isAvailableStatus(s.stockStatus));
  const anyInStock = inStockStores.length > 0;
  const totalPages = Math.ceil(flattenedEvents.length / itemsPerPage);
  const paginatedEvents = flattenedEvents.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  );

  return (
    <div className="item-stock-section">
      {/* 1. Overall Combined Availability Hero */}
      <div className="item-stock-summary-card">
        <div className="item-stock-summary-info">
          <div className="item-stock-summary-title">
            Overall Product Availability
          </div>
          <div className="item-stock-summary-detail">
            Available at {inStockStores.length} of {series.length} {series.length === 1 ? 'store' : 'stores'} · {overallAvailabilityPercent}% combined availability over the last 30 days
          </div>
        </div>
        <div className={`item-stock-summary-badge ${anyInStock ? 'in' : 'out'}`}>
          <Icon name={anyInStock ? 'checkCircle' : 'xCircle'} />
          <span>{anyInStock ? 'In Stock Now' : 'Out of Stock Everywhere'}</span>
        </div>
      </div>

      {/* 2. Synchronized Multi-Store Swimlane Timeline */}
      <div className="stock-timeline-card">
        <div className="stock-timeline-header">
          <span className="stock-timeline-icon"><Icon name="barChart" /></span>
          <h2 className="stock-timeline-title">Synchronized Availability Timeline</h2>
          <span className="stock-timeline-period">Last 30 days</span>
        </div>

        <div className="item-swimlane-container">
          {/* Top Combined Lane */}
          <div className="item-swimlane-row combined-row">
            <div className="item-swimlane-label">
              <span className="item-swimlane-name">Overall (Any Store)</span>
              <span className={`item-swimlane-badge ${anyInStock ? 'good' : 'bad'}`}>
                {overallAvailabilityPercent}% available
              </span>
            </div>
            <div className="item-swimlane-bar-wrapper">
              <div className="stock-timeline-bar combined-bar">
                {combinedSegments.map((segment, index) => (
                  <div
                    key={index}
                    className={`stock-timeline-segment ${segment.status}`}
                    style={{
                      left: `${segment.startPercent}%`,
                      width: `${segment.widthPercent}%`,
                    }}
                    title={`Overall: ${formatStatusLabel(segment.status)}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="item-swimlane-divider" />

          {/* Individual Store Swimlanes */}
          <div className="item-swimlane-stores">
            {storeTimelines.map(store => {
              const isStoreIn = isAvailableStatus(store.currentStatus);
              return (
                <div key={store.productId} className="item-swimlane-row">
                  <div className="item-swimlane-label">
                    <span className="item-swimlane-name" title={store.retailerName}>
                      {store.retailerName}
                    </span>
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="item-swimlane-store-link"
                      title="Open store page"
                    >
                      <Icon name="link" />
                    </a>
                  </div>

                  <div className="item-swimlane-bar-wrapper">
                    <div className="stock-timeline-bar store-bar">
                      {store.segments.map((segment, index) => (
                        <div
                          key={index}
                          className={`stock-timeline-segment ${segment.status}`}
                          style={{
                            left: `${segment.startPercent}%`,
                            width: `${segment.widthPercent}%`,
                          }}
                          title={`${store.retailerName}: ${formatStatusLabel(segment.status)}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="item-swimlane-status">
                    <span className={`status-badge-compact ${isStoreIn ? 'in' : 'out'}`}>
                      {formatStatusLabel(store.currentStatus)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Date Ticks Axis */}
          <div className="item-swimlane-axis">
            <span>30 days ago</span>
            <span>15 days ago</span>
            <span>7 days ago</span>
            <span>Today</span>
          </div>

          {/* Unified Legend */}
          <div className="stock-timeline-legend" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
            <div className="stock-timeline-legend-item">
              <div className="stock-timeline-legend-dot in_stock" />
              <span>In Stock</span>
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
              <span>Unavailable / Unknown</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Store Availability Matrix Table */}
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

      {/* 4. Single Unified Stock History Event Log */}
      {flattenedEvents.length > 0 && (
        <CollapsibleCard
          title="Unified Stock Change Log"
          id="item-stock-event-log"
          isExpanded={isHistoryExpanded}
          onToggle={() => setIsHistoryExpanded(!isHistoryExpanded)}
          badge={`${flattenedEvents.length} events`}
        >
          <div className="item-stock-matrix-table-wrapper">
            <table className="item-stock-matrix-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Store</th>
                  <th>Recorded Status</th>
                  <th style={{ textAlign: 'right' }}>Store Link</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map(event => (
                  <tr key={event.id}>
                    <td style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {formatDate(event.recordedAt, userLocale, true)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {event.storeName}
                    </td>
                    <td>
                      <span className={`item-store-status-pill ${isAvailableStatus(event.status) ? 'in' : 'out'}`}>
                        {formatStatusLabel(event.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={event.storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="item-store-stock-link"
                        title="Open store page"
                      >
                        <Icon name="link" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              page={historyPage}
              totalPages={totalPages}
              setPage={setHistoryPage}
            />
          )}
        </CollapsibleCard>
      )}
    </div>
  );
};

function isAvailableStatus(status?: string): boolean {
  if (!status) return false;
  return status === 'in_stock' || status === 'pre_order' || status === 'member_only';
}

function formatStatusLabel(status?: string): string {
  switch (status) {
    case 'in_stock':
      return 'In Stock';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'pre_order':
      return 'Pre-Order';
    case 'member_only':
      return 'Member Only';
    case 'not_available':
      return 'Unavailable';
    case 'unknown':
      return 'Unknown';
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown';
  }
}

/**
 * Computes percentage-based timeline segments for a single store over `days`
 */
function computeStoreSegments(history: any[] | undefined, days: number = 30, fallbackStatus: string = 'in_stock'): TimelineSegment[] {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const totalMs = now.getTime() - periodStart.getTime();

  if (!history || history.length === 0) {
    return [{ status: fallbackStatus || 'in_stock', startPercent: 0, widthPercent: 100 }];
  }

  const sorted = [...history].sort((a, b) => {
    const tA = new Date(a.recorded_at || a.changed_at || 0).getTime();
    const tB = new Date(b.recorded_at || b.changed_at || 0).getTime();
    return tA - tB;
  });

  const segments: TimelineSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const entryTime = new Date(entry.recorded_at || entry.changed_at || now);
    const nextEntry = sorted[i + 1];
    const nextTime = nextEntry ? new Date(nextEntry.recorded_at || nextEntry.changed_at || now) : now;

    const segmentStart = entryTime < periodStart ? periodStart : entryTime;
    const segmentEnd = nextTime;

    if (segmentEnd <= periodStart) continue;

    const startPercent = ((segmentStart.getTime() - periodStart.getTime()) / totalMs) * 100;
    const widthPercent = ((segmentEnd.getTime() - segmentStart.getTime()) / totalMs) * 100;

    segments.push({
      status: entry.stock_status || entry.status || fallbackStatus,
      startPercent: Math.max(0, startPercent),
      widthPercent: Math.min(100 - startPercent, widthPercent),
    });
  }

  if (segments.length === 0) {
    return [{ status: fallbackStatus || 'in_stock', startPercent: 0, widthPercent: 100 }];
  }

  if (segments[0].startPercent > 0) {
    segments.unshift({
      status: segments[0].status,
      startPercent: 0,
      widthPercent: segments[0].startPercent,
    });
  }

  return segments;
}

/**
 * Computes the unified combined product availability timeline
 * (In stock if ANY store has stock at time t, Out of stock if ALL stores are out of stock)
 */
function computeCombinedSegments(
  storeTimelines: Array<{ segments: TimelineSegment[] }>
): TimelineSegment[] {
  if (storeTimelines.length === 0) {
    return [{ status: 'unknown', startPercent: 0, widthPercent: 100 }];
  }

  // Gather all transition points (percentages between 0 and 100)
  const cuts = new Set<number>([0, 100]);
  storeTimelines.forEach(st => {
    st.segments.forEach(seg => {
      cuts.add(Math.max(0, Math.min(100, seg.startPercent)));
      cuts.add(Math.max(0, Math.min(100, seg.startPercent + seg.widthPercent)));
    });
  });

  const sortedCuts = Array.from(cuts).sort((a, b) => a - b);
  const rawIntervals: TimelineSegment[] = [];

  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const start = sortedCuts[i];
    const end = sortedCuts[i + 1];
    const width = end - start;
    if (width < 0.05) continue;

    const mid = (start + end) / 2;

    // Check availability across all stores at mid
    let anyIn = false;
    let anyPreOrder = false;
    let allOut = true;

    storeTimelines.forEach(st => {
      const activeSeg = st.segments.find(s => mid >= s.startPercent && mid <= s.startPercent + s.widthPercent);
      const status = activeSeg?.status || 'unknown';
      if (status === 'in_stock' || status === 'member_only') {
        anyIn = true;
        allOut = false;
      } else if (status === 'pre_order') {
        anyPreOrder = true;
        allOut = false;
      } else if (status !== 'out_of_stock') {
        allOut = false;
      }
    });

    const combinedStatus = anyIn ? 'in_stock' : anyPreOrder ? 'pre_order' : allOut ? 'out_of_stock' : 'unknown';

    rawIntervals.push({
      status: combinedStatus,
      startPercent: start,
      widthPercent: width,
    });
  }

  // Merge adjacent intervals with matching status
  const merged: TimelineSegment[] = [];
  rawIntervals.forEach(curr => {
    const prev = merged[merged.length - 1];
    if (prev && prev.status === curr.status) {
      prev.widthPercent += curr.widthPercent;
    } else {
      merged.push({ ...curr });
    }
  });

  return merged.length > 0 ? merged : [{ status: 'in_stock', startPercent: 0, widthPercent: 100 }];
}

export default ItemStockSection;
