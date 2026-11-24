import React, { useState } from 'react';
import CollapsibleCard from '../../../../../components/CollapsibleCard';
import Pagination from '../../../../../components/Pagination';
import Icon from '../../../../../components/Icon';
import { formatDate } from '../../../../../utils/format';
import { FlatStockEvent, isAvailableStatus, formatStatusLabel } from './stockTimelineUtils';

interface ItemStockEventListProps {
  events: FlatStockEvent[];
  userLocale?: string | null;
  itemsPerPage?: number;
}

export const ItemStockEventList: React.FC<ItemStockEventListProps> = ({
  events,
  userLocale,
  itemsPerPage = 10,
}) => {
  const [historyPage, setHistoryPage] = useState(1);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  if (events.length === 0) return null;

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const paginatedEvents = events.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  );

  return (
    <CollapsibleCard
      title="Unified Stock Change Log"
      id="item-stock-event-log"
      isExpanded={isHistoryExpanded}
      onToggle={() => setIsHistoryExpanded(!isHistoryExpanded)}
      badge={`${events.length} events`}
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
  );
};
