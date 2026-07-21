import React from 'react';
import { ProductImage, ProductPriceStatus } from './ProductInfo';
import ProductHeader from './ProductHeader';
import ProductMetadata from './ProductMetadata';
import ProductActions from './ProductActions';

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
            isRefreshing={state.isRefreshing}
          />
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
