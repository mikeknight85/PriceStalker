import React from 'react';
import Icon from '../../../../../components/Icon';
import { TimelineSegment, formatStatusLabel, isAvailableStatus } from './stockTimelineUtils';

interface StoreTimelineItem {
  productId: number;
  retailerName: string;
  url: string;
  currentStatus: string;
  segments: TimelineSegment[];
}

interface ItemStockSwimlaneProps {
  overallAvailabilityPercent: number;
  anyInStock: boolean;
  inStockStoreCount: number;
  totalStoreCount: number;
  combinedSegments: TimelineSegment[];
  storeTimelines: StoreTimelineItem[];
}

export const ItemStockSwimlane: React.FC<ItemStockSwimlaneProps> = ({
  overallAvailabilityPercent,
  anyInStock,
  inStockStoreCount,
  totalStoreCount,
  combinedSegments,
  storeTimelines,
}) => {
  return (
    <>
      {/* 1. Overall Combined Availability Hero */}
      <div className="item-stock-summary-card">
        <div className="item-stock-summary-info">
          <div className="item-stock-summary-title">
            Overall Product Availability
          </div>
          <div className="item-stock-summary-detail">
            Available at {inStockStoreCount} of {totalStoreCount} {totalStoreCount === 1 ? 'store' : 'stores'} · {overallAvailabilityPercent}% combined availability over the last 30 days
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
            <div className="item-swimlane-status">
              <span className={`status-badge-compact ${anyInStock ? 'in' : 'out'}`}>
                {anyInStock ? 'In Stock' : 'Out of Stock'}
              </span>
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
          <div className="item-swimlane-axis-row">
            <div className="item-swimlane-axis-spacer" />
            <div className="item-swimlane-axis">
              <span>30 days ago</span>
              <span>15 days ago</span>
              <span>7 days ago</span>
              <span>Today</span>
            </div>
            <div className="item-swimlane-axis-spacer-right" />
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
    </>
  );
};
