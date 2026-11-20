import React, { createContext, useContext, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemDetailQuery, itemPriceHistoryQuery, queryKeys } from '../../../../api/queries';
import { queryClient } from '../../../../api/queryClient';
import { useAuth } from '../../../auth';
import { ProductService } from '../../services/ProductService';
import { useToast } from '../../../../context/ToastContext';
import { ItemWithListings } from '../../../../types/api';

interface ItemDetailContextValue {
  itemId: number;
  item: ItemWithListings | null;
  isLoading: boolean;
  error: string | null;
  historySeries: Array<{
    productId: number;
    retailerName: string;
    url: string;
    currency: string;
    prices: any[];
  }>;
  historyDays: number | undefined;
  setHistoryDays: (days: number | undefined) => void;
  refetchItem: () => void;
  handleRefreshListing: (productId: number) => Promise<void>;
  handleRefreshAll: () => Promise<void>;
  handleDetachListing: (productId: number) => Promise<void>;
  handleDeleteListing: (productId: number) => void;
  handleAttachStore: (productId: number) => Promise<void>;
  handleSaveName: (name: string) => Promise<void>;
  handleSaveImage: (imageUrl: string | null) => Promise<void>;
  handleSaveTags: (tags: string[]) => Promise<void>;
  handleSaveNotifications: (updates: {
    target_price?: number | null;
    price_drop_threshold?: number | null;
    notify_back_in_stock?: boolean;
  }) => Promise<void>;
  listingToDelete: number | null;
  setListingToDelete: (id: number | null) => void;
  handleConfirmDeleteListing: () => Promise<void>;
  user: ReturnType<typeof useAuth>['user'];
}

const ItemDetailContext = createContext<ItemDetailContextValue | undefined>(undefined);

export const ItemDetailProvider: React.FC<{ itemId: number; children: React.ReactNode }> = ({
  itemId,
  children,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [historyDays, setHistoryDays] = useState<number | undefined>(30);
  const [listingToDelete, setListingToDelete] = useState<number | null>(null);

  const detailQuery = useQuery(itemDetailQuery(itemId));
  const historyQuery = useQuery(itemPriceHistoryQuery(itemId, historyDays));

  const item = detailQuery.data || null;
  const isLoading = detailQuery.isLoading;
  const error = detailQuery.isError ? 'Failed to load product' : null;

  const historySeries = useMemo(() => {
    return historyQuery.data?.series || [];
  }, [historyQuery.data]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.itemDetail(itemId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.items });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.itemPriceHistory(itemId) });
  };

  const handleRefreshListing = async (productId: number) => {
    try {
      await ProductService.refreshPrice(productId);
      showToast('Store price checked successfully.', 'success');
      invalidateAll();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to refresh price', 'error');
    }
  };

  const handleRefreshAll = async () => {
    if (!item || !item.listings.length) return;
    try {
      await Promise.allSettled(item.listings.map(l => ProductService.refreshPrice(l.id)));
      showToast('All stores refreshed.', 'success');
      invalidateAll();
    } catch (err: any) {
      showToast('Finished checking stores.', 'info');
      invalidateAll();
    }
  };

  const handleDetachListing = async (productId: number) => {
    try {
      await ProductService.detachFromItem(productId);
      showToast('Separated store into its own product.', 'success');
      invalidateAll();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not separate store.', 'error');
    }
  };

  const handleDeleteListing = (productId: number) => {
    setListingToDelete(productId);
  };

  const handleConfirmDeleteListing = async () => {
    if (!listingToDelete) return;
    try {
      await ProductService.delete(listingToDelete);
      showToast('Store removed from tracking.', 'success');
      setListingToDelete(null);
      invalidateAll();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete store.', 'error');
    }
  };

  const handleAttachStore = async (productId: number) => {
    try {
      await ProductService.attachToItem(itemId, productId);
      showToast('Store attached to product.', 'success');
      invalidateAll();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to attach store.', 'error');
    }
  };

  const handleSaveName = async (name: string) => {
    await ProductService.updateItem(itemId, { name });
    showToast('Product name updated.', 'success');
    invalidateAll();
  };

  const handleSaveImage = async (imageUrl: string | null) => {
    await ProductService.updateItem(itemId, { image_url: imageUrl });
    showToast('Product image updated.', 'success');
    invalidateAll();
  };

  const handleSaveTags = async (tags: string[]) => {
    await ProductService.updateItem(itemId, { category: tags.join(', ') });
    showToast('Product tags updated.', 'success');
    invalidateAll();
  };

  const handleSaveNotifications = async (updates: {
    target_price?: number | null;
    price_drop_threshold?: number | null;
    notify_back_in_stock?: boolean;
  }) => {
    await ProductService.updateItem(itemId, updates);
    invalidateAll();
  };

  return (
    <ItemDetailContext.Provider
      value={{
        itemId,
        item,
        isLoading,
        error,
        historySeries,
        historyDays,
        setHistoryDays,
        refetchItem: invalidateAll,
        handleRefreshListing,
        handleRefreshAll,
        handleDetachListing,
        handleDeleteListing,
        handleAttachStore,
        handleSaveName,
        handleSaveImage,
        handleSaveTags,
        handleSaveNotifications,
        listingToDelete,
        setListingToDelete,
        handleConfirmDeleteListing,
        user,
      }}
    >
      {children}
    </ItemDetailContext.Provider>
  );
};

export function useItemDetail() {
  const ctx = useContext(ItemDetailContext);
  if (!ctx) throw new Error('useItemDetail must be used within ItemDetailProvider');
  return ctx;
}
