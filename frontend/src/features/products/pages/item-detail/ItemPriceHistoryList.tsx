import React, { useState, useMemo } from 'react';
import { formatDate, formatPrice } from '../../../../utils/format';
import Pagination from '../../../../components/Pagination';
import CollapsibleCard from '../../../../components/CollapsibleCard';
import AIStatusBadge from '../../../../components/AIStatusBadge';
import Icon from '../../../../components/Icon';
import '../../components/PriceHistoryList.css';

interface StoreSeries {
  productId: number;
  retailerName: string;
  url: string;
  currency: string;
  prices: any[];
}

interface ItemPriceHistoryListProps {
  series: StoreSeries[];
  userLocale?: string | null;
}

interface FlatPriceEntry {
  id: string | number;
  productId: number;
  storeName: string;
  storeUrl: string;
  price: number;
  currency: string;
  priceType: string;
  aiStatus: any;
  recordedAt: string;
}

export const ItemPriceHistoryList: React.FC<ItemPriceHistoryListProps> = ({
  series,
  userLocale,
}) => {
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const itemsPerPage = 10;

  // Flatten and sort history across all stores newest first
  const sortedHistory = useMemo<FlatPriceEntry[]>(() => {
    const all: FlatPriceEntry[] = [];
    series.forEach(s => {
      s.prices.forEach((p, idx) => {
        const val = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
        if (!Number.isFinite(val)) return;

        all.push({
          id: p.id || `${s.productId}_${idx}_${p.recorded_at}`,
          productId: s.productId,
          storeName: s.retailerName,
          storeUrl: s.url,
          price: val,
          currency: p.currency || s.currency || 'USD',
          priceType: p.price_type || 'standard',
          aiStatus: p.ai_status,
          recordedAt: p.recorded_at,
        });
      });
    });

    return all.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [series]);

  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedHistory.slice(start, start + itemsPerPage);
  }, [sortedHistory, page]);

  const handleToggle = () => setIsExpanded(!isExpanded);

  const getMethodLabel = (method: string | null | undefined) => {
    if (!method) return 'Standard';
    switch (method) {
      case 'deal-price': return 'Deal';
      case 'member-price': return 'Member';
      case 'original-price': return 'Retail';
      case 'pre-order': return 'Pre-Order';
      default: return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  if (sortedHistory.length === 0) return null;

  return (
    <div className="price-history-list-container">
      <CollapsibleCard
        title="Detailed Price History"
        id="item-price-history-details"
        isExpanded={isExpanded}
        onToggle={handleToggle}
        badge={`${sortedHistory.length} recordings`}
      >
        <div className="price-history-table-wrapper">
          <table className="price-history-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Store</th>
                <th>Price</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map(entry => (
                <tr key={entry.id}>
                  <td className="date-cell">
                    {formatDate(entry.recordedAt, userLocale, true)}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text)' }}>{entry.storeName}</span>
                      <a
                        href={entry.storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                        title="Open store page"
                      >
                        <Icon name="link" />
                      </a>
                    </div>
                  </td>
                  <td className="price-cell">
                    {formatPrice(entry.price, entry.currency, userLocale)}
                  </td>
                  <td className="method-cell">
                    <span className={`method-badge ${entry.priceType || 'standard'}`}>
                      {getMethodLabel(entry.priceType)}
                    </span>
                  </td>
                  <td className="status-cell">
                    <AIStatusBadge status={entry.aiStatus} size="small" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
          />
        )}
      </CollapsibleCard>
    </div>
  );
};

export default ItemPriceHistoryList;
