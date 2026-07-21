import React, { useState, useMemo } from 'react';
import { PriceHistory } from '../../../types/api';
import { formatDate, formatPrice } from '../../../utils/format';
import Pagination from '../../../components/Pagination';
import CollapsibleCard from '../../../components/CollapsibleCard';
import AIStatusBadge from '../../../components/AIStatusBadge';
import './PriceHistoryList.css';

interface PriceHistoryListProps {
  history: PriceHistory[];
  currency: string;
  locale?: string;
}

const PriceHistoryList: React.FC<PriceHistoryListProps> = ({ 
  history, 
  currency, 
  locale = 'en-US' 
}) => {
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const itemsPerPage = 10;

  // Sort history newest first
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => 
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );
  }, [history]);

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

  return (
    <div className="price-history-list-container">
      <CollapsibleCard 
        title="Detailed Price History" 
        id="price-history-details" 
        isExpanded={isExpanded} 
        onToggle={handleToggle}
        badge={`${history.length} recordings`}
      >
        <div className="price-history-table-wrapper">
          <table className="price-history-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Price</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map((entry) => (
                <tr key={entry.id}>
                  <td className="date-cell">
                    {formatDate(entry.recorded_at, locale, true)}
                  </td>
                  <td className="price-cell">
                    {formatPrice(entry.price, currency, locale)}
                  </td>
                  <td className="method-cell">
                    <span className={`method-badge ${entry.price_type || 'standard'}`}>
                      {getMethodLabel(entry.price_type)}
                    </span>
                  </td>
                  <td className="status-cell">
                    <AIStatusBadge status={entry.ai_status} size="small" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination 
          page={page} 
          totalPages={totalPages} 
          setPage={setPage} 
        />
      </CollapsibleCard>
    </div>
  );
};

export default PriceHistoryList;
