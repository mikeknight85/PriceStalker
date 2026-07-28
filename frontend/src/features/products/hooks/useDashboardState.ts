import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ProductService } from '../services/ProductService';
import { Product, PriceReviewResponse } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { isPriceReviewResponse, calculateDashboardSummary } from '../pages/dashboard/utils';
import { useProductFilters } from './useProductFilters';
import { useProductActions } from './useProductActions';
import { truncateUrl } from '../../../utils/format';
import { productListQuery, profileQuery, queryKeys } from '../../../api/queries';
import { queryClient } from '../../../api/queryClient';
import { isApiError } from '../../../api/client';

export function useDashboardState() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const productsQuery = useQuery(productListQuery());
  const profile = useQuery(profileQuery());
  const products = productsQuery.data ?? [];
  const userCategories = profile.data?.categories ?? [];
  const loadError = productsQuery.error ?? profile.error;
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Product Actions Hook
  const {
    handleRefresh,
    handleRescan,
    handleDelete,
    handleTogglePause,
    handlePriceSelected: handleRescanPriceSelected,
    closePriceModal: closeRescanPriceModal,
    showPriceModal: showRescanPriceModal,
    priceReviewData: rescanPriceReviewData,
    isRefreshing
  } = useProductActions({
    onProductDeleted: (id) => {
      queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => previous?.filter(p => p.id !== id) ?? []);
      setProductToDelete(null);
    },
    onProductDeleteFailed: () => {
      fetchProducts();
    },
    onProductUpdated: (id, data) => {
      queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => previous?.map(p => p.id === id ? data : p) ?? []);
    }
  });

  // Price selection modal state (for NEW products)
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceReviewData, setPriceReviewData] = useState<PriceReviewResponse | null>(null);
  const [pendingRefreshInterval, setPendingRefreshInterval] = useState<number>(3600);

  const filterState = useProductFilters({ products, userCategories });

  const fetchProducts = useCallback(async () => {
    await Promise.all([productsQuery.refetch(), profile.refetch()]);
  }, [productsQuery, profile]);

  const handleAddProduct = async (url: string, refreshInterval: number, category: string) => {
    try {
      const response = await ProductService.create({ url, refreshInterval, category: category || null });

      if (isPriceReviewResponse(response)) {
        setPriceReviewData(response);
        setPendingRefreshInterval(refreshInterval);
        setShowPriceModal(true);
        return false;
      }

      const newProduct = response as Product;
      queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => [newProduct, ...(previous ?? [])]);
      navigate({ to: '/products/$productId', params: { productId: String(newProduct.id) } });

      const displayName = newProduct.name || truncateUrl(newProduct.url);
      const truncatedName = displayName.length > 40 ? displayName.substring(0, 37) + '...' : displayName;
      showToast(`Product added: ${truncatedName}`, 'success');

      return true;
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        showToast('You are already tracking this product.', 'error');
      } else {
        showToast('Failed to add product', 'error', err instanceof Error ? err.message : undefined);
      }
      return false;
    }
  };

  const handlePriceSelected = async (selectedPrice: number, selectedMethod: string, selectedCurrency: string, category: string | null, selector?: string) => {
    if (!priceReviewData) return;

    try {
      const response = await ProductService.create({
        url: priceReviewData.url,
        refreshInterval: pendingRefreshInterval,
        selectedPrice,
        selectedMethod,
        selectedCurrency,
        name: priceReviewData.name,
        imageUrl: priceReviewData.imageUrl,
        stockStatus: priceReviewData.stockStatus,
        html: priceReviewData.html,
        selector,
        category
      });

      if (!isPriceReviewResponse(response)) {
        const newProduct = response as Product;
        queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => [newProduct, ...(previous ?? [])]);
        navigate({ to: '/products/$productId', params: { productId: String(newProduct.id) } });

        const displayName = newProduct.name || truncateUrl(newProduct.url);
        const truncatedName = displayName.length > 40 ? displayName.substring(0, 37) + '...' : displayName;
        showToast(`Product added: ${truncatedName}`, 'success');
      }

      setShowPriceModal(false);
      setPriceReviewData(null);

    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        showToast('You are already tracking this product.', 'error');
      } else {
        showToast('Failed to add product', 'error', err instanceof Error ? err.message : undefined);
      }
      setShowPriceModal(false);
      setPriceReviewData(null);
    }
  };

  const handlePriceModalClose = () => {
    setShowPriceModal(false);
    setPriceReviewData(null);
  };

  const dashboardSummary = useMemo(() => {
    return calculateDashboardSummary(products);
  }, [products]);

  const updateProduct = (id: number, data: Partial<Product>) => {
    queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => previous?.map(p => p.id === id ? { ...p, ...data } : p) ?? []);
  };

  const removeProduct = (id: number) => {
    queryClient.setQueryData<Product[]>(queryKeys.products.all, previous => previous?.filter(p => p.id !== id) ?? []);
  };

  return {
    products,
    updateProduct,
    removeProduct,
    isLoading: productsQuery.isLoading || profile.isLoading,
    loadError,
    retryLoad: fetchProducts,
    ...filterState,
    dashboardSummary,
    showPriceModal: showPriceModal || showRescanPriceModal,
    priceReviewData: priceReviewData || rescanPriceReviewData,
    handleAddProduct,
    handlePriceSelected: (price: number, method: string, currency: string, cat: string | null, sel?: string) => {
      if (showRescanPriceModal) {
        return handleRescanPriceSelected(price, method, currency, cat, sel);
      } else {
        return handlePriceSelected(price, method, currency, cat, sel);
      }
    },
    handlePriceModalClose: () => {
      if (showRescanPriceModal) {
        closeRescanPriceModal();
      } else {
        handlePriceModalClose();
      }
    },
    handleRescanProduct: (id: number) => handleRescan(id),
    handleDeleteProduct: (id: number) => handleDelete(id),
    handleRefreshProduct: (id: number) => handleRefresh(id),
    handlePauseToggle: (id: number, paused: boolean) => handleTogglePause(id, paused),
    isRefreshingProduct: isRefreshing,
    productToDelete,
    setProductToDelete,
  };
}
