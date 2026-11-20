import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productListQuery } from '../../../../api/queries';
import { Product } from '../../../../types/api';
import { formatPrice } from '../../../../utils/format';
import Icon from '../../../../components/Icon';
import LoadingSpinner from '../../../../components/LoadingSpinner';

interface AttachStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemName: string;
  alreadyAttachedIds: number[];
  onAttach: (productId: number) => Promise<void>;
}

export const AttachStoreModal: React.FC<AttachStoreModalProps> = ({
  isOpen,
  onClose,
  itemId: _itemId,
  itemName,
  alreadyAttachedIds,
  onAttach,
}) => {
  const [search, setSearch] = useState('');
  const [attachingId, setAttachingId] = useState<number | null>(null);
  const productsQuery = useQuery({ ...productListQuery(), enabled: isOpen });

  const candidates = useMemo(() => {
    const all: Product[] = Array.isArray(productsQuery.data) ? productsQuery.data : [];
    return all
      .filter(p => !alreadyAttachedIds.includes(p.id))
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) || p.url.toLowerCase().includes(q);
      });
  }, [productsQuery.data, alreadyAttachedIds, search]);

  if (!isOpen) return null;

  const handleSelect = async (productId: number) => {
    setAttachingId(productId);
    try {
      await onAttach(productId);
      onClose();
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal link-item-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h2 className="link-item-title">Link Existing Store to Product</h2>
        <p className="link-item-subtitle">
          Attach another store you already track to <strong>{itemName}</strong> to compare prices together.
        </p>

        <div className="search-container" style={{ margin: '1rem 0' }}>
          <span className="search-icon"><Icon name="search" /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search your tracked stores..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="link-item-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {productsQuery.isLoading ? (
            <LoadingSpinner centered />
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              No eligible stores found to attach.
            </div>
          ) : (
            candidates.map(store => (
              <div
                key={store.id}
                className="link-item-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderBottom: '1px solid var(--border)',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {store.name || store.url}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {store.retailer_name ? `${store.retailer_name} · ` : ''}{store.url}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '0 0 auto' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {store.current_price !== null ? formatPrice(store.current_price, store.currency) : '—'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSelect(store.id)}
                    disabled={attachingId !== null}
                  >
                    {attachingId === store.id ? 'Attaching...' : 'Attach'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="item-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttachStoreModal;
