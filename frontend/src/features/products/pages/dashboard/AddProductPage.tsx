import Layout from '../../../../layouts/Layout';
import ErrorBoundary from '../../../../components/ErrorBoundary';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ProductForm from '../../components/ProductForm';
import { useDashboardState } from '../../hooks/useDashboardState';

export default function AddProductPage() {
  const {
    formCategories,
    handleAddProduct,
    showPriceModal,
    priceReviewData,
    handlePriceSelected,
    handlePriceModalClose,
  } = useDashboardState();

  return (
    <Layout>
      <div className="section-container">
        <ErrorBoundary section="adding a product">
          <div className="settings-card" style={{ maxWidth: '1200px', margin: '0 auto', padding: 0, background: 'transparent', boxShadow: 'none' }}>
            <ProductForm onSubmit={handleAddProduct} availableCategories={formCategories} />
          </div>
        </ErrorBoundary>
      </div>
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
    </Layout>
  );
}
