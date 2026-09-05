import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductImage, ProductPriceStatus } from './ProductInfo';
import ProductHeader from './ProductHeader';
import ProductMetadata from './ProductMetadata';
import ProductActions from './ProductActions';
import LinkToItemModal from '../../components/LinkToItemModal';
import { itemListQuery, queryKeys } from '../../../../api/queries';
import { ProductService } from '../../services/ProductService';
import { queryClient } from '../../../../api/queryClient';
import { useToast } from '../../../../context/ToastContext';

interface OverviewSectionProps {
  product: any;
  user: any;
  state: any;
  REFRESH_INTERVALS: any[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ 
  product, 
  user, 
  state,
  REFRESH_INTERVALS 
}) => {
  const { showToast } = useToast();
  const [isLinking, setIsLinking] = useState(false);
  const itemsQuery = useQuery(itemListQuery());

  // Whether this store shares a product with others decides which action is
  // offered: link, or separate. Derived from the grouped data rather than
  // tracked separately, so it cannot disagree with what the dashboard shows.
  // Array.isArray, not just a null check: this decorates the page with a
  // grouping action, and a response that is not the expected shape -- a proxy
  // error page, a misconfigured deployment -- must not take the whole overview
  // down with it. The ErrorBoundary would catch it, but a section that renders
  // without the extra button is a better outcome than one that does not render.
  const items = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
  const owningItem = items.find(item => item.listings?.some(l => l.id === product?.id));
  const sharesProduct = (owningItem?.store_count ?? 1) > 1;

  const refreshEverything = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.items });
  };

  const handleLink = async (itemId: number) => {
    try {
      const result = await ProductService.attachToItem(itemId, product.id);
      setIsLinking(false);
      refreshEverything();
      // Say what was lost. The alternative is the user discovering it when an
      // alert they had set stops arriving.
      const lost = result?.discardedAlertSettings;
      showToast(
        lost
          ? 'Linked. The alert settings this store had on its own were replaced by the ones on the product you chose.'
          : 'Linked. These stores are now compared together.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not link these products.', 'error');
    }
  };

  const handleSeparate = async () => {
    try {
      await ProductService.detachFromItem(product.id);
      refreshEverything();
      showToast('Separated. This store is tracked on its own again.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not separate this store.', 'error');
    }
  };

  return (
    <div className="product-detail-card">
      <div className="product-detail-content">
        <ProductImage 
          product={product}
          editImageUrl={state.editImageUrl}
          setEditImageUrl={state.setEditImageUrl}
          isEditingImage={state.isEditingImage}
          setIsEditingImage={state.setIsEditingImage}
          handleSaveImage={state.handleSaveImage}
          isSaving={state.isSaving}
        />

        <div className="product-detail-info">
          <div className="product-detail-info-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
            <ProductHeader 
              product={product}
              editName={state.editName}
              setEditName={state.setEditName}
              isEditingName={state.isEditingName}
              setIsEditingName={state.setIsEditingName}
              handleSaveName={state.handleSaveName}
              isSaving={state.isSaving}
            />
          </div>

          <div className="product-detail-layout-row">
            <div className="product-detail-price-status-col">
              <ProductPriceStatus 
                product={product}
                user={user}
              />
            </div>
            
            <div className="product-detail-metadata-col">
              <ProductMetadata 
                product={product}
                isEditingCategory={state.isEditingCategory}
                setIsEditingCategory={state.setIsEditingCategory}
                editCategories={state.editCategories}
                setEditCategories={state.setEditCategories}
                newCategoryInput={state.newCategoryInput}
                setNewCategoryInput={state.setNewCategoryInput}
                handleAddCategoryTag={state.handleAddCategoryTag}
                handleRemoveCategoryTag={state.handleRemoveCategoryTag}
                handleSaveCategory={state.handleSaveCategory}
                handleRefreshIntervalChange={state.handleRefreshIntervalChange}
                availableCategories={state.availableCategories}
                isSaving={state.isSaving}
                REFRESH_INTERVALS={REFRESH_INTERVALS}
              />
            </div>
          </div>

          <ProductActions 
            handleRefresh={state.handleRefresh}
            handleRescan={state.handleRescan}
            handleDelete={async () => state.setShowDeleteConfirm(true)}
            handleResumeMonitoring={state.handleResumeMonitoring}
            isRefreshing={state.isRefreshing}
            isPaused={!!product?.checking_paused}
            onLinkToProduct={() => setIsLinking(true)}
            onSeparate={sharesProduct ? () => void handleSeparate() : undefined}
          />

          <LinkToItemModal
            isOpen={isLinking}
            onClose={() => setIsLinking(false)}
            productId={product?.id}
            productName={product?.name || 'This store'}
            onConfirm={handleLink}
          />
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
