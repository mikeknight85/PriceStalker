import React, { useState } from 'react';
import { ItemWithListings } from '../../../../types/api';
import Icon from '../../../../components/Icon';
import ItemStoreCard from './ItemStoreCard';
import AddStoreUrlModal from './AddStoreUrlModal';
import AttachStoreModal from './AttachStoreModal';
import { ItemOverviewSidebar } from './overview/ItemOverviewSidebar';
import { ItemOverviewHeader } from './overview/ItemOverviewHeader';
import './ItemDetail.css';

interface ItemOverviewSectionProps {
  item: ItemWithListings;
  userLocale?: string | null;
  onRefreshListing: (productId: number) => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onDetachListing: (productId: number) => Promise<void>;
  onDeleteListing: (productId: number) => void;
  onAttachStore: (sourceItemId: number) => Promise<void>;
  onSaveName: (name: string) => Promise<void>;
  onSaveImage: (imageUrl: string | null) => Promise<void>;
  onSaveTags: (tags: string[]) => Promise<void>;
  onReload: () => void;
}

export const ItemOverviewSection: React.FC<ItemOverviewSectionProps> = ({
  item,
  userLocale,
  onRefreshListing,
  onRefreshAll,
  onDetachListing,
  onDeleteListing,
  onAttachStore,
  onSaveName,
  onSaveImage,
  onSaveTags,
  onReload,
}) => {
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);

  const currency = item.best_price_currency || 'USD';

  // Stock counts (available = in stock, pre-order, member only)
  const inStockCount = item.listings.filter(
    l => l.stock_status === 'in_stock' || l.stock_status === 'pre_order' || l.stock_status === 'member_only'
  ).length;

  return (
    <div className="item-overview-section">
      {/* Title & Actions Header */}
      <ItemOverviewHeader
        name={item.name}
        onSaveName={onSaveName}
        onOpenAddUrlModal={() => setIsAddUrlModalOpen(true)}
        onOpenAttachModal={() => setIsAttachModalOpen(true)}
        onRefreshAll={onRefreshAll}
      />

      <div className="item-overview-grid">
        {/* LEFT COLUMN: Image, Price Aggregates, Tags */}
        <ItemOverviewSidebar
          item={item}
          userLocale={userLocale}
          currency={currency}
          inStockCount={inStockCount}
          onSaveImage={onSaveImage}
          onSaveTags={onSaveTags}
        />

        {/* RIGHT COLUMN: Stack of Store Cards */}
        <div className="item-overview-main">
          {/* Store Stack */}
          <div className="item-store-stack">
            <div className="item-store-stack-header">
              <h2 className="item-store-stack-title">
                Tracked Stores ({item.store_count})
              </h2>
            </div>

            {item.listings.length === 0 ? (
              <div className="item-card-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <Icon name="store" size="2.5rem" />
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text)' }}>No stores linked to this product yet.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsAddUrlModalOpen(true)}
                >
                  Track Store URL
                </button>
              </div>
            ) : (
              item.listings.map(listing => (
                <ItemStoreCard
                  key={listing.id}
                  listing={listing}
                  item={item}
                  userLocale={userLocale}
                  onRefresh={onRefreshListing}
                  onDetach={onDetachListing}
                  onDelete={onDeleteListing}
                  onUpdate={onReload}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddStoreUrlModal
        isOpen={isAddUrlModalOpen}
        onClose={() => setIsAddUrlModalOpen(false)}
        itemId={item.id}
        itemName={item.name}
        onSuccess={onReload}
      />

      <AttachStoreModal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        itemId={item.id}
        itemName={item.name}
        userLocale={userLocale}
        onAttach={onAttachStore}
      />
    </div>
  );
};

export default ItemOverviewSection;
