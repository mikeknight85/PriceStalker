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

/** The range the Price History chart opens on. */
const DEFAULT_HISTORY_DAYS = 30;
/**
 * "All time" in the chart's range picker. The history endpoint returns every
 * recorded price when no day count is sent, and `ProductService.getPriceHistory`
 * omits the parameter for a falsy `days`.
 */
const ALL_TIME = 0;

export function useProductDetailState(
  productId: number, 
  onBack?: () => void,
  onDeleted?: (id: number) => void,
  onUpdated?: (id: number, data: any) => void
) {
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductWithStats | null>(null);
  const [prices, setPrices] = useState<PriceHistory[]>([]);
  const [historyDays, setHistoryDays] = useState<number>(DEFAULT_HISTORY_DAYS);
  
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
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isAdvancedCollapsed, setIsAdvancedCollapsed] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
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
      // Reload the range the chart is currently showing, not a hardcoded month.
      fetchData();
      if (onUpdated) onUpdated(productId, data);
    }
  });

  const fetchData = (days: number = historyDays) => runFetch(async () => {
    const [productRes, pricesRes, profileRes] = await Promise.all([
      queryClient.fetchQuery(productDetailQuery(productId)),
      queryClient.fetchQuery(priceHistoryQuery(productId, days)),
      queryClient.fetchQuery(profileQuery()),
    ]);
    setProduct(productRes);
    setPrices(Array.isArray(pricesRes?.prices) ? pricesRes.prices : []);
    setEditName(productRes.name || '');
    // `category` / `categories` are the wire names for tags -- see types/api.ts.
    setEditTags(productRes.category ? productRes.category.split(',').map((c: string) => c.trim()).filter(Boolean) : []);
    setEditImageUrl(productRes.image_url || '');
    
    setAvailableTags(profileRes.categories || []);

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
      fetchData(DEFAULT_HISTORY_DAYS);
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

  const handleSaveTags = () => runSave(async () => {
    if (!product) return;
    const tagString = editTags.join(', ');
    const updated = await ProductService.update(productId, { category: tagString });
    syncProductCaches(updated);
    setProduct({ ...product, ...updated });
    setIsEditingTags(false);
    if (onUpdated) onUpdated(productId, { category: tagString });
  }, { onSuccessMessage: 'Tags updated', onErrorFallback: 'Failed to update tags' });

  const handleAddTag = (e?: React.KeyboardEvent | React.FocusEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
    if (e) e.preventDefault();
    
    const value = newTagInput.trim().replace(/,$/, '');
    if (value && !editTags.includes(value)) {
      setEditTags([...editTags, value]);
      setNewTagInput('');
    } else {
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
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
    const range = days ?? ALL_TIME;
    setHistoryDays(range);
    fetchData(range);
  };

  return {
    product,
    prices,
    historyDays,
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
    isEditingTags, setIsEditingTags,
    editTags, setEditTags,
    newTagInput, setNewTagInput,
    editImageUrl, setEditImageUrl,
    isEditingImage, setIsEditingImage,
    isAdvancedCollapsed, setIsAdvancedCollapsed,
    availableTags,
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
    handleSaveTags,
    handleAddTag,
    handleRemoveTag,
    handleSaveNotifications,
    handleRefreshIntervalChange,
    handleRangeChange,
    priceChange,
  };
}
