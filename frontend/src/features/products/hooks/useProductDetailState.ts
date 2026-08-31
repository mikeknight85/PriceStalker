import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ProductService } from '../services/ProductService';
import { ProfileService } from '../../settings/services/ProfileService';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useProductActions } from './useProductActions';
import { queryClient } from '../../../api/queryClient';
import { priceHistoryQuery, productDetailQuery, profileQuery } from '../../../api/queries';
import { syncProductCaches } from '../../../api/productCache';
import { 
  ProductWithStats, 
  PriceHistory, 
  NotificationSettings 
} from '../../../types/api';

export function useProductDetailState(
  productId: number, 
  onBack?: () => void,
  onDeleted?: (id: number) => void,
  onUpdated?: (id: number, data: any) => void
) {
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductWithStats | null>(null);
  const [prices, setPrices] = useState<PriceHistory[]>([]);
  
  const { execute: runFetch, isLoading, error } = useAsyncAction(true);
  const { execute: runSave, isLoading: isSaving } = useAsyncAction();
  const { execute: runSaveNotifications, isLoading: isSavingNotifications } = useAsyncAction();
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [priceDropThreshold, setPriceDropThreshold] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [notifyBackInStock, setNotifyBackInStock] = useState(false);
  const [aiVerificationDisabled, setAiVerificationDisabled] = useState(false);
  const [aiExtractionDisabled, setAiExtractionDisabled] = useState(false);
  const [checkingPaused, setCheckingPaused] = useState(false);
  
  const [editName, setEditName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isAdvancedCollapsed, setIsAdvancedCollapsed] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Product Actions Hook
  const {
    handleRefresh: handleRefreshAction,
    handleRescan: handleRescanAction,
    handleDelete: handleDeleteAction,
    handleTogglePause: handleTogglePauseAction,
    handlePriceSelected,
    closePriceModal,
    showPriceModal,
    priceReviewData,
    isRefreshing
  } = useProductActions({
    onProductDeleted: () => {
      if (onDeleted) onDeleted(productId);
      if (onBack) onBack();
      else navigate({ to: '/products' });
    },
    onProductUpdated: (_id, data) => {
      fetchData(30);
      if (onUpdated) onUpdated(productId, data);
    }
  });

  const fetchData = (days?: number) => runFetch(async () => {
    const [productRes, pricesRes, profileRes] = await Promise.all([
      queryClient.fetchQuery(productDetailQuery(productId)),
      queryClient.fetchQuery(priceHistoryQuery(productId, days ?? 30)),
      queryClient.fetchQuery(profileQuery()),
    ]);
    setProduct(productRes);
    setPrices(pricesRes.prices);
    setEditName(productRes.name || '');
    setEditCategories(productRes.category ? productRes.category.split(',').map((c: string) => c.trim()).filter(Boolean) : []);
    setEditImageUrl(productRes.image_url || '');
    
    setAvailableCategories(profileRes.categories || []);

    if (productRes.price_drop_threshold !== null && productRes.price_drop_threshold !== undefined) {
      setPriceDropThreshold(productRes.price_drop_threshold.toString());
    }
    if (productRes.target_price !== null && productRes.target_price !== undefined) {
      setTargetPrice(productRes.target_price.toString());
    }
    setNotifyBackInStock(productRes.notify_back_in_stock || false);
    setAiVerificationDisabled(productRes.ai_verification_disabled || false);
    setAiExtractionDisabled(productRes.ai_extraction_disabled || false);
    setCheckingPaused(productRes.checking_paused || false);
  }, { onErrorFallback: 'Failed to load product details' });

  const fetchNotificationSettings = async () => {
    try {
      const response = await ProfileService.getNotificationSettings();
      setNotificationSettings(response);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    if (productId) {
      fetchData(30);
      fetchNotificationSettings();
    }
  }, [productId]);

  const handleSaveName = () => runSave(async () => {
    if (!product || !editName.trim()) {
      setEditName(product?.name || '');
      setIsEditingName(false);
      return;
    }
    const updated = await ProductService.update(productId, { name: editName });
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    setIsEditingName(false);
    if (onUpdated) onUpdated(productId, { name: editName });
  }, { onSuccessMessage: 'Product name updated', onErrorFallback: 'Failed to update name' });

  const handleSaveImage = () => runSave(async () => {
    if (!product) return;
    const updated = await ProductService.update(productId, { image_url: editImageUrl });
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    setIsEditingImage(false);
    if (onUpdated) onUpdated(productId, { image_url: editImageUrl });
  }, { onSuccessMessage: 'Image URL updated', onErrorFallback: 'Failed to update image' });

  const handleSaveCategory = () => runSave(async () => {
    if (!product) return;
    const catString = editCategories.join(', ');
    const updated = await ProductService.update(productId, { category: catString });
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    setIsEditingCategory(false);
    if (onUpdated) onUpdated(productId, { category: catString });
  }, { onSuccessMessage: 'Categories updated', onErrorFallback: 'Failed to update categories' });

  const handleAddCategoryTag = (e?: React.KeyboardEvent | React.FocusEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
    if (e) e.preventDefault();
    
    const value = newCategoryInput.trim().replace(/,$/, '');
    if (value && !editCategories.includes(value)) {
      setEditCategories([...editCategories, value]);
      setNewCategoryInput('');
    } else {
      setNewCategoryInput('');
    }
  };

  const handleRemoveCategoryTag = (cat: string) => {
    setEditCategories(editCategories.filter(c => c !== cat));
  };

  const handleSaveNotifications = () => runSaveNotifications(async () => {
    if (!product) return;
    const data = {
      price_drop_threshold: priceDropThreshold === '' ? null : parseFloat(priceDropThreshold),
      target_price: targetPrice === '' ? null : parseFloat(targetPrice),
      notify_back_in_stock: notifyBackInStock,
      ai_verification_disabled: aiVerificationDisabled,
      ai_extraction_disabled: aiExtractionDisabled,
      checking_paused: checkingPaused
    };
    const updated = await ProductService.update(productId, data);
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    if (onUpdated) onUpdated(productId, data);
  }, { onSuccessMessage: 'Settings updated', onErrorFallback: 'Failed to update settings' });

  const priceChange = useMemo(() => {
    if (!product || !product.current_price || !product.original_price) return null;
    const diff = parseFloat(String(product.current_price)) - parseFloat(String(product.original_price));
    const percent = (diff / parseFloat(String(product.original_price))) * 100;
    return { diff, percent };
  }, [product]);

  const handleRefreshIntervalChange = (newInterval: number) => runSave(async () => {
    if (!product) return;
    const updated = await ProductService.update(productId, { refresh_interval: newInterval });
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    if (onUpdated) onUpdated(productId, { refresh_interval: newInterval });
  }, { onSuccessMessage: 'Check interval updated', onErrorFallback: 'Failed to update refresh interval' });

  const handleRangeChange = (days: number | undefined) => {
    fetchData(days);
  };

  return {
    product,
    prices,
    isLoading,
    isRefreshing,
    isSaving,
    isSavingNotifications,
    error,
    notificationSettings,
    priceDropThreshold, setPriceDropThreshold,
    targetPrice, setTargetPrice,
    notifyBackInStock, setNotifyBackInStock,
    aiVerificationDisabled, setAiVerificationDisabled,
    aiExtractionDisabled, setAiExtractionDisabled,
    checkingPaused, setCheckingPaused,
    editName, setEditName,
    isEditingName, setIsEditingName,
    isEditingCategory, setIsEditingCategory,
    editCategories, setEditCategories,
    newCategoryInput, setNewCategoryInput,
    editImageUrl, setEditImageUrl,
    isEditingImage, setIsEditingImage,
    isAdvancedCollapsed, setIsAdvancedCollapsed,
    availableCategories,
    showPriceModal,
    priceReviewData,
    showDeleteConfirm, setShowDeleteConfirm,
    handleRefresh: () => handleRefreshAction(productId),
    handleRescan: () => handleRescanAction(productId),
    handleDelete: () => handleDeleteAction(productId),
    handleResumeMonitoring: () => handleTogglePauseAction(productId, false),
    handlePriceSelected,
    handlePriceModalClose: closePriceModal,
    handleSaveName,
    handleSaveImage,
    handleSaveCategory,
    handleAddCategoryTag,
    handleRemoveCategoryTag,
    handleSaveNotifications,
    handleRefreshIntervalChange,
    handleRangeChange,
    priceChange,
  };
}
