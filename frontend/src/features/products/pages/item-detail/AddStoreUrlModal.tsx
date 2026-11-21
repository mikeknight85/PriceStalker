import React, { useState } from 'react';
import { ProductService } from '../../services/ProductService';
import { useToast } from '../../../../context/ToastContext';
import './ItemDetail.css';

interface AddStoreUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemName: string;
  onSuccess: () => void;
}

export const AddStoreUrlModal: React.FC<AddStoreUrlModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      await ProductService.create({
        url: url.trim(),
        itemId,
      });
      showToast('Store added to product successfully!', 'success');
      setUrl('');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.response?.data?.error || err?.message || 'Failed to add store URL', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="item-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <h2 className="item-modal-title">Add Store to Product</h2>
        <p className="item-modal-subtitle">
          Paste a retailer URL selling <strong>{itemName}</strong> to compare its pricing and stock.
        </p>

        <form onSubmit={handleSubmit} className="item-modal-form">
          <div className="form-group">
            <label htmlFor="store-url" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text)' }}>
              Store URL
            </label>
            <input
              id="store-url"
              type="url"
              className="form-control"
              placeholder="https://retailer.example.com/product/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
            />
          </div>

          <div className="item-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !url.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStoreUrlModal;
