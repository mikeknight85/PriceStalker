import { useState } from 'react';
import { ProductService } from '../services/ProductService';
import { useToast } from '../../../context/ToastContext';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { apiErrorMessage } from '../../../api/error';
import { queryClient } from '../../../api/queryClient';
import { queryKeys } from '../../../api/queries';
import { invalidateProductHistory, syncProductCaches } from '../../../api/productCache';
import { PriceReviewResponse, Product } from '../../../types/api';

interface UseProductActionsProps {
  onProductDeleted?: (id: number) => void;
  onProductDeleteFailed?: (id: number) => void;
  onProductUpdated?: (id: number, data: any) => void;
}

export function useProductActions({ onProductDeleted, onProductDeleteFailed, onProductUpdated }: UseProductActionsProps = {}) {
  const { showToast } = useToast();
  const { execute: runAction, isLoading } = useAsyncAction();
  
  const [priceReviewData, setPriceReviewData] = useState<PriceReviewResponse | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);

  const handleRefresh = (id: number, fallbackName?: string | null) => runAction(async () => {
    await ProductService.refreshPrice(id);
    const updatedProductRes = await ProductService.getById(id);
    syncProductCaches(updatedProductRes);
    // A refresh records a new price and stock reading, so the cached history has
    // to go before anything reloads it.
    await invalidateProductHistory(id);
    if (onProductUpdated) onProductUpdated(id, updatedProductRes);
    return updatedProductRes;
  }, {
    onSuccessMessage: (res) => {
      const name = res?.name || fallbackName;
      return name ? `${name} price refreshed` : `Product #${id} price refreshed`;
    },
    onErrorFallback: 'Failed to refresh price'
  });

  const handleRescan = (id: number) => runAction(async () => {
    setActiveProductId(id);
    const res = await ProductService.scan(id);
    setPriceReviewData(res);
    setShowPriceModal(true);
  }, { onErrorMessage: 'Failed to start re-scan' });

  const handleDelete = (id: number, fallbackName?: string | null) => {
    return runAction(async () => {
      await ProductService.delete(id);
      queryClient.removeQueries({ queryKey: queryKeys.products.detail(id) });
      queryClient.setQueryData<Product[]>(queryKeys.products.all, (products) =>
        products?.filter((product) => product.id !== id) ?? [],
      );
      if (onProductDeleted) onProductDeleted(id);
    }, {
      onSuccessMessage: fallbackName ? `${fallbackName} deleted` : `Product #${id} deleted`,
      onErrorFallback: 'Failed to delete product',
      throwError: true
    }).catch((err) => {
      if (onProductDeleteFailed) onProductDeleteFailed(id);
      throw err;
    });
  };

  const handleTogglePause = (id: number, targetPaused: boolean, fallbackName?: string | null) => runAction(async () => {
    const res = await ProductService.update(id, { checking_paused: targetPaused });
    syncProductCaches(res);
    if (onProductUpdated) onProductUpdated(id, res);
    return res;
  }, {
    onSuccessMessage: (res) => {
      const name = res?.name || fallbackName;
      if (name) {
        return targetPaused ? `${name} tracking paused` : `${name} tracking resumed`;
      }
      return targetPaused ? `Product #${id} tracking paused` : `Product #${id} tracking resumed`;
    },
    onErrorFallback: 'Failed to toggle pause state'
  });

  const handlePriceSelected = async (selectedPrice: number, selectedMethod: string, selectedCurrency: string, _category: string | null, selector?: string) => {
    if (!priceReviewData || activeProductId === null) return;

    try {
      const res = await ProductService.confirmSelection(activeProductId, {
        selectedPrice,
        selectedMethod,
        selectedCurrency,
        name: priceReviewData.name,
        imageUrl: priceReviewData.imageUrl,
        stockStatus: priceReviewData.stockStatus,
        html: priceReviewData.html,
        selector
      });
      
      syncProductCaches(res);
      // Confirming a candidate writes a price row of its own, same as a refresh.
      await invalidateProductHistory(activeProductId);
      if (onProductUpdated) onProductUpdated(activeProductId, res);
      setShowPriceModal(false);
      setPriceReviewData(null);
      const updatedName = res?.name || priceReviewData.name;
      const successMsg = updatedName
        ? `${updatedName} updated via re-scan`
        : `Product #${activeProductId} updated via re-scan`;
      setActiveProductId(null);
      showToast(successMsg, 'success');
    } catch (err: any) {
      showToast('Failed to confirm selection', 'error', apiErrorMessage(err));
    }
  };

  const closePriceModal = () => {
    setShowPriceModal(false);
    setPriceReviewData(null);
    setActiveProductId(null);
  };

  return {
    isRefreshing: isLoading,
    handleRefresh,
    handleRescan,
    handleDelete,
    handleTogglePause,
    handlePriceSelected,
    closePriceModal,
    showPriceModal,
    priceReviewData,
    activeProductId
  };
}
