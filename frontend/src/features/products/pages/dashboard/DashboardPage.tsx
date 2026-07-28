import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { productsRoute } from '../../../../routes/-products-api';
import Layout from '../../../../layouts/Layout';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { useDashboardState } from '../../hooks/useDashboardState';
import DashboardControls from './DashboardControls';
import ProductList from './ProductList';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const {
    products,
    isLoading,
    loadError,
    retryLoad,
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
    filteredAndSortedProducts,
    showPriceModal,
    priceReviewData,
    handlePriceSelected,
    handlePriceModalClose,
    handleDeleteProduct,
    handleRefreshProduct,
    handlePauseToggle,
    productToDelete,
    setProductToDelete,
    isRefreshingProduct,
  } = useDashboardState();

  const navigate = useNavigate();
  const { category } = productsRoute.useSearch();

  useEffect(() => {
    if (category !== undefined && category !== activeCategory) {
      setActiveCategory(category);
    }
  }, [activeCategory, category, setActiveCategory]);

  const handleCategoryClick = (cat: string | null) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setPauseFilter('all');
    setSortBy('date_added');
    setSortOrder('desc');

    navigate({ to: '/products', search: { category: cat || undefined } });
  };

  return (
    <Layout>
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

      <div className="section-container">
        <main className="dashboard-main">
          {loadError ? (
            <div className="alert alert-error">
              <span>Failed to load products. Please try again.</span>
              <button type="button" className="btn btn-secondary" onClick={() => void retryLoad()}>
                Retry
              </button>
            </div>
          ) : <>
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
                  onAddClick={() => navigate({ to: '/products/new' })}
                  hasAnyProducts={products.length > 0}
                  onSelect={(id) => navigate({ to: '/products/$productId', params: { productId: String(id) } })}
                />
          </>}
        </main>
      </div>
    </Layout>
  );
};

export default Dashboard;
