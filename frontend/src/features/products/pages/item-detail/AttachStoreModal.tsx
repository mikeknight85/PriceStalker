import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemListQuery } from '../../../../api/queries';
import { ItemWithListings } from '../../../../types/api';
import { formatPrice } from '../../../../utils/format';
import Icon from '../../../../components/Icon';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import './ItemDetail.css';

interface AttachStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemName: string;
  onAttach: (sourceItemId: number) => Promise<void>;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const AttachStoreModal: React.FC<AttachStoreModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  onAttach,
}) => {
  const [search, setSearch] = useState('');
  const [attachingId, setAttachingId] = useState<number | null>(null);
  const itemsQuery = useQuery({ ...itemListQuery(), enabled: isOpen });

  const candidates = useMemo(() => {
    const all: ItemWithListings[] = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
    return all
      .filter(item => item.id !== itemId)
      .filter(item => {
        if (!search) return true;
        const q = search.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesListing = item.listings?.some(
          l => (l.name || '').toLowerCase().includes(q) ||
               (l.retailer_name || '').toLowerCase().includes(q) ||
               l.url.toLowerCase().includes(q)
        );
        return matchesName || matchesListing;
      });
  }, [itemsQuery.data, itemId, search]);

  if (!isOpen) return null;

  const handleSelect = async (sourceItemId: number) => {
    setAttachingId(sourceItemId);
    try {
      await onAttach(sourceItemId);
      onClose();
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="item-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <h2 className="item-modal-title">Attach Products / Stores</h2>
        <p className="item-modal-subtitle">
          Merge another tracked product and all its store listings into <strong>{itemName}</strong> to compare prices together.
        </p>

        <div className="search-container" style={{ margin: '1rem 0' }}>
          <span className="search-icon"><Icon name="search" /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search tracked products by name, store or URL..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="link-item-list" style={{ maxHeight: '340px', overflowY: 'auto' }}>
          {itemsQuery.isLoading ? (
            <LoadingSpinner centered />
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              No other products found to attach.
            </div>
          ) : (
            candidates.map(candidate => {
              const storeListText = (candidate.listings || [])
                .map(l => l.retailer_name || hostOf(l.url))
                .filter(Boolean)
                .slice(0, 3)
                .join(', ');
              const storeCount = candidate.store_count || (candidate.listings?.length ?? 1);

              return (
                <div
                  key={candidate.id}
                  className="link-item-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.375rem',
                      overflow: 'hidden',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {candidate.image_url ? (
                        <img
                          src={candidate.image_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <Icon name="package" size="1.2rem" />
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {candidate.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {storeCount} {storeCount === 1 ? 'store' : 'stores'}{storeListText ? ` (${storeListText})` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '0 0 auto' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {candidate.best_price !== null && candidate.best_price !== undefined
                        ? formatPrice(candidate.best_price, candidate.best_price_currency)
                        : '—'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSelect(candidate.id)}
                      disabled={attachingId !== null}
                    >
                      {attachingId === candidate.id
                        ? 'Merging...'
                        : storeCount > 1
                        ? `Merge ${storeCount} stores`
                        : 'Attach store'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="item-modal-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttachStoreModal;
