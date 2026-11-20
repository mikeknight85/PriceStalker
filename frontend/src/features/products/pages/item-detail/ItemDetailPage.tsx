import React, { ReactNode } from 'react';
import Layout from '../../../../layouts/Layout';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { ItemDetailProvider, useItemDetail } from './ItemDetailContext';

interface ItemDetailPageProps {
  itemId: number;
  children: ReactNode;
}

function ItemDetailPageContent({ children }: { children: ReactNode }) {
  const {
    item,
    isLoading,
    error,
    listingToDelete,
    setListingToDelete,
    handleConfirmDeleteListing,
  } = useItemDetail();

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner centered size="3rem" />
      </Layout>
    );
  }

  if (error || !item) {
    return (
      <Layout>
        <div className="alert alert-error" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          {error || 'Product not found'}
        </div>
      </Layout>
    );
  }

  const deletingStore = item.listings.find(l => l.id === listingToDelete);

  return (
    <Layout>
      {children}

      <ConfirmationModal
        isOpen={listingToDelete !== null}
        onClose={() => setListingToDelete(null)}
        onConfirm={handleConfirmDeleteListing}
        title="Stop Tracking Store"
        message={`Are you sure you want to stop tracking "${deletingStore?.name || deletingStore?.url || 'this store'}"? Its historical prices will be removed.`}
        confirmText="Stop Tracking"
        isDanger={true}
      />
    </Layout>
  );
}

export const ItemDetailPage: React.FC<ItemDetailPageProps> = ({ itemId, children }) => {
  return (
    <ItemDetailProvider itemId={itemId}>
      <ItemDetailPageContent>{children}</ItemDetailPageContent>
    </ItemDetailProvider>
  );
};

export default ItemDetailPage;
