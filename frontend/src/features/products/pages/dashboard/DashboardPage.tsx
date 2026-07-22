import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../../../layouts/Layout';
import ProductForm from '../../components/ProductForm';
import DashboardTabs from '../../components/DashboardTabs';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import ErrorBoundary from '../../../../components/ErrorBoundary';
import { useDashboardState } from '../../hooks/useDashboardState';
import DashboardSummary from './DashboardSummary';
import DashboardControls from './DashboardControls';
import ProductList from './ProductList';
import ProductDetailPage from '../product-detail/ProductDetailPage';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    products,
    updateProduct,
    removeProduct,
    isLoading,
    searchQuery,
    setSearchQuery,
    pauseFilter,
    setPauseFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeCategory,
    setActiveCategory,
    categories,
    formCategories,
    dashboardSummary,
    filteredAndSortedProducts,
    showPriceModal,
    priceReviewData,
    handleAddProduct,
    handlePriceSelected,
    handlePriceModalClose,
    handleDeleteProduct,
    handleRefreshProduct,
    handlePauseToggle,
    productToDelete,
    setProductToDelete,
    isRefreshingProduct,
  } = useDashboardState();

  const [searchParams, setSearchParams] = useSearchParams();

  // Category select sync effect
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlProduct = searchParams.get('product');

    if (urlProduct) {
      if (activeTab !== 'products') {
        setActiveTab('products');
      }
    } else if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab as 'products' | 'stats' | 'add');
    }

    const urlCategory = searchParams.get('category');
    if (urlCategory !== activeCategory) {
      setActiveCategory(urlCategory);
    }
  }, [searchParams, activeTab, activeCategory, setActiveTab, setActiveCategory]);

  const handleTabChange = (tab: 'products' | 'stats' | 'add') => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.delete('product');
    nextParams.delete('section');
    setSearchParams(nextParams);
  };

  const handleCategoryClick = (cat: string | null) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setPauseFilter('all');
    setSortBy('date_added');
    setSortOrder('desc');

    const nextParams = new URLSearchParams(searchParams);
    if (cat) {
      nextParams.set('category', cat);
    } else {
      nextParams.delete('category');
    }
    nextParams.delete('product');
    nextParams.delete('section');
    setSearchParams(nextParams);
  };

  const handleSelectProduct = (id: number | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (id !== null) {
      nextParams.set('product', id.toString());
    } else {
      nextParams.delete('product');
    }
    nextParams.delete('section');
    setSearchParams(nextParams);
  };

  // Active tab selection from URL query param
  const activeTabFromUrl = searchParams.get('tab') as 'products' | 'stats' | 'add' | null;
  const currentActiveTab = activeTabFromUrl || activeTab;

  // Selected product from URL query param
  const productFromUrl = searchParams.get('product');
  const selectedProductId = productFromUrl ? parseInt(productFromUrl, 10) : null;

  return (
    <Layout>
      <DashboardTabs activeTab={currentActiveTab} onTabChange={handleTabChange} />

      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => {
          if (productToDelete) {
            return handleDeleteProduct(productToDelete.id);
          }
        }}
        isLoading={isRefreshingProduct}
        title="Delete Product"
        message={`Are you sure you want to stop tracking "${productToDelete?.name || 'this product'}"? This will permanently delete its history.`}
        confirmText="Stop Tracking"
        isDanger={true}
      />

      <PriceSelectionModal
        isOpen={showPriceModal}
        onClose={handlePriceModalClose}
        onSelect={handlePriceSelected}
        productName={priceReviewData?.name || null}
        imageUrl={priceReviewData?.imageUrl || null}
        candidates={priceReviewData?.priceCandidates || []}
        url={priceReviewData?.url || ''}
        category={priceReviewData?.category || null}
        reviewReason={priceReviewData?.reviewReason}
      />

      {currentActiveTab === 'add' ? (
        <div className="section-container">
           <div className="settings-card" style={{ maxWidth: '1200px', margin: '0 auto', padding: 0, background: 'transparent', boxShadow: 'none' }}>
              <ProductForm onSubmit={handleAddProduct} availableCategories={formCategories} />
           </div>
        </div>
      ) : currentActiveTab === 'stats' ? (
        <div className="section-container">
          <ErrorBoundary section="the dashboard summary">
            <DashboardSummary summary={dashboardSummary} />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="section-container">
          <main className="dashboard-main">
            {selectedProductId !== null ? (
              <div className="inline-product-detail-container">
                <ProductDetailPage 
                  productIdProp={selectedProductId}
                  onBack={() => handleSelectProduct(null)}
                  onDeleted={removeProduct}
                  onUpdated={updateProduct}
                  hideLayout={true}
                />
              </div>
            ) : (
              <>
                {!isLoading && products.length > 0 && (
                  <DashboardControls
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    pauseFilter={pauseFilter}
                    onPauseFilterChange={setPauseFilter}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderToggle={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    filteredCount={filteredAndSortedProducts.length}
                    activeCategory={activeCategory}
                    categories={categories}
                    onCategorySelect={handleCategoryClick}
                  />
                )}

                <ProductList
                  products={filteredAndSortedProducts}
                  isLoading={isLoading}
                  onDelete={(id) => {
                    const p = products.find(prod => prod.id === id);
                    if (p) setProductToDelete(p);
                  }}
                  onRefresh={handleRefreshProduct}
                  onTogglePause={handlePauseToggle}
                  onAddClick={() => handleTabChange('add')}
                  hasAnyProducts={products.length > 0}
                  onSelect={handleSelectProduct}
                />
              </>
            )}
          </main>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
