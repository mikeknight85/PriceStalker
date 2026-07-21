import { useState } from 'react';
import { ProductService } from '../services/ProductService';
import { useToast } from '../../../context/ToastContext';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { PriceReviewResponse } from '../../../types/api';

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

  const handleRefresh = (id: number) => runAction(async () => {
    await ProductService.refreshPrice(id);
    const updatedProductRes = await ProductService.getById(id);
    if (onProductUpdated) onProductUpdated(id, updatedProductRes.data);
  }, { onSuccessMessage: 'Price refreshed', onErrorFallback: 'Failed to refresh price' });

  const handleRescan = (id: number) => runAction(async () => {
    setActiveProductId(id);
    const res = await ProductService.scan(id);
    setPriceReviewData(res.data);
    setShowPriceModal(true);
  }, { onErrorMessage: 'Failed to start re-scan' });

  const handleDelete = (id: number) => {
    return runAction(async () => {
      await ProductService.delete(id);
      if (onProductDeleted) onProductDeleted(id);
    }, { 
      onSuccessMessage: 'Product deleted', 
      onErrorFallback: 'Failed to delete product',
      throwError: true
    }).catch((err) => {
      if (onProductDeleteFailed) onProductDeleteFailed(id);
      throw err;
    });
  };

  const handleTogglePause = (id: number, targetPaused: boolean) => runAction(async () => {
    const res = await ProductService.update(id, { checking_paused: targetPaused });
    if (onProductUpdated) onProductUpdated(id, res.data);
  }, { onSuccessMessage: targetPaused ? 'Tracking paused' : 'Tracking resumed', onErrorFallback: 'Failed to toggle pause state' });

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
      
      if (onProductUpdated) onProductUpdated(activeProductId, res.data);
      setShowPriceModal(false);
      setPriceReviewData(null);
      setActiveProductId(null);
      showToast('Product updated via re-scan', 'success');
    } catch (err: any) {
      showToast('Failed to confirm selection', 'error', err.response?.data?.error || err.message);
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
