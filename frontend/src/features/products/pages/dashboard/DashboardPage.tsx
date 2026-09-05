import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { productsRoute } from '../../../../routes/-products-api';
import Layout from '../../../../layouts/Layout';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { useDashboardState } from '../../hooks/useDashboardState';
import DashboardControls from './DashboardControls';
import ProductList from './ProductList';
import ItemList from './ItemList';
import './Dashboard.css';

type DashboardView = 'items' | 'all';

/**
 * Which view the dashboard opens on, remembered per browser (issue #143).
 *
 * Flat is the default, not grouped: today every item has exactly one listing,
 * so the grouped view has nothing extra to show until a user attaches a second
 * store. It earns the default once that exists.
 */
const VIEW_STORAGE_KEY = 'pricestalker.dashboard.view';

function loadView(): DashboardView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'items' ? 'items' : 'all';
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null, and a dashboard that will not render is worse than one
    // that forgets a preference.
    return 'all';
  }
}

const Dashboard: React.FC = () => {
  const [view, setView] = React.useState<DashboardView>(loadView);

  const changeView = (next: DashboardView) => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* preference is optional */ }
  };

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

                {!isLoading && products.length > 0 && (
                  <div className="dashboard-view-toggle" role="group" aria-label="Dashboard view">
                    <button
                      type="button"
                      className={`view-toggle-btn ${view === 'all' ? 'active' : ''}`}
                      aria-pressed={view === 'all'}
                      onClick={() => changeView('all')}
                    >
                      All stores
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${view === 'items' ? 'active' : ''}`}
                      aria-pressed={view === 'items'}
                      onClick={() => changeView('items')}
                    >
                      By product
                    </button>
                  </div>
                )}

                {view === 'items' ? (
                  <ItemList searchQuery={searchQuery} activeCategory={activeCategory} />
                ) : (
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
                )}
          </>}
        </main>
      </div>
    </Layout>
  );
};

export default Dashboard;
