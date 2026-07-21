import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductService } from '../services/ProductService';
import { ProfileService } from '../../settings/services/ProfileService';
import { Product, PriceReviewResponse } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';
import { isPriceReviewResponse, calculateDashboardSummary } from '../pages/dashboard/utils';
import { useProductFilters } from './useProductFilters';
import { useProductActions } from './useProductActions';
import { truncateUrl } from '../../../utils/format';

export function useDashboardState() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'products' | 'stats' | 'add'>(() => {
    const saved = localStorage.getItem('dashboard_active_tab');
    return (saved as 'products' | 'stats' | 'add') || 'products';
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userCategories, setUserCategories] = useState<string[]>([]);
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
      setProducts(prev => prev.filter(p => p.id !== id));
      setProductToDelete(null);
    },
    onProductDeleteFailed: () => {
      fetchProducts();
    },
    onProductUpdated: (id, data) => {
      setProducts(prev => prev.map(p => p.id === id ? data : p));
    }
  });

  // Price selection modal state (for NEW products)
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceReviewData, setPriceReviewData] = useState<PriceReviewResponse | null>(null);
  const [pendingRefreshInterval, setPendingRefreshInterval] = useState<number>(3600);

  const filterState = useProductFilters({ products, userCategories });

  const fetchProducts = useCallback(async () => {
    try {
      const [productsRes, profileRes] = await Promise.all([
        ProductService.getAll(),
        ProfileService.getProfile()
      ]);
      setProducts(productsRes.data);
      setUserCategories(profileRes.data.categories || []);
    } catch {
      showToast('Failed to load products', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    localStorage.setItem('dashboard_active_tab', activeTab);
  }, [activeTab]);

  const handleAddProduct = async (url: string, refreshInterval: number, category: string) => {
    try {
      const response = await ProductService.create({ url, refreshInterval, category: category || null });

      if (isPriceReviewResponse(response.data)) {
        setPriceReviewData(response.data);
        setPendingRefreshInterval(refreshInterval);
        setShowPriceModal(true);
        return false;
      }

      const newProduct = response.data as Product;
      setProducts((prev) => [newProduct, ...prev]);
      setActiveTab('products');

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('product', newProduct.id.toString());
      nextParams.set('tab', 'products');
      setSearchParams(nextParams);

      const displayName = newProduct.name || truncateUrl(newProduct.url);
      const truncatedName = displayName.length > 40 ? displayName.substring(0, 37) + '...' : displayName;
      showToast(`Product added: ${truncatedName}`, 'success');

      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('You are already tracking this product.', 'error');
      } else {
        showToast('Failed to add product', 'error', err.response?.data?.error || err.message);
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

      if (!isPriceReviewResponse(response.data)) {
        const newProduct = response.data as Product;
        setProducts((prev) => [newProduct, ...prev]);
        setActiveTab('products');

        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('product', newProduct.id.toString());
        nextParams.set('tab', 'products');
        setSearchParams(nextParams);

        const displayName = newProduct.name || truncateUrl(newProduct.url);
        const truncatedName = displayName.length > 40 ? displayName.substring(0, 37) + '...' : displayName;
        showToast(`Product added: ${truncatedName}`, 'success');
      }

      setShowPriceModal(false);
      setPriceReviewData(null);

    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('You are already tracking this product.', 'error');
      } else {
        showToast('Failed to add product', 'error', err.response?.data?.error || err.message);
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

  const updateProduct = (id: number, data: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const removeProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  return {
    activeTab,
    setActiveTab,
    products,
    updateProduct,
    removeProduct,
    isLoading: isLoading,
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
