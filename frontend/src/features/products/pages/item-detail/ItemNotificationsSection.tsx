import React, { useState } from 'react';
import { ItemWithListings } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import Icon from '../../../../components/Icon';

interface ItemNotificationsSectionProps {
  item: ItemWithListings;
  onSave: (updates: {
    target_price?: number | null;
    price_drop_threshold?: number | null;
    notify_back_in_stock?: boolean;
  }) => Promise<void>;
}

export const ItemNotificationsSection: React.FC<ItemNotificationsSectionProps> = ({
  item,
  onSave,
}) => {
  const { showToast } = useToast();
  const [targetPrice, setTargetPrice] = useState<string>(
    item.target_price !== null && item.target_price !== undefined ? String(item.target_price) : ''
  );
  const [dropThreshold, setDropThreshold] = useState<string>(
    item.price_drop_threshold !== null && item.price_drop_threshold !== undefined
      ? String(item.price_drop_threshold)
      : ''
  );
  const [backInStock, setBackInStock] = useState<boolean>(item.notify_back_in_stock || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedTarget = targetPrice.trim() === '' ? null : parseFloat(targetPrice);
      const parsedDrop = dropThreshold.trim() === '' ? null : parseFloat(dropThreshold);

      await onSave({
        target_price: Number.isFinite(parsedTarget) ? parsedTarget : null,
        price_drop_threshold: Number.isFinite(parsedDrop) ? parsedDrop : null,
        notify_back_in_stock: backInStock,
      });
      showToast('Product alert settings saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save alert settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="item-card-panel" style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Icon name="bell" size="1.4rem" />
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>
            Product Alerts & Notifications
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Configure alerts for <strong>{item.name}</strong>. These settings monitor across all {item.store_count} stores.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label htmlFor="target-price" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
            Target Price ({item.best_price_currency || 'USD'})
          </label>
          <input
            id="target-price"
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            placeholder="e.g. 49.99"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
            style={{ width: '100%', maxWidth: '300px' }}
          />
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
            Get notified whenever any store drops to or below this target price.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="drop-threshold" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
            Price Drop Threshold ({item.best_price_currency || 'USD'})
          </label>
          <input
            id="drop-threshold"
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            placeholder="e.g. 5.00"
            value={dropThreshold}
            onChange={e => setDropThreshold(e.target.value)}
            style={{ width: '100%', maxWidth: '300px' }}
          />
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
            Notify if any store drops by at least this amount in a single check.
          </small>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <input
            id="back-in-stock"
            type="checkbox"
            checked={backInStock}
            onChange={e => setBackInStock(e.target.checked)}
            style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="back-in-stock" style={{ fontWeight: 600, margin: 0, cursor: 'pointer' }}>
            Notify when back in stock at any store
          </label>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            <Icon name="save" /> {isSaving ? 'Saving...' : 'Save Alert Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ItemNotificationsSection;
