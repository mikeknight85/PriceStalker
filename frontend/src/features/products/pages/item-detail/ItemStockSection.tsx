import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemStockHistoryQuery } from '../../../../api/queries';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import '../../components/PriceChart/Charts.css';
import './ItemDetail.css';

import {
  FlatStockEvent,
  TimelineSegment,
  isAvailableStatus,
  computeStoreSegments,
  computeCombinedSegments,
} from './stock/stockTimelineUtils';
import { ItemStockSwimlane } from './stock/ItemStockSwimlane';
import { ItemStockMatrix } from './stock/ItemStockMatrix';
import { ItemStockEventList } from './stock/ItemStockEventList';

interface ItemStockSectionProps {
  itemId: number;
  userLocale?: string | null;
}

export const ItemStockSection: React.FC<ItemStockSectionProps> = ({ itemId, userLocale }) => {
  const stockQuery = useQuery(itemStockHistoryQuery(itemId, 30));

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
            recordedAt: h.changed_at || h.recorded_at || new Date().toISOString(),
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
        currentStatus: store.stockStatus || 'unknown',
        segments: segs,
      });
    });

    const combined = computeCombinedSegments(timelines);

    // Calculate overall availability percentage
    const totalMs = 30 * 24 * 60 * 60 * 1000;
    let availableMs = 0;
    combined.forEach(seg => {
      if (seg.status === 'in_stock' || seg.status === 'member_only' || seg.status === 'pre_order') {
        availableMs += (seg.widthPercent / 100) * totalMs;
      }
    });
    const availabilityPercent = Math.round((availableMs / totalMs) * 100);

    return {
      storeTimelines: timelines,
      combinedSegments: combined,
      overallAvailabilityPercent: availabilityPercent,
    };
  }, [series]);

  if (stockQuery.isLoading) {
    return (
      <div className="item-card-panel" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <LoadingSpinner />
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

  return (
    <div className="item-stock-section">
      <ItemStockSwimlane
        overallAvailabilityPercent={overallAvailabilityPercent}
        anyInStock={anyInStock}
        inStockStoreCount={inStockStores.length}
        totalStoreCount={series.length}
        combinedSegments={combinedSegments}
        storeTimelines={storeTimelines}
      />

      <ItemStockMatrix
        series={series}
        item={item}
        userLocale={userLocale}
      />

      <ItemStockEventList
        events={flattenedEvents}
        userLocale={userLocale}
      />
    </div>
  );
};

export default ItemStockSection;
