import type { ReactNode } from 'react';
import Layout from '../../../../layouts/Layout';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { ProductDetailProvider, useProductDetail } from './ProductDetailContext';

interface ProductDetailProps {
  productId: number;
  children: ReactNode;
}

function ProductDetailContent({ children }: { children: ReactNode }) {
  const { state } = useProductDetail();

  if (state.isLoading) {
    return <Layout><LoadingSpinner centered size="3rem" /></Layout>;
  }

  if (state.error || !state.product) {
    return (
      <Layout>
        <div className="alert alert-error">{state.error || 'Product not found'}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {children}
      <ConfirmationModal
        isOpen={state.showDeleteConfirm}
        onClose={() => state.setShowDeleteConfirm(false)}
        onConfirm={() => state.handleDelete()}
        isLoading={state.isRefreshing}
        title="Stop Tracking Product"
        message={`Are you sure you want to stop tracking "${state.product.name || 'this product'}"? This will permanently delete its history.`}
        confirmText="Stop Tracking"
        isDanger={true}
      />
      <PriceSelectionModal
        isOpen={state.showPriceModal}
        onClose={state.handlePriceModalClose}
        onSelect={state.handlePriceSelected}
        productName={state.priceReviewData?.name || null}
        imageUrl={state.priceReviewData?.imageUrl || null}
        candidates={state.priceReviewData?.priceCandidates || []}
        url={state.priceReviewData?.url || ''}
        category={state.product.category || null}
        reviewReason={state.priceReviewData?.reviewReason}
      />
    </Layout>
  );
}

export default function ProductDetail({ productId, children }: ProductDetailProps) {
  return (
    <ProductDetailProvider productId={productId}>
      <ProductDetailContent>{children}</ProductDetailContent>
    </ProductDetailProvider>
  );
}
