import React, { useState, useMemo } from 'react';
import { StockStatusHistoryEntry } from '../../../types/api';
import { formatDate } from '../../../utils/format';
import Pagination from '../../../components/Pagination';
import CollapsibleCard from '../../../components/CollapsibleCard';
import './StockHistoryList.css';

interface StockHistoryListProps {
  history: StockStatusHistoryEntry[];
  locale?: string;
}

const StockHistoryList: React.FC<StockHistoryListProps> = ({ 
  history, 
  locale = 'en-US' 
}) => {
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const itemsPerPage = 10;

  // Sort history newest first
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => 
      new Date(b.recorded_at || b.changed_at || '').getTime() - new Date(a.recorded_at || a.changed_at || '').getTime()
    );
  }, [history]);

  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);
  
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedHistory.slice(start, start + itemsPerPage);
  }, [sortedHistory, page]);

  const handleToggle = () => setIsExpanded(!isExpanded);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'In Stock';
      case 'out_of_stock': return 'Out of Stock';
      case 'pre_order': return 'Pre-Order';
      case 'member_only': return 'Member Only';
      case 'not_available': return 'Unavailable';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="stock-history-list-container">
      <CollapsibleCard 
        title="Detailed Stock History" 
        id="stock-history-details" 
        isExpanded={isExpanded} 
        onToggle={handleToggle}
        badge={`${history.length} recordings`}
      >
        <div className="stock-history-table-wrapper">
          <table className="stock-history-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map((entry, index) => {
                const statusValue = entry.stock_status || entry.status || 'unknown';
                return (
                  <tr key={entry.id || index}>
                    <td className="date-cell">
                      {formatDate(entry.recorded_at || entry.changed_at, locale, true)}
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${statusValue}`}>
                        {getStatusLabel(statusValue)}
                      </span>
                    </td>
                  </tr>
                );
              })}
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

export default StockHistoryList;
