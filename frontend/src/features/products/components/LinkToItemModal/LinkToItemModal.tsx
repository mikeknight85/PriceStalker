import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemListQuery } from '../../../../api/queries';
import { ItemWithListings } from '../../../../types/api';
import { formatPrice } from '../../../../utils/format';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import { useAuth } from '../../../auth';
import './LinkToItemModal.css';

interface LinkToItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The store being linked. */
  productId: number;
  productName: string;
  onConfirm: (itemId: number) => Promise<void>;
}

/**
 * Picks which product a store belongs to -- "these two are the same thing"
 * (issue #143).
 *
 * Lists products the user already tracks. The store's own product is excluded,
 * because linking something to where it already is is not a choice worth
 * offering.
 */
const LinkToItemModal: React.FC<LinkToItemModalProps> = ({
  isOpen, onClose, productId, productName, onConfirm,
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<number | null>(null);
  const itemsQuery = useQuery({ ...itemListQuery(), enabled: isOpen });

  const candidates = useMemo(() => {
    const all: ItemWithListings[] = itemsQuery.data ?? [];
    return all
      // Exclude the product this store already belongs to.
      .filter(item => !item.listings.some(l => l.id === productId))
      .filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()));
  }, [itemsQuery.data, productId, search]);

  if (!isOpen) return null;

  const choose = async (itemId: number) => {
    setPending(itemId);
    try {
      await onConfirm(itemId);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal link-item-modal" onClick={e => e.stopPropagation()}>
        <h2 className="link-item-title">Which product is this the same as?</h2>
        <p className="link-item-subtitle">
          <strong>{productName}</strong> becomes another store for whichever product you pick, and
          they share one price comparison and one set of alerts from then on.
        </p>

        <input
          type="text"
          className="form-control"
          placeholder="Search your products"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        {itemsQuery.isLoading ? (
          <LoadingSpinner centered />
        ) : itemsQuery.isError ? (
          <div className="link-item-empty">Your products could not be loaded.</div>
        ) : candidates.length === 0 ? (
          <div className="link-item-empty">
            {search
              ? 'Nothing matches that.'
              : 'You are not tracking anything else yet, so there is nothing to link this to.'}
          </div>
        ) : (
          <div className="link-item-list">
            {candidates.map(item => (
              <button
                key={item.id}
                type="button"
                className="link-item-option"
                onClick={() => void choose(item.id)}
                disabled={pending !== null}
              >
                <span className="link-item-option-name">{item.name}</span>
                <span className="link-item-option-meta">
                  {item.store_count === 1 ? '1 store' : `${item.store_count} stores`}
                  {item.best_price !== null && (
                    <> &middot; {formatPrice(item.best_price, item.best_price_currency, user?.locale ?? undefined)}</>
                  )}
                </span>
                {pending === item.id && <LoadingSpinner size="1rem" />}
              </button>
            ))}
          </div>
        )}

        <div className="link-item-footer">
          {/*
            Said before the choice rather than after: the alert settings on this
            store's current product are dropped when it joins another, and
            finding that out when an alert stops arriving would be worse.
          */}
          <div className="link-item-note">
            <Icon name="alertTriangle" />
            Any target price or alert set on <strong>{productName}</strong> alone is replaced by the
            settings of the product you choose.
          </div>
          <button className="btn btn-secondary" onClick={onClose} disabled={pending !== null}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default LinkToItemModal;
